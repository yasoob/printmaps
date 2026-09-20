import { createInitialProjectDocument } from '../../src/domain/project';
import { rebasePathLongitudes } from '../../src/domain/routeArcGeometry';
import { snapshotVectorProjection } from '../../src/export/vector/projection';
import { deriveStudioComposition, serializeStudioOverlaySvg } from '../../src/print/studioComposition';
import { locationQrUrl } from '../../src/print/studioDecorations';
import { canonicalStudioLongitude, decimal } from '../../src/print/studioGeometry';
import { formatStudioCoordinates } from '../../src/print/studioLayout';
import { createLayeredSvg, createVectorSvg } from '../../src/export/layeredSvg';
import { createPrintPdf, createVectorPrintPdf } from '../../src/export/printPdf';
import type { VectorBasemapCapture } from '../../src/export/vector/scene';
import { createPsdSvgRasterLayers } from '../../src/export/layeredPsdSvg';
import { drawStudioComposition } from '../../src/export/studioComposition';
import { prepareStudioPrintRenderer } from '../../src/export/studioPrintRenderer';
import type { MapRenderSnapshot } from '../../src/map/MapRenderSnapshot';
import type { PreviewPngExporter } from '../../src/export/previewPng';
import type { StudioPrimitive } from '../../src/print/studioPrimitives';
import { photoAsset } from '../fixtures/studio';

const asset = photoAsset();

function fixture(referenceLongitude: number, photoLongitude = -179) {
  const document = createInitialProjectDocument();
  document.camera = { center: [canonicalStudioLongitude(referenceLongitude), 0], bearing: 0, pitch: 0, zoom: 5, locked: false };
  const poi = document.layers.find(({ type }) => type === 'poi')!;
  poi.geometry = { type: 'Point', coordinates: [photoLongitude, 0] };
  document.studio.photos.assets[asset.id] = asset;
  document.studio.photos.stops = [{ id: 'antimeridian-photo', layerId: poi.id, assetId: asset.id, caption: '' }];
  document.studio.photos.map.enabled = true;
  const snapshot: MapRenderSnapshot = {
    camera: { ...document.camera, center: [referenceLongitude, 0], roll: 0 },
    printCamera: { ...document.camera, center: [referenceLongitude, 0] },
    style: { version: 8, sources: {}, layers: [] },
    viewport: { width: 600, height: 420 }, frame: { x: 0, y: 0, width: 600, height: 420 },
    footprint: { corners: [[referenceLongitude - 5, 4], [referenceLongitude + 5, 4], [referenceLongitude + 5, -4], [referenceLongitude - 5, -4]], widthPx: 600, heightPx: 420, pitch: 0, bearing: 0 },
    referenceLongitude, layers: document.layers, assets: document.assets,
  };
  const projection = snapshotVectorProjection(snapshot);
  const pageProject = (coordinate: readonly [number, number]) => {
    const point = projection.projectToFrame(coordinate);
    return { x: point.x * document.page.widthMm, y: point.y * document.page.heightMm };
  };
  return { document, projection, pageProject, snapshot, photoLongitude };
}

function imagePrimitive(primitives: readonly StudioPrimitive[]) {
  const image = primitives.find((primitive) => primitive.kind === 'image');
  if (!image || image.kind !== 'image') throw new Error('Missing expected photo primitive.');
  return image;
}

function capture(referenceLongitude: number) {
  const { projection } = fixture(referenceLongitude);
  const surface = document.createElement('canvas');
  surface.width = 600; surface.height = 420;
  return {
    surface, width: surface.width, height: surface.height, referenceLongitude,
    projectToFrame: projection.projectToFrame,
    blob: new Blob([Uint8Array.from([0xFF, 0xD8, 0xFF, 0xD9])], { type: 'image/jpeg' }),
  };
}

function contextMock() {
  return {
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), beginPath: vi.fn(),
    rect: vi.fn(), arc: vi.fn(), clip: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn((text: string) => ({ width: text.length * 2 })),
    drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray([255, 0, 0, 255]) }),
  };
}

function normalized(value: unknown) {
  return JSON.stringify(value, (_key, candidate: unknown) => typeof candidate === 'number' ? Number(candidate.toFixed(5)) : candidate);
}

async function emptyTile() { return capture(0).surface; }

