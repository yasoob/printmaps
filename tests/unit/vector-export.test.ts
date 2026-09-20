import { readFileSync } from 'node:fs';
import { PbfWriter } from 'pbf';
import { PDFDocument, PDFName, PDFRawStream, PDFDict } from 'pdf-lib';
import type { MapRenderSnapshot } from '../../src/map/MapRenderSnapshot';
import { createInitialProjectDocument } from '../../src/domain/project';
import { captureVectorBasemap } from '../../src/export/vector/capture';
import { createVectorSvg } from '../../src/export/layeredSvg';
import { createVectorPrintPdf } from '../../src/export/printPdf';
import { activeVectorLayers, compileVectorLayer } from '../../src/export/vector/style';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { snapshotVectorProjection } from '../../src/export/vector/projection';
import { boundedVectorFetch } from '../../src/export/vector/tiles';

const fontBytes = readFileSync('node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff');
type TileFeature = { type: number; rings: number[][][]; name: string; id: number };
const zigzag = (value: number) => value < 0 ? -value * 2 - 1 : value * 2;

function tileBytes(placeName = 'Vienna'): Uint8Array<ArrayBuffer> {
  const writer = new PbfWriter();
  const geometry = (feature: TileFeature) => {
    const commands: number[] = [];
    let x = 0, y = 0;
    for (const ring of feature.rings) {
      for (let index = 0; index < ring.length; index++) {
        if (index === 0) commands.push(9);
        else if (index === 1) commands.push(((ring.length - 1) << 3) | 2);
        commands.push(zigzag(ring[index][0] - x), zigzag(ring[index][1] - y));
        [x, y] = ring[index];
      }
      if (feature.type === 3) commands.push(15);
    }
    return commands;
  };
  const features: TileFeature[] = [
    { id: 1, type: 3, name: 'Lake', rings: [[[500, 500], [3500, 500], [3500, 3500], [500, 3500]], [[1500, 1500], [1500, 2500], [2500, 2500], [2500, 1500]]] },
    { id: 2, type: 2, name: 'Main Road', rings: [[[200, 1200], [1800, 1300], [3900, 1200]]] },
    { id: 3, type: 1, name: placeName, rings: [[[2048, 2048]]] },
  ];
  writer.writeMessage(3, (_, layer) => {
    layer.writeVarintField(15, 2);
    layer.writeStringField(1, 'features');
    layer.writeVarintField(5, 4096);
    layer.writeStringField(3, 'name');
    for (const feature of features) {
      layer.writeMessage(4, (text, value) => value.writeStringField(1, text), feature.name);
      layer.writeMessage(2, (item, output) => {
        output.writeVarintField(1, item.id);
        output.writePackedVarint(2, [0, item.id - 1]);
        output.writeVarintField(3, item.type);
        output.writePackedVarint(4, geometry(item));
      }, feature);
    }
  }, undefined);
  return new Uint8Array(writer.finish());
}

function snapshot(): MapRenderSnapshot {
  return {
    style: {
      version: 8,
      sources: { tiles: { type: 'vector', tiles: ['https://example.test/{z}/{x}/{y}.pbf'], maxzoom: 0 } },
      layers: [
        { id: 'land', type: 'background', paint: { 'background-color': '#fafafa' } },
        { id: 'water', type: 'fill', source: 'tiles', 'source-layer': 'features', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#58a', 'fill-opacity': 0.5 } },
        { id: 'roads', type: 'line', source: 'tiles', 'source-layer': 'features', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 3, 5, 6], 'line-color': ['match', ['get', 'name'], 'Main Road', '#c00', '#000'] } },
        { id: 'road-label', type: 'symbol', source: 'tiles', 'source-layer': 'features', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'text-field': '{name}', 'text-size': 12, 'symbol-placement': 'line' } },
        { id: 'place-label', type: 'symbol', source: 'tiles', 'source-layer': 'features', filter: ['==', ['geometry-type'], 'Point'], layout: { 'text-field': ['get', 'name'], 'text-size': 18, 'icon-image': 'city-dot' } },
      ],
    },
    camera: { center: [0, 0], zoom: 0, bearing: 0, pitch: 0, roll: 0 },
    printCamera: { center: [0, 0], zoom: 0, bearing: 0, pitch: 0 },
    viewport: { width: 512, height: 512 }, frame: { x: 0, y: 0, width: 512, height: 512 },
    footprint: { corners: [[-179.99, 85], [179.99, 85], [179.99, -85], [-179.99, -85]], widthPx: 512, heightPx: 512, bearing: 0, pitch: 0 },
    referenceLongitude: 0, layers: [], assets: {},
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: URL | string) => new Response(
    new Uint8Array(String(url).includes('.woff') ? fontBytes : tileBytes()),
  )));
});
afterEach(() => vi.unstubAllGlobals());

