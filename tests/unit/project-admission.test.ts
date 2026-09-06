import { createProjectStore, type ProjectState } from '../../src/app/store';
import { createDefaultLayerAppearance, createDefaultRouteAppearance, createNewProjectDocument, type ContentLayer, type ProjectDocument } from '../../src/domain/project';
import { parseProjectFileText } from '../../src/domain/projectFile';
import * as geometryParser from '../../src/domain/projectGeometry';
import { createArcGeometry } from '../../src/domain/routeArcGeometry';
import { DEFAULT_ROUTE_AUTHORING_OPTIONS } from '../../src/domain/routeProfiles';
import { parseMapDataFiles } from '../../src/import/mapDataBatch';
import { AutosavePersistenceSession } from '../../src/storage/AutosavePersistenceSession';
import type { AutosaveRepository } from '../../src/storage/autosave';

const triangle = [[0, 0], [1, 0], [0, 1]] as const;
const polygon = { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] as [number, number][][] };
const roadOptions = { ...DEFAULT_ROUTE_AUTHORING_OPTIONS, lineShape: 'road' as const, roadTravelMode: 'car' as const };
const roadInput = { geometry: [[0, 0], [1, 1]] as [number, number][], waypoints: [[0, 0], [1, 1]] as [number, number][], profile: 'driving' as const, distanceMeters: 100, durationSeconds: 10 };

function poi(id: string): ContentLayer {
  return { id, name: id, type: 'poi', visible: true, locked: false, opacity: 100, appearance: createDefaultLayerAppearance('poi'), geometry: { type: 'Point', coordinates: [0, 0] } };
}

function route(): ContentLayer {
  return { id: 'editable-route', name: 'Route', type: 'route', route: { kind: 'straight', closed: false }, visible: true, locked: false, opacity: 100, appearance: createDefaultRouteAppearance(1), geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } };
}

function shape(): ContentLayer {
  return { id: 'editable-shape', name: 'Area', type: 'shape', visible: true, locked: false, opacity: 100, appearance: createDefaultLayerAppearance('shape'), geometry: structuredClone(polygon) };
}

function fullLayers(): ProjectDocument {
  const document = createNewProjectDocument();
  document.layers.unshift(...Array.from({ length: 999 }, (_, index) => poi(`existing-${index}`)));
  return document;
}

function fullPositions(extras: ContentLayer[] = [], remaining = 0): ProjectDocument {
  const document = createNewProjectDocument();
  const anchors = Array.from({ length: 8333 }, (_, index) => [index / 1000, 48] as [number, number]);
  const geometry = createArcGeometry(anchors);
  if (!geometry) throw new Error('Invalid Arc fixture.');
  const arc: ContentLayer = { id: 'budget-arc', name: 'Budget Arc', type: 'route', route: { kind: 'arc', closed: false }, visible: true, locked: false, opacity: 100, geometry, appearance: createDefaultRouteAppearance(8332) };
  document.layers.unshift(arc, ...extras);
  const extraPositions = extras.reduce((total, layer) => total + geometryParser.projectLayerPositionCount(layer), 0);
  // 8,333 anchors + 8,332 × 23 sampled positions = 199,969.
  document.layers.splice(-1, 0, ...Array.from({ length: 31 - extraPositions - remaining }, (_, index) => poi(`filler-${index}`)));
  expect(() => parseProjectFileText(JSON.stringify(document))).not.toThrow();
  return document;
}

const additions: [string, (state: ProjectState) => { ok: boolean }][] = [
  ['point', (state) => state.createPoi([2, 2])],
  ['spreadsheet', (state) => state.createPoiBatch([{ name: 'Added', coordinates: [2, 2] }], state.documentEpoch)],
  ['searched point', (state) => state.createSearchPoi({ coordinate: [2, 2], label: 'Added', providerFeatureId: 'place.added' }, state.documentEpoch)],
  ['straight route', (state) => state.createRoute([[2, 2], [3, 3]])],
  ['Arc route', (state) => state.createRoute([[2, 2], [3, 3]], { ...DEFAULT_ROUTE_AUTHORING_OPTIONS, lineShape: 'arc' })],
  ['road route', (state) => state.createDirectionsRoute(roadInput, roadOptions, state.documentEpoch)],
  ['custom area', (state) => state.createShape(triangle)],
  ['administrative area', (state) => state.createAdministrativeArea({ id: 'test', name: 'Test boundary', countryCode: 'TST', source: 'test', level: 'country', geometry: polygon })],
  ['travel-time area', (state) => state.createIsochroneArea({ center: [0, 0], geometry: polygon, label: '15 min walking area', minutes: 15, profile: 'walking' }, state.documentEpoch)],
  ['duplicate', (state) => state.duplicateLayer(state.document.layers[0].id)],
  ['import', (state) => state.importLayers([poi('incoming')], state.documentEpoch, state.document)],
];

