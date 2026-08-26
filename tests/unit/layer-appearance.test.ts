import { readFileSync } from 'node:fs';
import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument, type ContentLayer } from '../../src/domain/project';
import { parseGpxText, parseKmlText } from '../../src/import/gpxKml';
import { parseGeoJsonText } from '../../src/import/geojson';
import { mapLayerDescriptors } from '../../src/map/MapContentLayerRendering';

const geoJsonFixture = readFileSync('tests/fixtures/import/supported.geojson', 'utf8');
const gpxFixture = readFileSync('tests/fixtures/import/wave2/namespaced.gpx', 'utf8');
const kmlFixture = readFileSync('tests/fixtures/import/wave2/namespaced.kml', 'utf8');
const highlight = { selectedId: null, previewedId: null };

function layer(type: ContentLayer['type'], appearance: ContentLayer['appearance']): ContentLayer {
  let geometry: NonNullable<ContentLayer['geometry']>;
  if (type === 'route') {
    geometry = { type: 'LineString', coordinates: [[0, 0], [1, 1]] };
  } else if (type === 'poi') {
    geometry = { type: 'Point', coordinates: [1, 1] };
  } else {
    geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
  }
  return {
    id: type,
    name: type,
    type,
    appearance,
    geometry,
    visible: true,
    locked: false,
    opacity: 100,
  };
}

describe('canonical layer appearance', () => {
  it('canonicalizes appearance colors before deciding whether to create history', () => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().setLayerAppearance('route-01', {
      kind: 'route', color: '#D9363E', width: 4, travelProfile: 'car', showTravelModeIcon: false,
    });

    expect(store.getState().document.layers[0].appearance).toEqual({
      kind: 'route', color: '#d9363e', width: 4, travelProfile: 'car', showTravelModeIcon: false,
    });
    expect(store.getState().canUndo).toBe(false);
  });

  it('assigns editable appearances to every local import format', () => {
    expect(parseGeoJsonText(geoJsonFixture).map(({ appearance }) => appearance)).toEqual([
      { kind: 'poi', color: '#0d78b5', size: 14, markerShape: 'circle', markerSymbol: 'none', label: '', customAssetId: null },
      { kind: 'route', color: '#d9363e', width: 4, travelProfile: 'car', showTravelModeIcon: false },
      { kind: 'shape', fillColor: '#d18b25', strokeColor: '#d18b25', strokeWidth: 2, invert: false },
    ]);
    expect(parseGpxText(gpxFixture).map(({ appearance }) => appearance)).toEqual([
      { kind: 'poi', color: '#0d78b5', size: 14, markerShape: 'circle', markerSymbol: 'none', label: '', customAssetId: null },
      { kind: 'route', color: '#d9363e', width: 4, travelProfile: 'car', showTravelModeIcon: false },
      { kind: 'route', color: '#d9363e', width: 4, travelProfile: 'car', showTravelModeIcon: false },
    ]);
    expect(parseKmlText(kmlFixture).map(({ appearance }) => appearance)).toEqual([
      { kind: 'poi', color: '#0d78b5', size: 14, markerShape: 'circle', markerSymbol: 'none', label: '', customAssetId: null },
      { kind: 'route', color: '#d9363e', width: 4, travelProfile: 'car', showTravelModeIcon: false },
      { kind: 'shape', fillColor: '#d18b25', strokeColor: '#d18b25', strokeWidth: 2, invert: false },
    ]);
  });

  it('maps canonical appearance to live MapLibre paint descriptors', () => {
    const route = mapLayerDescriptors(
      layer('route', {
        kind: 'route', color: '#112233', width: 8, travelProfile: 'car', showTravelModeIcon: false,
      }),
      highlight,
    );
    const poi = mapLayerDescriptors(
      layer('poi', {
        kind: 'poi', color: '#445566', size: 24, markerShape: 'circle', markerSymbol: 'none', label: '',
      }),
      highlight,
    );
    const shape = mapLayerDescriptors(layer('shape', {
      kind: 'shape', fillColor: '#abcdef', strokeColor: '#123456', strokeWidth: 5, invert: false,
    }), highlight);

    expect(route[0].paint).toMatchObject({ 'line-color': '#112233', 'line-width': 8 });
    expect(poi[0].paint).toMatchObject({ 'circle-color': '#445566', 'circle-radius': 12 });
    expect(shape[0].paint).toMatchObject({ 'fill-color': '#abcdef' });
    expect(shape[2].paint).toMatchObject({ 'line-color': '#123456', 'line-width': 5 });
  });

  it('preserves configured feature colors while selection adds non-color emphasis', () => {
    const selected = { selectedId: 'shape', previewedId: null };
    const route = mapLayerDescriptors(layer('route', {
      kind: 'route', color: '#112233', width: 8, travelProfile: 'car', showTravelModeIcon: false,
    }), { selectedId: 'route', previewedId: null });
    const poi = mapLayerDescriptors(layer('poi', {
      kind: 'poi', color: '#445566', size: 24, markerShape: 'circle', markerSymbol: 'none', label: '',
    }), { selectedId: 'poi', previewedId: null });
    const shape = mapLayerDescriptors(layer('shape', {
      kind: 'shape', fillColor: '#abcdef', strokeColor: '#123456', strokeWidth: 5, invert: false,
    }), selected);

    expect(route[0].paint).toMatchObject({ 'line-color': '#112233', 'line-width': 10 });
    expect(poi[0].paint).toMatchObject({ 'circle-color': '#445566', 'circle-radius': 14 });
    expect(shape[0].paint).toMatchObject({ 'fill-color': '#abcdef' });
    expect(shape[1].paint).toMatchObject({ 'line-color': '#006fc9', 'line-opacity': 0 });
    expect(shape[2].paint).toMatchObject({ 'line-color': '#123456', 'line-width': 6 });
  });

  it('adds a visible hover halo beneath a shape without replacing its configured colors', () => {
    const shape = mapLayerDescriptors(layer('shape', {
      kind: 'shape', fillColor: '#abcdef', strokeColor: '#123456', strokeWidth: 5, invert: false,
    }), { selectedId: null, previewedId: 'shape' });

    expect(shape).toHaveLength(3);
    expect(shape[0].paint).toMatchObject({ 'fill-color': '#abcdef' });
    expect(shape[1].paint).toMatchObject({
      'line-color': '#006fc9',
      'line-opacity': 0.9,
      'line-width': 11,
    });
    expect(shape[2].paint).toMatchObject({ 'line-color': '#123456', 'line-width': 5 });
  });

  it('renders a POI marker shape, semantic symbol, and label as live map layers', () => {
    const descriptors = mapLayerDescriptors(layer('poi', {
      kind: 'poi',
      color: '#445566',
      size: 24,
      markerShape: 'diamond',
      markerSymbol: 'coffee',
      label: 'Café Central',
    }), highlight);

    expect(descriptors).toHaveLength(3);
    expect(descriptors[0]).toMatchObject({
      type: 'symbol',
      layout: { 'text-field': '◆', 'text-size': 30 },
      paint: { 'text-color': '#445566' },
    });
    expect(descriptors[1]).toMatchObject({
      type: 'symbol',
      layout: { 'text-field': 'C', 'text-size': 12 },
      paint: { 'text-color': '#ffffff' },
    });
    expect(descriptors[2]).toMatchObject({
      type: 'symbol',
      layout: { 'text-field': 'Café Central', 'text-offset': [0, 1.5] },
      paint: { 'text-color': '#1e1e1e' },
    });
  });
});
