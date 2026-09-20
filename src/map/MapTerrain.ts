import type { Map as MapLibreMap } from 'maplibre-gl';
import type { TerrainSettings } from '../domain/studio';
import { contourTileUrl } from '../terrain/contourWorkerMessages';
import { retainContourProtocol } from '../terrain/contourProtocol';
import { MAX_DEM_ZOOM, TERRAIN_ATTRIBUTION_HTML, TERRAIN_TILE_URL } from '../terrain/demTiles';

export const TERRAIN_SOURCE_ID = 'pms-terrain-dem';
export const CONTOUR_SOURCE_ID = 'pms-terrain-contours';
export const CONTOUR_LAYER_ID = 'pms-terrain-contour-lines';
export const BUILDING_LAYER_ID = 'pms-terrain-buildings';
type TerrainMap = Pick<MapLibreMap, 'getStyle' | 'getSource' | 'getLayer' | 'addSource' | 'removeSource' | 'addLayer' | 'removeLayer' | 'setPaintProperty' | 'setLayoutProperty' | 'setTerrain' | 'on' | 'off'>;

function insertionPoint(map: TerrainMap): string | undefined {
  return map.getStyle().layers.find((layer) => layer.type === 'symbol' || layer.id.startsWith('studio-layer-'))?.id;
}

function applyBuildings(map: TerrainMap, settings: TerrainSettings['buildings'], isVisible: boolean): void {
  if (!settings.enabled) {
    if (map.getLayer(BUILDING_LAYER_ID)) map.removeLayer(BUILDING_LAYER_ID);
    return;
  }
  if (!map.getLayer(BUILDING_LAYER_ID)) {
    const building = map.getStyle().layers.find((layer) => 'source-layer' in layer && layer['source-layer'] === 'building' && 'source' in layer);
    if (!building || !('source' in building)) throw new Error('This basemap does not contain building heights for 3D buildings.');
    map.addLayer({
      id: BUILDING_LAYER_ID, type: 'fill-extrusion', source: building.source, 'source-layer': 'building',
      paint: { 'fill-extrusion-color': '#b9b4ab' },
    }, insertionPoint(map));
  }
  map.setPaintProperty(BUILDING_LAYER_ID, 'fill-extrusion-height', ['*', ['max', 0, ['to-number', ['coalesce', ['get', 'render_height'], ['get', 'height']], 0]], settings.exaggeration]);
  map.setPaintProperty(BUILDING_LAYER_ID, 'fill-extrusion-base', ['*', ['max', 0, ['to-number', ['coalesce', ['get', 'render_min_height'], ['get', 'min_height']], 0]], settings.exaggeration]);
  map.setPaintProperty(BUILDING_LAYER_ID, 'fill-extrusion-opacity', settings.opacity / 100);
  map.setLayoutProperty(BUILDING_LAYER_ID, 'visibility', isVisible ? 'visible' : 'none');
}

export function createMapTerrainController(map: TerrainMap, onError: (error: Error) => void) {
  let releaseContours: (() => void) | undefined;
  let interval: number | undefined;
  let terrainExaggeration: number | undefined;
  let last: { settings: TerrainSettings; basemapVisible: boolean; buildingsVisible: boolean } | undefined;
  let isRemoved = false;
  let isDisposed = false;

  const removeContours = () => {
    if (map.getLayer(CONTOUR_LAYER_ID)) map.removeLayer(CONTOUR_LAYER_ID);
    if (map.getSource(CONTOUR_SOURCE_ID)) map.removeSource(CONTOUR_SOURCE_ID);
    interval = undefined;
  };
  const applyContours = (settings: TerrainSettings['contours'], isVisible: boolean) => {
    if (!settings.enabled) {
      removeContours();
      releaseContours?.();
      releaseContours = undefined;
      return;
    }
    releaseContours ??= retainContourProtocol();
    if (interval !== settings.intervalMeters) removeContours();
    if (!map.getSource(CONTOUR_SOURCE_ID)) {
      map.addSource(CONTOUR_SOURCE_ID, {
        type: 'vector', tiles: [contourTileUrl(settings.intervalMeters)], minzoom: 5, maxzoom: 14,
        attribution: TERRAIN_ATTRIBUTION_HTML,
      });
      interval = settings.intervalMeters;
    }
    if (!map.getLayer(CONTOUR_LAYER_ID)) {
      map.addLayer({ id: CONTOUR_LAYER_ID, type: 'line', source: CONTOUR_SOURCE_ID, 'source-layer': 'contours' }, insertionPoint(map));
    }
    map.setPaintProperty(CONTOUR_LAYER_ID, 'line-color', settings.color);
    map.setPaintProperty(CONTOUR_LAYER_ID, 'line-width', ['case', ['>', ['get', 'level'], 0], settings.width * 1.6, settings.width]);
    map.setPaintProperty(CONTOUR_LAYER_ID, 'line-opacity', 0.75);
    map.setLayoutProperty(CONTOUR_LAYER_ID, 'visibility', isVisible ? 'visible' : 'none');
  };
  const apply = (settings: TerrainSettings, isBasemapVisible = true, areBuildingsVisible = true) => {
    if (isDisposed || isRemoved) return;
    last = { settings, basemapVisible: isBasemapVisible, buildingsVisible: areBuildingsVisible };
    if (settings.enabled) {
      const shouldAddSource = !map.getSource(TERRAIN_SOURCE_ID);
      if (shouldAddSource) map.addSource(TERRAIN_SOURCE_ID, {
          type: 'raster-dem', tiles: [TERRAIN_TILE_URL], encoding: 'terrarium', tileSize: 256, maxzoom: MAX_DEM_ZOOM,
          attribution: TERRAIN_ATTRIBUTION_HTML,
        });
      if (shouldAddSource || terrainExaggeration !== settings.exaggeration) map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: settings.exaggeration });
      terrainExaggeration = settings.exaggeration;
    } else if (map.getSource(TERRAIN_SOURCE_ID)) {
      map.setTerrain(null);
      map.removeSource(TERRAIN_SOURCE_ID);
      terrainExaggeration = undefined;
    }
    applyContours(settings.contours, isBasemapVisible);
    applyBuildings(map, settings.buildings, isBasemapVisible && areBuildingsVisible);
  };
  const styleLoad = () => {
    if (!last) return;
    try {
      apply(last.settings, last.basemapVisible, last.buildingsVisible);
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Terrain could not be applied to this map style.'));
    }
  };
  const remove = () => {
    isRemoved = true;
    releaseContours?.();
    releaseContours = undefined;
  };
  map.on('style.load', styleLoad);
  map.on('remove', remove);
  return {
    apply,
    dispose: () => {
      isDisposed = true;
      map.off('style.load', styleLoad);
      map.off('remove', remove);
      releaseContours?.();
      releaseContours = undefined;
    },
  };
}
