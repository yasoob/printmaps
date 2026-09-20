import type { LayerSpecification, SourceSpecification, StyleSpecification } from 'maplibre-gl';
import { createDefaultStudioSettings } from '../../src/domain/studio';
import { createMapTerrainController, TERRAIN_SOURCE_ID, CONTOUR_SOURCE_ID, CONTOUR_LAYER_ID, BUILDING_LAYER_ID } from '../../src/map/MapTerrain';
import { projectAttributions } from '../../src/domain/projectAttributions';

const protocol = vi.hoisted(() => ({ retain: vi.fn(), release: vi.fn() }));
vi.mock('../../src/terrain/contourProtocol', () => ({ retainContourProtocol: protocol.retain }));

function mapMock() {
  const style: StyleSpecification = { version: 8, sources: { base: { type: 'vector', tiles: ['https://example.test/{z}/{x}/{y}'] } }, layers: [
    { id: 'background', type: 'background' },
    { id: 'building', type: 'fill', source: 'base', 'source-layer': 'building' },
    { id: 'labels', type: 'symbol', source: 'base' },
    { id: 'studio-layer-route', type: 'line', source: 'base' },
  ] };
  const handlers = new Map<string, (() => void)[]>();
  return {
    style,
    handlers,
    getStyle: () => style,
    getSource: (id: string) => style.sources[id],
    getLayer: (id: string) => style.layers.find((layer) => layer.id === id),
    addSource: vi.fn((id: string, source: SourceSpecification) => { style.sources[id] = source; }),
    removeSource: vi.fn((id: string) => { delete style.sources[id]; }),
    addLayer: vi.fn((layer: LayerSpecification, before?: string) => { style.layers.splice(before ? style.layers.findIndex((existing) => existing.id === before) : style.layers.length, 0, layer); }),
    removeLayer: vi.fn((id: string) => { style.layers = style.layers.filter((layer) => layer.id !== id); }),
    setTerrain: vi.fn((terrain: StyleSpecification['terrain'] | null) => { style.terrain = terrain ?? undefined; }),
    setPaintProperty: vi.fn(),
    setLayoutProperty: vi.fn(),
    on: vi.fn((event: string, callback: () => void) => { handlers.set(event, [...(handlers.get(event) ?? []), callback]); }),
    off: vi.fn((event: string, callback: () => void) => { handlers.set(event, (handlers.get(event) ?? []).filter((handler) => handler !== callback)); }),
  };
}

// The adapter uses this public subset; MapLibre's overload return types are not needed by the fixture.
function controllerFor(map: ReturnType<typeof mapMock>, onError = vi.fn()) {
  return createMapTerrainController(map as unknown as Parameters<typeof createMapTerrainController>[0], onError);
}

function emit(map: ReturnType<typeof mapMock>, event: string) {
  const callbacks = map.handlers.get(event) ?? [];
  for (const callback of callbacks) callback();
}

beforeEach(() => {
  vi.clearAllMocks();
  protocol.retain.mockReturnValue(protocol.release);
});

it('does nothing to existing map sources and ordering by default', () => {
  const map = mapMock();
  const controller = controllerFor(map);
  controller.apply(createDefaultStudioSettings().terrain);
  expect(map.addSource).not.toHaveBeenCalled();
  expect(map.addLayer).not.toHaveBeenCalled();
  expect(map.setTerrain).not.toHaveBeenCalled();
  expect(protocol.retain).not.toHaveBeenCalled();
  controller.dispose();
});

