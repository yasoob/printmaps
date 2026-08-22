import { createInitialProjectDocument } from '../../src/domain/project';
import { createPrintPdf } from '../../src/export/printPdf';
import type { PreviewPng } from '../../src/export/previewPng';

function jpegCapture(): PreviewPng {
  const surface = document.createElement('canvas');
  surface.width = 2;
  surface.height = 1;
  return {
    blob: new Blob([Uint8Array.from([0xFF, 0xD8, 0xFF, 0xD9])], { type: 'image/jpeg' }),
    width: 2,
    height: 1,
    surface,
    projectToFrame: () => ({ x: 0.5, y: 0.5 }),
  };
}

async function pdfText(document = createInitialProjectDocument()): Promise<string> {
  const pdf = await createPrintPdf(document, jpegCapture());
  return new TextDecoder('latin1').decode(await pdf.arrayBuffer());
}

describe('print PDF', () => {
  it('embeds hidden vector content while listing its optional layer as initially off', async () => {
    const document = createInitialProjectDocument();
    const route = document.layers.find(({ id }) => id === 'route-01');
    if (!route) throw new Error('Route fixture is unavailable');
    route.visible = false;

    const text = await pdfText(document);

    expect(text).toContain('/OFF [8 0 R]');
    expect(text).toContain('% Vector layer: Route 01');
    expect(text).toContain('/OC /Layer0 BDC');
  });

  it('applies canonical basemap opacity to the raster image', async () => {
    const document = createInitialProjectDocument();
    const basemap = document.layers.find(({ type }) => type === 'basemap');
    if (!basemap) throw new Error('Basemap fixture is unavailable');
    basemap.opacity = 35;

    const text = await pdfText(document);

    expect(text).toContain('/BasemapGS gs');
    expect(text).toContain('/BasemapGS ');
    expect(text).toContain('/Type /ExtGState /CA 0.35 /ca 0.35');
  });

  it('paints bottom layers first while listing optional layers in editor order', async () => {
    const text = await pdfText();

    const route = text.indexOf('% Vector layer: Route 01');
    const poi = text.indexOf('% Vector layer: Coffee stop');
    const shape = text.indexOf('% Vector layer: City center');
    expect(shape).toBeLessThan(poi);
    expect(poi).toBeLessThan(route);
    expect(text).toContain('/Order [8 0 R 9 0 R 10 0 R 7 0 R 11 0 R]');
  });
});
