import { createInitialProjectDocument } from '../../src/domain/project';
import { createPrintPdf } from '../../src/export/printPdf';
import type { PreviewPng } from '../../src/export/previewPng';
import { serializePrintScene } from '../../src/print/scene';

const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const projector = ([longitude, latitude]: readonly [number, number]) => ({
  x: (longitude - 16.3) * 1000,
  y: (48.3 - latitude) * 1000,
});

function invertedProject() {
  const project = createInitialProjectDocument();
  project.layers[2].appearance = {
    kind: 'shape', fillColor: '#112233', strokeColor: '#fedcba', strokeWidth: 3, invert: true,
  };
  return project;
}

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

describe('inverted shape print parity', () => {
  it('prints every disconnected MultiPolygon part in layered SVG and PDF', async () => {
    const project = createInitialProjectDocument();
    project.layers[2].geometry = {
      type: 'MultiPolygon',
      coordinates: [
        [[[10, 46], [11, 46], [11, 47], [10, 46]]],
        [[[12, 47], [13, 47], [13, 48], [12, 47]]],
      ],
    };

    const svgText = serializePrintScene(project, {
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      attribution: '© OpenStreetMap contributors',
      project: projector,
    });
    const svg = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const path = svg.querySelector(':scope [data-layer-id="area-center"] path');
    expect(path?.getAttribute('d')?.match(/M /g)).toHaveLength(2);

    const pdf = await createPrintPdf(project, jpegCapture());
    const text = new TextDecoder('latin1').decode(await pdf.arrayBuffer());
    const shapeStart = text.indexOf('% Vector layer: City center');
    const shapeEnd = text.indexOf('% Vector layer: Coffee stop', shapeStart);
    const shapeCommands = text.slice(shapeStart, shapeEnd);
    expect(shapeCommands.match(/\nh/g)).toHaveLength(2);
  });

  it('fills outside the polygon in layered SVG without outlining the page edge', () => {
    const svgText = serializePrintScene(invertedProject(), {
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      attribution: '© OpenStreetMap contributors',
      project: projector,
    });
    const svg = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const fill = svg.querySelector(':scope [data-layer-id="area-center"] [data-shape-fill="inverted"]');
    const outline = svg.querySelector(':scope [data-layer-id="area-center"] [data-shape-outline]');

    expect(fill?.getAttribute('d')).toMatch(/^M 0 0 L 297 0 L 297 210 L 0 210 Z /);
    expect(fill?.getAttribute('fill-rule')).toBe('evenodd');
    expect(outline?.getAttribute('d')).not.toContain('M 0 0 L 297 0');
    expect(outline?.getAttribute('fill')).toBe('none');
  });

  it('fills outside the polygon in PDF without stroking the page edge', async () => {
    const pdf = await createPrintPdf(invertedProject(), jpegCapture());
    const text = new TextDecoder('latin1').decode(await pdf.arrayBuffer());

    expect(text).toContain('% Inverted shape fill');
    expect(text).toContain('0 0 m\n841.889764 0 l\n841.889764 595.275591 l\n0 595.275591 l\nh');
    expect(text).toContain('f*\n% Shape boundary outline');
    expect(text).not.toContain('% Shape boundary outline\n0 0 m\n841.889764 0 l');
  });
});
