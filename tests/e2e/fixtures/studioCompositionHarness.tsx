import { createRoot } from 'react-dom/client';
import { ProjectStoreContext } from '../../../src/app/projectStoreContext';
import { createProjectStore } from '../../../src/app/store';
import { StudioCompositionHarnessView } from './studioCompositionHarnessView';
import { createInitialProjectDocument } from '../../../src/domain/project';
import { posterTemplateSettings } from '../../../src/domain/studioTemplates';
import { drawStudioComposition } from '../../../src/export/studioComposition';
import { serializeStudioOverlaySvg } from '../../../src/print/studioComposition';
import type { PreviewPngExporter } from '../../../src/export/previewPng';
import '../../../src/styles.css';

const store = createProjectStore(createInitialProjectDocument());
const project = ([lng, lat]: readonly [number, number]) => ({ x: 0.5 + (lng - 16.3725) / 3, y: 0.5 - (lat - 48.2084) / 3 });
function png(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG failed'))));
}
const exporter: PreviewPngExporter = async () => {
  const surface = document.createElement('canvas');
  surface.width = 594; surface.height = 420;
  const context = surface.getContext('2d')!;
  context.fillStyle = '#ccd9d3'; context.fillRect(0, 0, surface.width, surface.height);
  context.strokeStyle = '#718984'; context.lineWidth = 4;
  const streets = new Path2D();
  for (let x = 0; x < surface.width; x += 32) { streets.moveTo(x, 0); streets.lineTo(x + 100, 420); }
  context.stroke(streets);
  return { surface, width: surface.width, height: surface.height, blob: await png(surface), projectToFrame: project };
};

async function compareRenderers() {
  const doc = createInitialProjectDocument();
  doc.studio.poster = posterTemplateSettings('classic', 'A finished map');
  doc.studio.decorations.qr.enabled = true;
  doc.studio.decorations.compass.enabled = true;
  const canvas = document.createElement('canvas');
  canvas.width = 891; canvas.height = 630;
  await drawStudioComposition(canvas, doc, project);
  const svg = serializeStudioOverlaySvg(doc, (coordinate) => {
    const point = project(coordinate); return { x: point.x * doc.page.widthMm, y: point.y * doc.page.heightMm };
  });
  const uri = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => reject(new Error('SVG failed')), { once: true });
      image.src = uri;
    });
    const other = document.createElement('canvas');
    other.width = canvas.width; other.height = canvas.height;
    other.getContext('2d')!.drawImage(image, 0, 0, other.width, other.height);
    const actual = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    const expected = other.getContext('2d')!.getImageData(0, 0, other.width, other.height).data;
    let difference = 0;
    for (let index = 0; index < actual.length; index += 1) difference += Math.abs(actual[index] - expected[index]);
    return difference / actual.length;
  } finally {
    URL.revokeObjectURL(uri);
  }
}

declare global { interface Window { studioAcceptance: { compareRenderers: typeof compareRenderers } } }
Object.defineProperty(window, 'studioAcceptance', { value: { compareRenderers } });

createRoot(document.querySelector('#composition-harness')!).render(<ProjectStoreContext value={store}><StudioCompositionHarnessView exporter={exporter} project={project} /></ProjectStoreContext>);