beforeEach(() => {
  vi.stubGlobal('Image', class extends EventTarget {
    set src(value: string) { if (value) queueMicrotask(() => this.dispatchEvent(new Event('load'))); }
  });
  vi.stubGlobal('Path2D', class { arc() {} rect() {} });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([179, 539, -181])('uses the nearest world copy in real vector projection at %s degrees', (reference) => {
  const { document, projection, pageProject } = fixture(reference);
  const photo = imagePrimitive(deriveStudioComposition(document, pageProject, undefined, reference));
  const expected = pageProject(rebasePathLongitudes([[-179, 0]], reference)[0]);
  expect(photo.box.x).toBeCloseTo(expected.x - document.studio.photos.map.sizeMm / 2, 6);
  expect(photo.box.x).toBeGreaterThan(0);
  expect(photo.box.x + photo.box.width).toBeLessThan(document.page.widthMm);
  if (reference > 0) expect(projection.projectToFrame([-179, 0]).x).toBeLessThan(0);

  const liveProject = (coordinate: readonly [number, number]) => pageProject(rebasePathLongitudes([coordinate], reference)[0]);
  expect(imagePrimitive(deriveStudioComposition(document, liveProject, undefined, reference)).box).toEqual(photo.box);
  const preview = new DOMParser().parseFromString(serializeStudioOverlaySvg(document, pageProject, undefined, reference), 'image/svg+xml');
  expect(Number(preview.querySelector('image')?.getAttribute('x'))).toBeCloseTo(photo.imageBox.x, 6);
});

it('honors a moving video camera override and normalizes coordinates and QR destinations', () => {
  const { document, pageProject, snapshot } = fixture(539);
  document.camera.center = [0, 0];
  const camera = snapshot.camera;
  expect(imagePrimitive(deriveStudioComposition(document, pageProject, camera)).box.x).toBeGreaterThan(0);
  expect(formatStudioCoordinates(camera.center, 'decimal')).toBe('0.0000 N / 179.0000 E');
  expect(new URL(locationQrUrl(document, camera)).searchParams.get('query')).toBe('0.000000,179.000000');
});

it('keeps scale, compass and grid geometry equivalent across normalized and unwrapped worlds', () => {
  const base = fixture(179), wrapped = fixture(539);
  for (const { document } of [base, wrapped]) {
    document.studio.decorations.grid.enabled = true;
    document.studio.decorations.compass.enabled = true;
    document.studio.decorations.scale.enabled = true;
  }
  const a = deriveStudioComposition(base.document, base.pageProject, base.snapshot.camera, 179);
  const b = deriveStudioComposition(wrapped.document, wrapped.pageProject, wrapped.snapshot.camera, 539);
  expect(a).toHaveLength(b.length);
  expect(normalized(a)).toBe(normalized(b));
});

it('does not draw grid segments across the +/-180 world-copy tie at world zoom', () => {
  const { document, snapshot } = fixture(0);
  document.camera.zoom = 0;
  document.studio.photos.map.enabled = false;
  document.studio.decorations.grid = { ...document.studio.decorations.grid, enabled: true, intervalDegrees: 30 };
  const projection = snapshotVectorProjection({ ...snapshot, camera: { ...snapshot.camera, zoom: 0 } });
  const primitives = deriveStudioComposition(document, (coordinate) => {
    const point = projection.projectToFrame(coordinate);
    return { x: point.x * document.page.widthMm, y: point.y * document.page.heightMm };
  });
  for (const primitive of primitives) {
    if (primitive.kind !== 'path') continue;
    const steps = primitive.points.slice(1).map((point, index) => Math.hypot(point.x - primitive.points[index].x, point.y - primitive.points[index].y));
    expect(Math.max(...steps)).toBeLessThan(document.page.widthMm / 2);
  }
});

it.each([179, 539])('threads capture reference %s through SVG, PDF, PSD, PNG and wall canvas', async (reference) => {
  const { document, pageProject } = fixture(reference);
  const expected = imagePrimitive(deriveStudioComposition(document, pageProject, undefined, reference));
  const context = contextMock();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const source = capture(reference);
  const svg = await createLayeredSvg(document, source);
  const parsed = new DOMParser().parseFromString(await svg.text(), 'image/svg+xml');
  expect(Number(parsed.querySelector(':scope [data-scene-role="composition"] image')?.getAttribute('x'))).toBeCloseTo(expected.imageBox.x, 6);
  const vectorCapture: VectorBasemapCapture = { scene: { kind: 'vector', width: 600, height: 420, groups: [] }, projectToFrame: source.projectToFrame, referenceLongitude: source.referenceLongitude };
  const vectorSvg = new DOMParser().parseFromString(await createVectorSvg(document, vectorCapture).text(), 'image/svg+xml');
  expect(Number(vectorSvg.querySelector(':scope [data-scene-role="composition"] image')?.getAttribute('x'))).toBeCloseTo(expected.imageBox.x, 6);
  const psd = createPsdSvgRasterLayers(document, source, { width: 600, height: 420 });
  const composition = psd.find(({ role }) => role === 'composition');
  const psdSvg = new DOMParser().parseFromString(composition!.svg, 'image/svg+xml');
  expect(Number(psdSvg.querySelector('image')?.getAttribute('x'))).toBeCloseTo(expected.imageBox.x, 6);
  const pdf = await createPrintPdf(document, source);
  const imageCommands = `12 0 0 -12 ${decimal(expected.imageBox.x)} ${decimal(expected.imageBox.y + 12)} cm\n/StudioPhoto0 Do`;
  expect(await pdf.text()).toContain(imageCommands);
  const vectorPdf = await createVectorPrintPdf(document, vectorCapture);
  expect(await vectorPdf.text()).toContain(imageCommands);
  context.drawImage.mockClear();
  await drawStudioComposition(source.surface, document, source.projectToFrame, { referenceLongitude: source.referenceLongitude, includeAttribution: true });
  expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), expected.imageBox.x, expected.imageBox.y, expected.imageBox.width, expected.imageBox.height);
  context.drawImage.mockClear();
  await drawStudioComposition(source.surface, document, source.projectToFrame, { camera: { ...document.camera, center: [reference, 0] } });
  expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), expected.imageBox.x, expected.imageBox.y, expected.imageBox.width, expected.imageBox.height);

  const exporter: PreviewPngExporter = Object.assign(async () => capture(reference), { createPrintTileRenderer: () => emptyTile });
  const renderer = await prepareStudioPrintRenderer(document, exporter, { output: { width: 600, height: 420 }, regions: [], pixelsPerMillimetre: 2, symbolsVisible: false });
  try {
    context.drawImage.mockClear();
    await renderer.renderTile({ output: { width: 600, height: 420 }, region: { x: 0, y: 0, width: 600, height: 420 } });
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), expected.imageBox.x, expected.imageBox.y, expected.imageBox.width, expected.imageBox.height);
  } finally { renderer.dispose(); }
});
