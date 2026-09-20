import type { ProjectDocument } from '../../domain/project';
import type { PdfBasemap } from '../printPdf';
import { asciiBytes } from '../pdfWriter';
import { vectorPdfForm } from './pdf';
import { checkVectorSignal, type VectorBasemapCapture } from './scene';

export async function createVectorPdfDocument(
  document: ProjectDocument,
  capture: VectorBasemapCapture,
  render: (document: ProjectDocument, capture: VectorBasemapCapture, basemap: PdfBasemap, options: Readonly<{ signal?: AbortSignal; subject?: string }>) => Promise<Blob>,
  signal?: AbortSignal,
): Promise<Blob> {
  checkVectorSignal(signal);
  const { scene } = capture;
  if (!(scene.width > 0) || !(scene.height > 0)) throw new Error('Vector basemap dimensions must be positive.');
  const form = vectorPdfForm(scene);
  const pdf = await render(document, capture, {
    images: [{
      bytes: asciiBytes(form.commands),
      destination: { x: 0, y: 0, width: scene.width, height: scene.height },
      dictionary: form.dictionary,
      resourceName: 'BasemapImage0',
    }],
    output: { width: scene.width, height: scene.height },
  }, { signal, subject: 'True vector artwork. Reflowed Noto Sans Latin labels; generic vector markers and reference shields; sharp halos. Not pixel-identical to the live map.' });
  const { embedVectorPdfText } = await import('./pdfFont');
  return embedVectorPdfText(pdf, scene, signal);
}
