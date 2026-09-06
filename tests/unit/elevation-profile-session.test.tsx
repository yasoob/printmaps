import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { ElevationProfileSession } from '../../src/app/elevation/ElevationProfileSession';
import { ElevationProfileRegistry } from '../../src/app/elevation/ElevationProfileRegistry';
import { ElevationProfileProvider } from '../../src/app/elevation/ElevationProfileProvider';
import { ElevationProfilePanel, RouteElevationProfilePanel } from '../../src/app/components/ElevationProfilePanel';
import { InspectorAccordion } from '../../src/app/components/PropertyControls';
import { ProjectStoreContext } from '../../src/app/projectStoreContext';
import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';
import type { ElevationProfile } from '../../src/elevation/profile';
import type { ProfileRouteBinding } from '../../src/app/elevation/profileSessionTypes';

const binding: ProfileRouteBinding = { coordinates: [[16, 48], [16.1, 48.1]], name: 'Our route', color: '#123456', kind: 'straight' };
const profile: ElevationProfile = {
  samples: [{ coordinate: [16, 48], distanceMeters: 0, elevationMeters: 100 }, { coordinate: [16.1, 48.1], distanceMeters: 1000, elevationMeters: 120 }],
  totalDistanceMeters: 1000, minimumElevationMeters: 100, maximumElevationMeters: 120,
  totalAscentMeters: 20, totalDescentMeters: 0, sourceLabel: 'Copernicus DEM GLO-90 via Open-Meteo',
};
function file(name = 'Local', text?: Promise<string>) {
  const contents = JSON.stringify({ type: 'Feature', properties: { name }, geometry: { type: 'LineString', coordinates: [[17, 49], [17.1, 49.1]] } });
  const value = new File([contents], `${name}.geojson`, { type: 'application/geo+json' });
  Object.defineProperty(value, 'text', { value: () => text ?? Promise.resolve(contents) });
  return { value, contents };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function model() {
  const loadProfile = vi.fn(async () => profile);
  return { session: new ElevationProfileSession(binding, { loadProfile }), loadProfile };
}
function controlledTerrain() {
  const fetch = vi.fn(async (url: string | URL | Request) => {
    const count = new URL(String(url)).searchParams.get('latitude')!.split(',').length;
    return Response.json({ elevation: Array.from({ length: count }, () => 150) }, { status: 200 });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
function project() {
  const document = createInitialProjectDocument();
  const route = document.layers.find((layer) => layer.type === 'route')!;
  document.layers.unshift({ ...route, id: 'second-route', name: 'Other route' });
  const store = createProjectStore(document);
  return { store, routeId: route.id };
}

describe('elevation profile session ownership', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('retains last-good data and raw invalid drafts during failed refresh, cancellation and subsequent success', async () => {
    const { session, loadProfile } = model();
    await session.generate();
    session.setSetting('units', 'imperial');
    session.setSetting('fontFamily', 'serif');
    session.setNumberDraft('fontSize', '60');
    session.setNumberDraft('printWidthMm', '220');
    session.setNumberDraft('fontSize', '');
    const settings = session.getSnapshot().settings;
    loadProfile.mockRejectedValueOnce(new Error('Terrain unavailable'));
    await session.generate();
    expect(session.getSnapshot()).toMatchObject({ profile, status: 'error', message: 'Terrain unavailable' });
    expect(session.getSnapshot().settings).toBe(settings);
    const pending = deferred<ElevationProfile>();
    loadProfile.mockReturnValueOnce(pending.promise);
    const request = session.generate();
    session.cancelTerrain();
    pending.resolve({ ...profile, maximumElevationMeters: 999 });
    await request;
    expect(session.getSnapshot()).toMatchObject({ profile, status: 'ready' });
    expect(session.getSnapshot().settings).toBe(settings);
    await session.generate();
    expect(session.getSnapshot().settings).toMatchObject({ units: 'imperial', fontFamily: 'serif', fontSize: 60, fontSizeDraft: '', printWidthMm: 220 });
  });

  it('commits a local source only after valid parsing and keeps a good profile on invalid or canceled file reads', async () => {
    const { session, loadProfile } = model();
    await session.generate();
    session.setNumberDraft('printWidthMm', '220');
    await session.chooseFile(file('Invalid', Promise.resolve('not json')).value);
    expect(session.getSnapshot().profile).toBe(profile);
    expect(session.getSnapshot().fileError).toBeTruthy();
    const zeroLength = JSON.stringify({ type: 'LineString', coordinates: [[17, 49], [17, 49]] });
    await session.chooseFile(file('Zero length', Promise.resolve(zeroLength)).value);
    expect(session.getSnapshot().profile).toBe(profile);
    expect(session.getSnapshot().fileError).toBeTruthy();
    const pending = deferred<string>();
    const reading = session.chooseFile(file('Pending', pending.promise).value);
    session.cancelFile();
    pending.resolve(file('Late').contents);
    await reading;
    expect(session.getSnapshot().localRoute).toBeNull();
    expect(session.getSnapshot().profile).toBe(profile);
    await session.chooseFile(file().value);
    expect(session.getSnapshot()).toMatchObject({ localRoute: { name: 'Local' }, profile: null, status: 'idle' });
    expect(session.getSnapshot().settings.printWidthMm).toBe(220);
    expect(loadProfile).toHaveBeenCalledTimes(1);
    await session.generate();
    expect(loadProfile).toHaveBeenLastCalledWith([[17, 49], [17.1, 49.1]], expect.anything());
    session.syncRoute({ ...binding, coordinates: [[18, 50], [18.1, 50.1]] });
    expect(session.getSnapshot().profile).toBe(profile);
    expect(session.getSnapshot().localRoute?.name).toBe('Local');
    session.useSelectedRoute();
    expect(session.getSnapshot().profile).toBeNull();
  });

  it('lets only the current read finish even when canceled File.text ignores its signal', async () => {
    const { session } = model();
    const old = deferred<string>(), next = deferred<string>();
    const first = session.chooseFile(file('Old', old.promise).value);
    const second = session.chooseFile(file('Next', next.promise).value);
    old.resolve(file('Old').contents); await first;
    expect(session.getSnapshot().readingFilename).toBe('Next.geojson');
    next.resolve(file('Next').contents); await second;
    expect(session.getSnapshot().localRoute?.name).toBe('Next');
  });

  it('ignores stale terrain completion and errors after source changes, preserving a newer job', async () => {
    const old = deferred<ElevationProfile>(), next = deferred<ElevationProfile>();
    const loadProfile = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const session = new ElevationProfileSession(binding, { loadProfile });
    const first = session.generate();
    session.syncRoute({ ...binding, coordinates: [[17, 49], [18, 50]] });
    const second = session.generate();
    old.reject(new Error('Obsolete error')); await first;
    expect(session.getSnapshot()).toMatchObject({ status: 'loading', profile: null, message: undefined });
    next.resolve(profile); await second;
    expect(session.getSnapshot().profile).toBe(profile);
  });

  it('snapshots exports and suppresses obsolete PNG/PDF results and errors without clearing newer jobs', async () => {
    const old = deferred<Blob>(), next = deferred<Blob>();
    const createBlob = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const download = vi.fn();
    const session = new ElevationProfileSession(binding, { loadProfile: async () => profile, createBlob, download });
    await session.generate();
    session.setNumberDraft('printWidthMm', '220');
    const first = session.export('png');
    session.syncRoute({ ...binding, coordinates: [[17, 49], [18, 50]] });
    await session.generate();
    const second = session.export('pdf');
    old.reject(new Error('Obsolete raster error')); await first;
    expect(session.getSnapshot()).toMatchObject({ exporting: true, exportError: null });
    session.setNumberDraft('printWidthMm', '150');
    session.syncRoute({ ...session.getSnapshot().route, name: 'Renamed', color: '#ffffff' });
    next.resolve(new Blob(['pdf'])); await second;
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][1]).toBe('Our-route.elevation.pdf');
    expect(createBlob.mock.calls[1][3]).toMatchObject({ printWidthMm: 220, curveColor: '#123456' });
  });

  it('rejects direct export with invalid numeric drafts and contains download failures', async () => {
    const download = vi.fn(() => { throw new Error('Download unavailable'); });
    const createBlob = vi.fn(async () => new Blob(['svg']));
    const session = new ElevationProfileSession(binding, { loadProfile: async () => profile, createBlob, download });
    await session.generate();
    session.setNumberDraft('fontSize', '');
    await session.export('svg');
    expect(createBlob).not.toHaveBeenCalled();
    session.setNumberDraft('fontSize', '60');
    await session.export('svg');
    expect(session.getSnapshot()).toMatchObject({ profile, exporting: false, exportError: 'Download unavailable' });
  });

  it('retires pending exports on disposal and kind changes, without discarding a chosen local-file override', async () => {
    const pending = deferred<Blob>(), download = vi.fn();
    const session = new ElevationProfileSession(binding, { loadProfile: async () => profile, createBlob: () => pending.promise, download });
    await session.chooseFile(file().value);
    await session.generate();
    const exporting = session.export('png');
    session.syncRoute({ ...binding, coordinates: null, kind: 'arc' });
    expect(session.getSnapshot().localRoute?.name).toBe('Local');
    expect(session.getSnapshot().profile).toBeNull();
    pending.resolve(new Blob(['old png'])); await exporting;
    expect(download).not.toHaveBeenCalled();
    session.syncRoute(binding);
    await session.generate();
    const next = session.export('pdf');
    session.dispose();
    await next;
    expect(download).not.toHaveBeenCalled();
  });

  it('retains per-route models across selection, name/color edits and camera ticks, but invalidates geometry and Undo without a request', async () => {
    const fetch = controlledTerrain();
    const { store, routeId } = project();
    const registry = new ElevationProfileRegistry(store), detach = registry.attach();
    const session = registry.get(routeId, 0)!;
    await session.generate();
    const data = session.getSnapshot().profile;
    const before = store.getState();
    session.setNumberDraft('printWidthMm', '220');
    expect(store.getState()).toBe(before);
    store.getState().selectLayer('second-route');
    store.getState().renameLayer(routeId, 'Renamed route');
    const route = store.getState().document.layers.find((layer) => layer.id === routeId)!;
    if (route.appearance?.kind !== 'route') throw new Error('Expected the route appearance fixture');
    store.getState().setLayerAppearance(routeId, { ...route.appearance, color: '#ffffff' });
    expect(session.getSnapshot().profile).toBe(data);
    const snapshot = session.getSnapshot();
    store.getState().setCameraBearing(15);
    expect(session.getSnapshot()).toBe(snapshot);
    expect(registry.get(routeId, 0)).toBe(session);
    expect(registry.get('second-route', 0)!.getSnapshot().settings.printWidthMm).toBe(150);
    store.getState().setRouteVertex(routeId, 1, [16.4, 48.3]);
    expect(session.getSnapshot().profile).toBeNull();
    store.getState().undo();
    expect(session.getSnapshot().profile).toBeNull();
    expect(session.getSnapshot().settings.printWidthMm).toBe(220);
    expect(fetch).toHaveBeenCalledTimes(1);
    detach();
  });

  it.each(['delete', 'epoch'] as const)('retires %s owners so late work cannot affect new models', async (change) => {
    const pending = deferred<Response>();
    const fetch = vi.fn().mockReturnValue(pending.promise);
    vi.stubGlobal('fetch', fetch);
    const { store, routeId } = project();
    const registry = new ElevationProfileRegistry(store), detach = registry.attach();
    const session = registry.get(routeId, 0)!;
    const request = session.generate();
    if (change === 'delete') store.getState().deleteLayer(routeId);
    else store.getState().openDocument(createInitialProjectDocument());
    pending.resolve(Response.json({ elevation: [100, 101] }));
    await request;
    expect(registry.get(routeId, 0)).toBeNull();
    expect(session.getSnapshot().profile).toBeNull();
    await session.generate();
    expect(fetch).toHaveBeenCalledTimes(1);
    detach();
  });
});

describe('elevation disclosure and navigation', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('preserves the original four settings, raw drafts and profile with no refetch, including StrictMode ownership', async () => {
    const fetch = controlledTerrain();
    const { store, routeId } = project();
    function Inspector() {
      const [selected, setSelected] = useState(routeId);
      return <>
        <button onClick={() => setSelected('second-route')}>Other route</button>
        <button onClick={() => setSelected(routeId)}>Original route</button>
        <InspectorAccordion title="Advanced" storageKey="elevation-test" isDefaultExpanded summary="Elevation">
          <RouteElevationProfilePanel routeId={selected} documentEpoch={0} />
        </InspectorAccordion>
      </>;
    }
    const user = userEvent.setup();
    const before = store.getState();
    render(<StrictMode><ProjectStoreContext value={store}><ElevationProfileProvider><Inspector /></ElevationProfileProvider></ProjectStoreContext></StrictMode>);
    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));
    await screen.findByRole('group', { name: 'Elevation summary' });
    await user.click(screen.getByRole('radio', { name: 'Imperial' }));
    fireEvent.change(screen.getByLabelText('Profile print width'), { target: { value: '220' } });
    fireEvent.change(screen.getByLabelText('Profile font size'), { target: { value: '60' } });
    await user.selectOptions(screen.getByLabelText('Profile font'), 'serif');
    await user.click(screen.getByRole('button', { name: 'Advanced' }));
    await user.click(screen.getByRole('button', { name: 'Advanced' }));
    await user.click(screen.getByRole('button', { name: 'Other route' }));
    expect(screen.queryByRole('group', { name: 'Elevation summary' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Original route' }));
    expect(screen.getByRole('radio', { name: 'Imperial' })).toBeChecked();
    expect(screen.getByLabelText('Profile print width')).toHaveValue(220);
    expect(screen.getByLabelText('Profile font size')).toHaveValue(60);
    expect(screen.getByLabelText('Profile font')).toHaveValue('serif');
    fireEvent.change(screen.getByLabelText('Profile font size'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Advanced' }));
    await user.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(screen.getByLabelText('Profile font size')).toHaveValue(null);
    expect(screen.getByRole('button', { name: 'Download elevation SVG' })).toBeDisabled();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(store.getState()).toBe(before);
  });

  it('lets explicit hidden requests finish and preserves settings while refreshing or failing', async () => {
    const pending = deferred<ElevationProfile>();
    const loadProfile = vi.fn().mockReturnValueOnce(pending.promise).mockRejectedValueOnce(new Error('Refresh failed'));
    const session = new ElevationProfileSession(binding, { loadProfile });
    const view = render(<ElevationProfilePanel model={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate elevation profile' }));
    view.rerender(<div>Disclosure hidden</div>);
    await act(async () => pending.resolve(profile));
    view.rerender(<ElevationProfilePanel model={session} />);
    fireEvent.change(screen.getByLabelText('Profile print width'), { target: { value: '220' } });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh elevation profile' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Refresh failed'));
    expect(screen.getByRole('img', { name: 'Our route elevation profile' })).toBeVisible();
    expect(screen.getByLabelText('Profile print width')).toHaveValue(220);
  });
});
