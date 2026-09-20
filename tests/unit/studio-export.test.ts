import { createInitialProjectDocument } from '../../src/domain/project';
import { posterTemplateSettings } from '../../src/domain/studioTemplates';
import { prepareStudioComposition } from '../../src/export/studioComposition';
import { createPrintPdf } from '../../src/export/printPdf';
import { createPsdSvgRasterLayers } from '../../src/export/layeredPsdSvg';
import { serializePrintScene } from '../../src/print/scene';
import { photoAsset } from '../fixtures/studio';

const project = ([lng, lat]: readonly [number, number]) => ({ x: 0.5 + (lng - 16.3725) / 3, y: 0.5 - (lat - 48.2084) / 3 });
const image = photoAsset();

function fixture() {
  const document = createInitialProjectDocument();
  document.studio.poster = posterTemplateSettings('classic', 'A finished map');
  document.studio.decorations.qr.enabled = true;
  return document;
}

function capture() {
  const surface = document.createElement('canvas');
  surface.width = 600; surface.height = 420;
  return { surface, width: 600, height: 420, blob: new Blob([Uint8Array.from([0xFF, 0xD8, 0xFF, 0xD9])], { type: 'image/jpeg' }), projectToFrame: project };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('puts shared poster vectors and embedded photos below topmost attribution in SVG and PSD', () => {
  const document = fixture();
  document.studio.photos.assets[image.id] = image;
  document.studio.photos.stops = [{ id: 'one', layerId: 'poi-cafe', assetId: image.id, caption: 'A photo' }];
  document.studio.photos.map.enabled = true;
  const svg = serializePrintScene(document, {
    basemap: { dataUri: image.dataUri, pixelWidth: 1, pixelHeight: 1 }, attribution: 'Required attribution',
    project: (coordinate, context) => {
      const point = project(coordinate);
      return { x: point.x * context.pageWidthMm, y: point.y * context.pageHeightMm };
    },
  });
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(parsed.querySelector('parsererror')).toBeNull();
  expect(parsed.querySelector(':scope [data-scene-role="composition"] text')?.textContent).toBe('A finished map');
  expect(parsed.querySelector(':scope [data-scene-role="composition"] image')?.getAttribute('href')).toBe(image.dataUri);
  expect(parsed.documentElement.lastElementChild?.id).toBe('attribution');
  const layers = createPsdSvgRasterLayers(document, capture(), { width: 600, height: 420 });
  expect(layers.at(-2)).toMatchObject({ role: 'composition', name: 'Poster composition', hidden: false, opacity: 1 });
  expect(layers.at(-2)?.svg).toContain('A finished map');
  expect(layers.at(-1)?.role).toBe('attribution');
});

it('keeps PDF typography and QR vector with one basemap image and a named composition OCG', async () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 4 }),
  } as unknown as CanvasRenderingContext2D);
  const pdf = await createPrintPdf(fixture(), capture());
  const text = new TextDecoder().decode(await pdf.arrayBuffer());
  expect(text.match(/\/Subtype \/Image/g)).toHaveLength(1);
  expect(text).toContain('/Name (Poster composition)');
  expect(text).toContain('/BaseFont /Times-Roman');
  expect(text).toContain('(A finished map) Tj');
  expect(text.indexOf('/OC /Composition BDC')).toBeLessThan(text.indexOf('/OC /Attribution BDC'));
  expect(text).toContain('/StudioOpacity0 gs');
});

it('never replaces unsupported PDF title glyphs with question marks', async () => {
  const document = fixture();
  document.studio.poster.title.text = '京都';
  await expect(createPrintPdf(document, capture())).rejects.toThrow('Use SVG or PNG');
});

it('cancels a stalled photo decode promptly and never paints after abort or disposal', async () => {
  const document = createInitialProjectDocument();
  document.studio.photos.assets[image.id] = image;
  document.studio.photos.stops = [{ id: 'one', layerId: 'poi-cafe', assetId: image.id, caption: '' }];
  document.studio.photos.map.enabled = true;
  const instances: EventTarget[] = [];
  vi.stubGlobal('Image', class extends EventTarget {
    src = '';
    constructor() { super(); instances.push(this); }
  });
  const drawImage = vi.fn(), restore = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    save: vi.fn(), restore, translate: vi.fn(), scale: vi.fn(), beginPath: vi.fn(),
    rect: vi.fn(), clip: vi.fn(), arc: vi.fn(), fill: vi.fn(), drawImage,
  } as unknown as CanvasRenderingContext2D);
  const canvas = globalThis.document.createElement('canvas');
  const composer = prepareStudioComposition(document), controller = new AbortController();
  const drawing = composer.draw(canvas, project, { signal: controller.signal });
  await vi.waitFor(() => expect(instances).toHaveLength(1));
  controller.abort();
  await expect(drawing).rejects.toMatchObject({ name: 'AbortError' });
  composer.dispose();
  instances[0].dispatchEvent(new Event('load'));
  expect(drawImage).not.toHaveBeenCalled();
  expect(restore).toHaveBeenCalled();
  await expect(composer.draw(canvas, project)).rejects.toThrow('already been released');
});
