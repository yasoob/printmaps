import fontkit from '@pdf-lib/fontkit';
import { PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef } from 'pdf-lib';
import { vectorPdfForm } from './pdf';
import { checkVectorSignal, type VectorBasemapScene } from './scene';

export async function embedVectorPdfText(blob: Blob, scene: VectorBasemapScene, signal?: AbortSignal): Promise<Blob> {
  if (!scene.font || scene.groups.every((group) => !group.texts?.length)) return blob;
  checkVectorSignal(signal);
  const document = await PDFDocument.load(await blob.arrayBuffer(), { updateMetadata: false });
  document.registerFontkit(fontkit);
  const font = await document.embedFont(scene.font.bytes, { subset: true });
  checkVectorSignal(signal);
  const form = vectorPdfForm(scene, font);
  const objects = document.getPage(0).node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
  const reference = objects.get(PDFName.of('BasemapImage0'));
  if (!(reference instanceof PDFRef)) throw new Error('The vector PDF basemap form is unavailable.');
  const original = document.context.lookup(reference);
  if (!(original instanceof PDFRawStream)) throw new Error('The vector PDF basemap is not an editable form stream.');
  const dictionary = original.dict.clone(document.context);
  const resources = document.context.obj({ Font: { VBFont: font.ref }, ExtGState: form.states });
  dictionary.set(PDFName.of('Resources'), resources);
  const bytes = new TextEncoder().encode(form.commands);
  dictionary.set(PDFName.of('Length'), document.context.obj(bytes.length));
  document.context.assign(reference, PDFRawStream.of(dictionary, bytes));
  const output = await document.save();
  checkVectorSignal(signal);
  return new Blob([new Uint8Array(output)], { type: 'application/pdf' });
}
