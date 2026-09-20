import { createRoot } from 'react-dom/client';
import { ProjectStoreContext } from '../../../src/app/projectStoreContext';
import { createProjectStore } from '../../../src/app/store';
import { StudioCompositionHarnessView } from './studioCompositionHarnessView';
import { createInitialProjectDocument } from '../../../src/domain/project';
import { posterTemplateSettings } from '../../../src/domain/studioTemplates';
import { validatePhotoFile } from '../../../src/domain/studioPhotoAssets';
import { drawStudioComposition } from '../../../src/export/studioComposition';
import { createPrintPdf } from '../../../src/export/printPdf';
import { prepareStudioPrintRenderer } from '../../../src/export/studioPrintRenderer';
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
  const photo = document.createElement('canvas');
  photo.width = 64; photo.height = 32;
  const photoContext = photo.getContext('2d')!;
  photoContext.fillStyle = '#d23328'; photoContext.fillRect(0, 0, 32, 32);
  photoContext.fillStyle = '#2463bc'; photoContext.fillRect(32, 0, 32, 32);
  const asset = await validatePhotoFile(new File([await png(photo)], 'story.png', { type: 'image/png' }));
  doc.studio.photos.assets[asset.id] = asset;
  doc.studio.photos.stops = [{ id: 'memory', assetId: asset.id, layerId: 'poi-cafe', caption: 'One journey' }];
  doc.studio.photos.map.enabled = true;
  doc.studio.photos.strip.enabled = true;
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
    const capture = await exporter();
    try {
      const pdf = await createPrintPdf(doc, capture);
      const source = await pdf.text();
      return { difference: difference / actual.length, imageCount: source.match(/\/Subtype \/Image/g)?.length ?? 0, hasSoftMask: source.includes('/SMask') };
    } finally { capture.surface.width = 0; capture.surface.height = 0; }
  } finally {
    URL.revokeObjectURL(uri);
  }
}

async function renderTestTile(request: { region: { width: number; height: number } }) {
      const canvas = document.createElement('canvas');
      canvas.width = request.region.width; canvas.height = request.region.height;
      canvas.getContext('2d')!.fillStyle = '#ccd9d3';
      canvas.getContext('2d')!.fillRect(0, 0, canvas.width, canvas.height);
      return canvas;
}

async function comparePngTiles() {
  const doc = createInitialProjectDocument();
  doc.studio.poster = posterTemplateSettings('classic', 'Tile-safe poster');
  doc.studio.decorations.qr.enabled = true;
  const output = { width: 891, height: 630 };
  const source: PreviewPngExporter = Object.assign(exporter, { createPrintTileRenderer: () => renderTestTile });
  const plan = { output, regions: [], pixelsPerMillimetre: 3, symbolsVisible: false };
  const renderer = await prepareStudioPrintRenderer(doc, source, plan);
  try {
    const full = await renderer.renderTile({ output, region: { x: 0, y: 0, ...output } });
    const tiled = document.createElement('canvas');
    tiled.width = output.width; tiled.height = output.height;
    for (const region of [{ x: 0, y: 0, width: 450, height: 630 }, { x: 450, y: 0, width: 441, height: 630 }]) {
      const tile = await renderer.renderTile({ output, region });
      tiled.getContext('2d')!.drawImage(tile, region.x, region.y);
    }
    const a = full.getContext('2d')!.getImageData(0, 0, output.width, output.height).data;
    const b = tiled.getContext('2d')!.getImageData(0, 0, output.width, output.height).data;
    let difference = 0;
    for (let index = 0; index < a.length; index += 1) difference += Math.abs(a[index] - b[index]);
    const capture = await exporter();
    try {
      const pdf = await createPrintPdf(doc, capture);
      return { error: difference / a.length, attribution: renderer.isAttributionIncluded, pdf: await pdf.text() };
    } finally { capture.surface.width = 0; capture.surface.height = 0; }
  } finally { renderer.dispose(); }
}

declare global { interface Window { studioAcceptance: { compareRenderers: typeof compareRenderers; comparePngTiles: typeof comparePngTiles } } }
Object.defineProperty(window, 'studioAcceptance', { value: { compareRenderers, comparePngTiles } });

createRoot(document.querySelector('#composition-harness')!).render(<ProjectStoreContext value={store}><StudioCompositionHarnessView exporter={exporter} project={project} /></ProjectStoreContext>);
