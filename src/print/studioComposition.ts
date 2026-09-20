import { decimal, type StudioProjector } from './studioGeometry';
import { decorationPrimitives } from './studioDecorations';
import { gridPrimitives } from './studioGrid';
import { deriveStudioLayout, posterPrimitives, type StudioCamera, type StudioCompositionDocument } from './studioLayout';
import { photoPrimitives } from './studioPhotos';
import { serializeStudioPrimitives, type StudioPrimitive } from './studioPrimitives';

export function hasStudioComposition(document: StudioCompositionDocument): boolean {
  const { poster, photos, decorations } = document.studio;
  return poster.enabled || photos.map.enabled || photos.strip.enabled || decorations.compass.enabled
    || decorations.grid.enabled || decorations.qr.enabled || decorations.scale.enabled;
}

export function deriveStudioComposition(document: StudioCompositionDocument, project: StudioProjector, camera: StudioCamera = document.camera): StudioPrimitive[] {
  if (!hasStudioComposition(document)) return [];
  const layout = deriveStudioLayout(document);
  const checkedProject: StudioProjector = (coordinate) => {
    const point = project(coordinate);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error('The map projection is unavailable for poster artwork. Wait for the map and try again.');
    return point;
  };
  return [
    ...gridPrimitives(document.studio.decorations.grid, camera, layout.map, checkedProject),
    ...posterPrimitives(document, layout, camera),
    ...photoPrimitives(document, layout, checkedProject),
    ...decorationPrimitives(document, layout.map, checkedProject, camera),
  ].map((primitive) => ({ ...primitive, clip: primitive.clip ?? layout.printable }));
}

export function serializeStudioComposition(document: StudioCompositionDocument, project: StudioProjector, camera?: StudioCamera): string {
  const primitives = deriveStudioComposition(document, project, camera);
  if (primitives.length === 0) return '';
  return `<g id="studio-composition" data-scene-role="composition" data-layer-name="Poster composition" clip-path="url(#page-clip)"><title>Poster composition</title>${serializeStudioPrimitives(primitives)}</g>`;
}

export function serializeStudioOverlaySvg(document: StudioCompositionDocument, project: StudioProjector, camera?: StudioCamera): string {
  const width = decimal(document.page.widthMm), height = decimal(document.page.heightMm);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}"><defs><clipPath id="page-clip"><rect width="${width}" height="${height}"/></clipPath></defs>${serializeStudioComposition(document, project, camera)}</svg>`;
}
