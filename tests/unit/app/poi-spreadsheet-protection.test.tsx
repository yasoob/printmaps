import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import * as storeModule from '../../../src/app/store';
import { PoiSpreadsheetPanel } from '../../../src/app/components/PoiSpreadsheetPanel';
import type { SearchProvider, SearchResponse } from '../../../src/services/mapbox/contracts';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

async function openList() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Place (P)' }));
  await user.click(screen.getByRole('button', { name: 'Paste POI list' }));
  return user;
}

describe('unadded POI list protection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps one draft owner across short-viewport modal transitions and safely cancels its nested discard decision', async () => {
    let isShort = true;
    const listeners = new Set<() => void>();
    vi.stubGlobal('matchMedia', () => ({
      matches: isShort,
      addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
    }));
    const onCancel = vi.fn();
    render(<PoiSpreadsheetPanel documentEpoch={0} onCancel={onCancel} onComplete={vi.fn()} onSubmit={vi.fn()} />);
    const user = userEvent.setup();
    const input = screen.getByRole('textbox', { name: 'POI spreadsheet rows' });
    fireEvent.change(input, { target: { value: 'Retained\t16.4\t48.2' } });
    expect(screen.getByRole('dialog', { name: 'POI list workspace' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel list' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Discard unadded POI lists?' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'POI list workspace' })).toBeInTheDocument();
    expect(input).toHaveValue('Retained\t16.4\t48.2');
    act(() => { isShort = false; listeners.forEach((listener) => listener()); });
    expect(screen.queryByRole('dialog', { name: 'POI list workspace' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'POI spreadsheet rows' })).toHaveValue('Retained\t16.4\t48.2');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('publishes one transient presence change, not document writes or per-keystroke store updates', async () => {
    const store = storeModule.createProjectStore();
    const factory = vi.spyOn(storeModule, 'createProjectStore').mockReturnValueOnce(store);
    const save = vi.fn().mockResolvedValue(undefined);
    render(<App autosaveRepository={{ load: vi.fn().mockResolvedValue(null), save, discard: vi.fn(), close: vi.fn() }} />);
    factory.mockRestore();
    await openList();
    const before = store.getState();
    const changes = vi.fn();
    const unsubscribe = store.subscribe(changes);
    const input = screen.getByRole('textbox', { name: 'POI spreadsheet rows' });
    fireEvent.change(input, { target: { value: 'A' } });
    fireEvent.change(input, { target: { value: 'An unadded coordinate list' } });
    fireEvent.change(input, { target: { value: 'A correctable unadded coordinate list' } });
    expect(changes).toHaveBeenCalledTimes(1);
    expect(store.getState().hasUnfinishedDrawing).toBe(true);
    expect(store.getState().document).toBe(before.document);
    expect(store.getState().past).toBe(before.past);
    expect(store.getState().future).toBe(before.future);
    expect(store.getState().selectedId).toBe(before.selectedId);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    expect(screen.getByRole('status', { name: 'Unfinished POI lists' })).toHaveTextContent('not saved or downloaded');
    expect(screen.getByRole('status', { name: 'Autosave status' })).toHaveTextContent('Unfinished work not saved');
    expect(save).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('keeps both lists on cancel, blocks background shortcuts, then explicitly discards before switching tools', async () => {
    render(<App autosaveRepository={null} />);
    const user = await openList();
    const input = screen.getByRole('textbox', { name: 'POI spreadsheet rows' });
    fireEvent.change(input, { target: { value: 'Coordinate\t16.4\t48.2' } });
    await user.click(screen.getByRole('radio', { name: 'Addresses' }));
    fireEvent.change(input, { target: { value: 'Address\tVienna' } });
    await user.click(screen.getByRole('button', { name: 'Cancel list' }));
    const dialog = screen.getByRole('dialog', { name: 'Discard unadded POI lists?' });
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Keep editing lists' })).toHaveFocus());
    fireEvent.keyDown(document.body, { key: 'r' });
    fireEvent.keyDown(document.body, { key: 'Delete' });
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(dialog).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing lists' }));
    expect(input).toHaveValue('Address\tVienna');
    await user.click(screen.getByRole('radio', { name: 'Coordinates' }));
    expect(input).toHaveValue('Coordinate\t16.4\t48.2');
    await user.click(screen.getByRole('button', { name: 'Select (V)' }));
    await user.click(screen.getByRole('button', { name: 'Discard lists' }));
    expect(screen.queryByRole('form', { name: 'Place multiple points' })).toBeNull();
    await openList();
    expect(screen.getByRole('textbox', { name: 'POI spreadsheet rows' })).toHaveValue('');
  });

  it('pauses on a close decision and never reopens or auto-adds after a provider ignores cancellation', async () => {
    let finish!: (response: SearchResponse) => void;
    const search = vi.fn<SearchProvider['search']>(() => new Promise((resolve) => { finish = resolve; }));
    render(<App autosaveRepository={null} searchProvider={{ search }} />);
    const user = await openList();
    await user.click(screen.getByRole('radio', { name: 'Addresses' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'POI spreadsheet rows' }), { target: { value: 'Unadded café\tVienna' } });
    await user.click(screen.getByRole('button', { name: 'Look up addresses' }));
    await user.click(screen.getByRole('button', { name: 'Close POI list' }));
    expect(search.mock.calls[0][0].signal?.aborted).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Keep editing lists' }));
    expect(within(screen.getByRole('list', { name: 'Reviewed address rows' })).getByText(/Lookup stopped/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel list' }));
    await user.click(screen.getByRole('button', { name: 'Discard lists' }));
    await act(async () => finish({ results: [{ label: 'Late Vienna', providerFeatureId: 'address.late', center: [16.3, 48.2] }], useBoundary: 'provider-response-use-requires-terms-review' }));
    expect(screen.queryByText('Late Vienna')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Select Unadded café' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Paste POI list' })).toHaveFocus();
    expect(search).toHaveBeenCalledTimes(1);
  });
});