it('captures tile geometry, polygon holes, filters, expressions, ordered clips and editable labels', async () => {
  const capture = await captureVectorBasemap(snapshot());
  const water = capture.scene.groups.find(({ layerId }) => layerId === 'water')!;
  expect(water.paths[0].rings).toHaveLength(2);
  expect(water.paths[0].fill?.[3]).toBe(0.5);
  const road = capture.scene.groups.find(({ layerId }) => layerId === 'roads')!;
  expect(road.paths[0].width).toBe(3);
  expect(road.paths[0].stroke).toEqual([0.8, 0, 0, 1]);
  expect(capture.scene.groups.flatMap((group) => group.texts ?? []).map(({ text }) => text)).toEqual(['Main Road', 'Vienna']);
  expect(capture.scene.groups.at(-1)?.paths.length).toBe(1);
  const project = createInitialProjectDocument();
  const svg = await createVectorSvg(project, capture).text();
  expect(svg).not.toContain('<image');
  expect(svg).toContain('fill-rule="evenodd"');
  expect(svg).toContain('aria-label="Main Road"');
  expect(svg).toContain('data:font/woff;base64,');
  expect(svg.indexOf('data-map-style-layer="water"')).toBeLessThan(svg.indexOf('data-map-style-layer="roads"'));
  expect(svg).toContain('reflowed');
  const pdf = await createVectorPrintPdf(project, capture);
  const parsed = await PDFDocument.load(await pdf.arrayBuffer());
  const streamObjects = parsed.context.enumerateIndirectObjects().map(([, object]) => object).filter((object) => object instanceof PDFRawStream);
  expect(streamObjects.some((stream) => stream.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'))).toBe(false);
  const form = streamObjects.find((stream) => stream.dict.get(PDFName.of('Subtype')) === PDFName.of('Form'))!;
  expect(form.dict.lookup(PDFName.of('Resources'), PDFDict).has(PDFName.of('Font'))).toBe(true);
  expect(new TextDecoder().decode(form.getContents())).toContain(' Tj');
  expect(new TextDecoder().decode(form.getContents())).toContain('f*');
  expect(parsed.getPage(0).getWidth()).toBeCloseTo(project.page.widthMm * 72 / 25.4);
});

it('compiles current Paper layers and evaluates meaningful road/place/shield text expressions', () => {
  const style = JSON.parse(readFileSync('public/styles/paper.json', 'utf8')) as StyleSpecification;
  const layers = activeVectorLayers(style, 13);
  for (const layer of layers) expect(() => compileVectorLayer(layer, 13)).not.toThrow();
  for (const [id, properties, expected] of [
    ['highway-name-major', { name: 'Ringstrasse' }, 'Ringstrasse'],
    ['label_city', { name: 'Vienna' }, 'Vienna'],
    ['highway-shield-non-us', { ref: 'A22', ref_length: 3 }, 'A22'],
  ] as const) {
    const layer = layers.find((candidate) => candidate.id === id)!;
    expect(compileVectorLayer(layer, 13).read('text-field', { type: 1, properties })?.toString()).toBe(expected);
  }
});

it.each(['raster', 'fill-extrusion', 'hillshade', 'heatmap'] as const)('explicitly rejects %s layers without fetching or fallback', async (type) => {
  const input = snapshot();
  input.style.layers.push({ id: 'unsupported', type, source: 'tiles' });
  await expect(captureVectorBasemap(input)).rejects.toThrow('Choose Hybrid');
  expect(fetch).not.toHaveBeenCalled();
});

it('rejects patterns, feature state and pitched/terrain/projection snapshots', async () => {
  const input = snapshot();
  input.style.layers.push({ id: 'pattern', type: 'fill', source: 'tiles', paint: { 'fill-pattern': 'grass' } });
  await expect(captureVectorBasemap(input)).rejects.toThrow('fill-pattern');
  input.style.layers.pop();
  input.style.layers.push({ id: 'state', type: 'fill', source: 'tiles', paint: { 'fill-opacity': ['number', ['feature-state', 'opacity'], 1] } });
  await expect(captureVectorBasemap(input)).rejects.toThrow('feature-state');
  expect(() => snapshotVectorProjection({ ...snapshot(), camera: { ...input.camera, pitch: 40 } })).toThrow('unpitched');
  expect(() => snapshotVectorProjection({ ...snapshot(), style: { ...input.style, terrain: { source: 'dem' } } })).toThrow('terrain');
});

it('uses a frozen mathematical projection across bearing, world wraps and subsequent map changes', () => {
  const projection = snapshotVectorProjection(snapshot());
  expect(projection.projectToFrame([0, 0])).toEqual({ x: 0.5, y: 0.5 });
  expect(projection.projectToFrame([360, 0]).x).toBeCloseTo(1.5);
  const rotated = snapshotVectorProjection({ ...snapshot(), camera: { ...snapshot().camera, bearing: 90 } });
  expect(rotated.projectToFrame([90, 0])).toEqual({ x: 0.5, y: 0.25 });
});

it('aborts immediately and bounds bytes and tile allocations before decoding', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(captureVectorBasemap(snapshot(), { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetch).not.toHaveBeenCalled();
  const input = snapshot();
  input.style.sources.tiles = { type: 'vector', tiles: ['https://example.test/{z}/{x}/{y}.pbf'] };
  await expect(captureVectorBasemap({ ...input, camera: { ...input.camera, zoom: 8 } })).rejects.toThrow('64-tile');
  vi.mocked(fetch).mockResolvedValueOnce(new Response(new Uint8Array(4 * 1024 * 1024 + 1)));
  await expect(boundedVectorFetch('https://example.test/large', new AbortController().signal, { bytes: 0, tiles: 0, points: 0, features: 0 })).rejects.toThrow('safety budget');
});

it('fails explicitly on unsupported glyphs, tile encodings and custom terrain protocols', async () => {
  vi.mocked(fetch).mockImplementation(async (url) => new Response(
    new Uint8Array(String(url).includes('.woff') ? fontBytes : tileBytes('\u{6771}\u{4EAC}')),
  ));
  await expect(captureVectorBasemap(snapshot())).rejects.toThrow('cannot encode');
  const input = snapshot();
  input.style.sources.tiles = { type: 'vector', tiles: ['https://example.test/tile.mlt'], encoding: 'mlt' };
  await expect(captureVectorBasemap(input)).rejects.toThrow('MVT encoding');
  input.style.sources.tiles = { type: 'vector', tiles: ['pms-contours://terrain/{z}/{x}/{y}'], maxzoom: 0 };
  await expect(captureVectorBasemap(input)).rejects.toThrow('pms-contours:');
});

it('aborts slow source work at the deadline and releases its timer', async () => {
  vi.useFakeTimers();
  try {
    vi.mocked(fetch).mockImplementation((_url, options) => new Promise((_, reject) => {
      options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
    }));
    const capture = captureVectorBasemap(snapshot());
    const rejection = expect(capture).rejects.toThrow('30-second');
    await vi.advanceTimersByTimeAsync(30_001);
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