it('applies Terrarium terrain and real contour vector tiles below labels and content', () => {
  const map = mapMock();
  const controller = controllerFor(map);
  const terrain = createDefaultStudioSettings().terrain;
  controller.apply({ ...terrain, enabled: true, exaggeration: 2, contours: { ...terrain.contours, enabled: true } });
  expect(map.setTerrain).toHaveBeenCalledWith({ source: TERRAIN_SOURCE_ID, exaggeration: 2 });
  expect(map.style.sources[TERRAIN_SOURCE_ID]).toMatchObject({ type: 'raster-dem', encoding: 'terrarium', tileSize: 256 });
  expect(map.style.sources[CONTOUR_SOURCE_ID]).toMatchObject({ type: 'vector', tiles: ['pms-contours://{z}/{x}/{y}?interval=100'] });
  expect(map.style.layers.map(({ id }) => id)).toEqual(['background', 'building', CONTOUR_LAYER_ID, 'labels', 'studio-layer-route']);
  expect(protocol.retain).toHaveBeenCalledTimes(1);
  controller.apply({ ...terrain, contours: { ...terrain.contours, enabled: true, intervalMeters: 200 } }, false);
  expect(map.setTerrain).toHaveBeenLastCalledWith(null);
  expect(map.style.sources[TERRAIN_SOURCE_ID]).toBeUndefined();
  expect(map.setLayoutProperty).toHaveBeenCalledWith(CONTOUR_LAYER_ID, 'visibility', 'none');
  expect(map.style.sources[CONTOUR_SOURCE_ID]).toMatchObject({ tiles: ['pms-contours://{z}/{x}/{y}?interval=200'] });
  controller.apply(terrain);
  expect(map.style.sources[CONTOUR_SOURCE_ID]).toBeUndefined();
  expect(protocol.release).toHaveBeenCalledTimes(1);
  controller.dispose();
});

it('reapplies settings after style resets and releases listeners and protocol ownership on map removal', () => {
  const map = mapMock();
  const controller = controllerFor(map);
  const terrain = createDefaultStudioSettings().terrain;
  controller.apply({ ...terrain, enabled: true, contours: { ...terrain.contours, enabled: true } });
  map.style.sources = {};
  map.style.layers = [];
  emit(map, 'style.load');
  expect(map.style.sources[TERRAIN_SOURCE_ID]).toBeDefined();
  expect(map.style.sources[CONTOUR_SOURCE_ID]).toBeDefined();
  expect(protocol.retain).toHaveBeenCalledTimes(1);
  emit(map, 'remove');
  controller.dispose();
  expect(protocol.release).toHaveBeenCalledTimes(1);
  expect(map.handlers.get('style.load')).toEqual([]);
});

it('keeps building extrusion controlled, source-based and distinct from the STL renderer', () => {
  const map = mapMock();
  const controller = controllerFor(map);
  const terrain = createDefaultStudioSettings().terrain;
  controller.apply({ ...terrain, buildings: { ...terrain.buildings, enabled: true } });
  expect(map.style.layers.find(({ id }) => id === BUILDING_LAYER_ID)).toMatchObject({ type: 'fill-extrusion', source: 'base', 'source-layer': 'building' });
  expect(map.setTerrain).not.toHaveBeenCalled();
  controller.apply(terrain);
  expect(map.getLayer(BUILDING_LAYER_ID)).toBeUndefined();
  controller.dispose();
});

it('reports failed style restoration rather than silently omitting terrain', () => {
  const map = mapMock();
  const error = vi.fn();
  const controller = controllerFor(map, error);
  const terrain = { ...createDefaultStudioSettings().terrain, enabled: true };
  controller.apply(terrain);
  map.style.sources = {};
  map.setTerrain.mockImplementation(() => { throw new Error('WebGL lost'); });
  emit(map, 'style.load');
  expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'WebGL lost' }));
  controller.dispose();
});

it('adds accurate elevation credits only when terrain or contours are enabled', () => {
  const studio = createDefaultStudioSettings();
  expect(projectAttributions({ layers: [], studio })).toHaveLength(1);
  expect(projectAttributions({ layers: [], studio: { ...studio, terrain: { ...studio.terrain, enabled: true } } }).join(' ')).toContain('AWS Terrain Tiles');
  expect(projectAttributions({ layers: [], studio: { ...studio, terrain: { ...studio.terrain, contours: { ...studio.terrain.contours, enabled: true } } } }).join(' ')).toContain('USGS');
});