describe('canonical project admission', () => {
  it('rejects the fourth 300-row batch atomically and accepts the remaining 99 slots', () => {
    const store = createProjectStore();
    const rows = Array.from({ length: 300 }, (_, index) => ({ name: `POI ${index}`, coordinates: [0, 0] as [number, number] }));
    for (const count of [301, 601, 901]) {
      expect(store.getState().createPoiBatch(rows)).toMatchObject({ ok: true });
      expect(store.getState().document.layers).toHaveLength(count);
    }
    const previous = store.getState();
    const changed = vi.fn();
    const unsubscribe = store.subscribe(changed);
    expect(previous.createPoiBatch(rows)).toMatchObject({ ok: false, code: 'capacity', error: expect.stringContaining('99 more layers') });
    expect(store.getState()).toBe(previous);
    expect(changed).not.toHaveBeenCalled();
    expect(previous.createPoiBatch(rows.slice(0, 99))).toMatchObject({ ok: true });
    expect(store.getState().document.layers).toHaveLength(1000);
    expect(() => parseProjectFileText(JSON.stringify(store.getState().document))).not.toThrow();
    store.getState().undo();
    expect(store.getState().document.layers).toHaveLength(901);
    unsubscribe();
  });

  it.each(additions)('rejects %s at the layer boundary without changing any state references', (_label, add) => {
    const store = createProjectStore(fullLayers());
    store.getState().renameLayer('existing-0', 'Changed');
    store.getState().undo();
    const previous = store.getState();
    expect(add(previous)).toMatchObject({ ok: false });
    expect(store.getState()).toBe(previous);
    expect(store.getState().document).toBe(previous.document);
    expect(store.getState().past).toBe(previous.past);
    expect(store.getState().future).toBe(previous.future);
    expect(store.getState().selectedId).toBe(previous.selectedId);
  });

  it.each(additions)('rejects %s at the exact aggregate position boundary', (_label, add) => {
    const store = createProjectStore(fullPositions());
    const previous = store.getState();
    expect(add(previous)).toMatchObject({ ok: false });
    expect(store.getState()).toBe(previous);
  });

  it('accepts exactly 200,000 positions and rejects one more', () => {
    const store = createProjectStore(fullPositions([], 1));
    expect(store.getState().createPoi([3, 3])).toMatchObject({ ok: true });
    expect(() => parseProjectFileText(JSON.stringify(store.getState().document))).not.toThrow();
    const previous = store.getState();
    expect(previous.createPoi([4, 4])).toMatchObject({ ok: false });
    expect(store.getState()).toBe(previous);
  });

  it.each(['x'.repeat(201), '😀'.repeat(100) + 'x'])('rejects an overlong entered name without a history or selection change', (name) => {
    const store = createProjectStore();
    const previous = store.getState();
    expect(previous.renameLayer('basemap', name)).toMatchObject({ ok: false });
    expect(store.getState()).toBe(previous);
    expect(previous.renameLayer('basemap', name.slice(0, 200))).toMatchObject({ ok: true });
    expect(() => parseProjectFileText(JSON.stringify(store.getState().document))).not.toThrow();
  });

  it('bounds generated copy names and IDs, including repeated collisions', () => {
    const document = createNewProjectDocument();
    document.layers.unshift({ ...poi('x'.repeat(200)), name: '😀'.repeat(100) });
    const store = createProjectStore(document);
    for (let index = 0; index < 3; index += 1) expect(store.getState().duplicateLayer(document.layers[0].id)).toMatchObject({ ok: true });
    const next = store.getState().document;
    expect(new Set(next.layers.map(({ id }) => id)).size).toBe(next.layers.length);
    expect(next.layers.every(({ id, name }) => id.length <= 200 && name.length <= 200)).toBe(true);
    expect(next.layers[0].name).toBe(document.layers[0].name);
    expect(() => parseProjectFileText(JSON.stringify(next))).not.toThrow();
  });

  it('admits changed geometry only when its resulting aggregate budget fits', () => {
    const store = createProjectStore(fullPositions([route(), shape()]));
    const previous = store.getState();
    const layer = previous.document.layers.find(({ id }) => id === 'editable-route')!;
    const failures = [
      () => previous.insertRouteVertex(layer.id, 0),
      () => previous.replaceRouteGeometry(layer.id, [[0, 0], [0.5, 0.5], [1, 1]]),
      () => previous.replaceAuthoredRoute(layer.id, { type: 'LineString', coordinates: [[0, 0], [0.5, 0.5], [1, 1]] }, null, layer),
      () => previous.replaceRouteDraft({ id: layer.id, expectedLayer: layer, expectedDocumentEpoch: 0, points: [[0, 0], [0.5, 0.5], [1, 1]], travelMarker: null }),
      () => previous.transformRoute({ id: layer.id, expectedLayer: layer, expectedDocumentEpoch: 0, operation: { type: 'convert', targetKind: 'arc' } }),
      () => previous.setShapeGeometry('editable-shape', { type: 'Polygon', coordinates: [[[0, 0], [0.5, 0], [1, 0], [0, 1], [0, 0]]] }),
      () => previous.replaceLayerFromImport(layer.id, { ...route(), geometry: { type: 'LineString', coordinates: [[0, 0], [0.5, 0.5], [1, 1]] } }, 0, previous.document),
      () => previous.applyMapMatching(layer.id, { geometry: [[0, 0], [0.5, 0.5], [1, 1]], sourcePointCount: 2, profile: 'driving' }, 0),
    ];
    for (const mutate of failures) {
      expect(mutate()).toMatchObject({ ok: false });
      expect(store.getState()).toBe(previous);
    }
    expect(previous.setRouteVertex(layer.id, 1, [2, 2])).toMatchObject({ ok: true });
    expect(() => parseProjectFileText(JSON.stringify(store.getState().document))).not.toThrow();
  });

  it('counts Directions waypoints and isochrone centres in import preflight', async () => {
    const road: ContentLayer = { ...route(), route: { kind: 'road', closed: false }, provenance: { provider: 'mapbox', service: 'directions-v5', ...roadInput } };
    const area: ContentLayer = { ...shape(), provenance: { provider: 'mapbox', service: 'isochrone-v1', center: [0, 0], profile: 'walking', minutes: 15 } };
    const document = fullPositions([road, area]);
    const text = JSON.stringify({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [2, 2] } });
    const file = new File([], 'point.geojson');
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(text) });
    await expect(parseMapDataFiles([file], document.layers)).rejects.toThrow('200,000 positions');
    const store = createProjectStore(document);
    const previous = store.getState();
    const expectedLayer = previous.document.layers.find(({ id }) => id === road.id)!;
    expect(previous.replaceDirectionsRoute({ id: road.id, expectedLayer, expectedDocumentEpoch: 0, options: roadOptions, input: { ...roadInput, geometry: [[0, 0], [0.5, 0.5], [1, 1]] } })).toMatchObject({ ok: false });
    expect(store.getState()).toBe(previous);
  });

  it('uses cached immutable content validation for camera ticks and layer renames', () => {
    const store = createProjectStore(fullPositions());
    const parseGeometry = vi.spyOn(geometryParser, 'parseLayerGeometry');
    const stringify = vi.spyOn(JSON, 'stringify');
    for (let index = 1; index <= 20; index += 1) store.getState().setCameraViewport([16 + index / 100, 48], 10, 'amend');
    store.getState().renameLayer('budget-arc', 'Renamed Arc');
    expect(parseGeometry).not.toHaveBeenCalled();
    expect(stringify).not.toHaveBeenCalled();
    parseGeometry.mockRestore();
    stringify.mockRestore();
  });

  it('reports unchanged geometry as an unchanged success without history or store notifications', () => {
    const document = createNewProjectDocument();
    document.layers.unshift(route(), shape());
    const store = createProjectStore(document);
    const previous = store.getState();
    expect(previous.setRouteVertex('editable-route', 1, [1, 1])).toEqual({ ok: true, changed: false });
    expect(previous.replaceRouteGeometry('editable-route', [[0, 0], [1, 1]])).toEqual({ ok: true, changed: false });
    expect(previous.setShapeVertex('editable-shape', 0, 1, [1, 0])).toEqual({ ok: true, changed: false });
    expect(previous.setShapeGeometry('editable-shape', structuredClone(polygon))).toEqual({ ok: true, changed: false });
    expect(store.getState()).toBe(previous);
  });

  it('does not schedule autosave when admission rejects an operation', async () => {
    vi.useFakeTimers();
    const store = createProjectStore(fullLayers());
    const save = vi.fn().mockResolvedValue(undefined);
    const onSaveStarted = vi.fn();
    const session = new AutosavePersistenceSession({
      store, repository: { save, close: vi.fn() } as unknown as AutosaveRepository,
      onSaveStarted, onSaveSucceeded: vi.fn(), onSaveFailed: vi.fn(),
    });
    const stop = session.start();
    store.getState().setProjectTitle('Saved project');
    await vi.advanceTimersByTimeAsync(300);
    expect(save).toHaveBeenCalledTimes(1);
    store.getState().createPoi([2, 2]);
    store.getState().renameLayer('existing-0', 'x'.repeat(201));
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(onSaveStarted).toHaveBeenCalledTimes(1);
    stop();
    vi.useRealTimers();
  });
});
