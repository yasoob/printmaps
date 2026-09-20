import type { CameraSettings, ProjectDocument } from '../domain/project';
import type { PosterText, StudioSettings } from '../domain/studio';
import type { StudioBox } from './studioGeometry';
import { studioText, type StudioPrimitive } from './studioPrimitives';

export type StudioCompositionDocument = Pick<ProjectDocument, 'page' | 'camera' | 'layers' | 'title'> & { studio: StudioSettings };
export type StudioCamera = Readonly<Pick<CameraSettings, 'zoom' | 'bearing' | 'pitch'> & { center: readonly [number, number] }>;
export type StudioLayout = Readonly<{
  page: StudioBox; printable: StudioBox; map: StudioBox; title: StudioBox | null; strip: StudioBox | null;
}>;
const MM_PER_POINT = 25.4 / 72;
const NO_MARGINS = { top: 0, right: 0, bottom: 0, left: 0 };

export function formatStudioCoordinates(coordinate: readonly [number, number], format: 'decimal' | 'dms'): string {
  const formatAxis = (value: number, suffix: string) => {
    const absolute = Math.abs(value);
    if (format === 'decimal') return `${absolute.toFixed(4)} ${suffix}`;
    const totalSeconds = Math.round(absolute * 3600);
    const degrees = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    return `${degrees}d ${minutes}' ${totalSeconds % 60}" ${suffix}`;
  };
  return `${formatAxis(coordinate[1], coordinate[1] < 0 ? 'S' : 'N')} / ${formatAxis(coordinate[0], coordinate[0] < 0 ? 'W' : 'E')}`;
}

function textRows(document: StudioCompositionDocument, camera: StudioCamera): PosterText[] {
  const poster = document.studio.poster;
  return [
    poster.title, poster.subtitle, poster.caption,
    { ...poster.coordinates, text: formatStudioCoordinates(camera.center, poster.coordinates.format) },
  ].filter(({ enabled, text }) => enabled && text.trim());
}

function allocateTitle(document: StudioCompositionDocument, map: StudioBox): { map: StudioBox; title: StudioBox | null } {
  const poster = document.studio.poster;
  const rows = poster.enabled ? textRows(document, document.camera) : [];
  if (rows.length === 0) return { map, title: null };
  const titleHeight = rows.reduce((sum, row) => sum + row.fontSizePt * MM_PER_POINT * 1.35, 0) + 6;
  const title = { x: map.x, y: poster.layout === 'top' ? map.y : map.y + map.height - titleHeight, width: map.width, height: titleHeight };
  if (poster.layout === 'overlay') return { map, title };
  return { map: { ...map, height: map.height - titleHeight, y: poster.layout === 'top' ? map.y + titleHeight : map.y }, title };
}

function allocateStrip(document: StudioCompositionDocument, map: StudioBox): { map: StudioBox; strip: StudioBox | null } {
  const stripSettings = document.studio.photos.strip;
  if (!stripSettings.enabled || document.studio.photos.stops.length === 0) return { map, strip: null };
  const strip = { x: map.x, y: stripSettings.position === 'top' ? map.y : map.y + map.height - stripSettings.heightMm, width: map.width, height: stripSettings.heightMm };
  return { map: { ...map, height: map.height - strip.height, y: stripSettings.position === 'top' ? map.y + strip.height : map.y }, strip };
}

export function deriveStudioLayout(document: StudioCompositionDocument): StudioLayout {
  const { widthMm: width, heightMm: height } = document.page;
  if (width <= 0 || height <= 5) throw new Error('The poster needs a page taller than its 5 mm attribution bar.');
  const page = { x: 0, y: 0, width, height };
  const printable = { ...page, height: height - 5 };
  const margins = document.studio.poster.enabled ? document.studio.poster.marginsMm : NO_MARGINS;
  const available = { x: margins.left, y: margins.top, width: width - margins.left - margins.right, height: printable.height - margins.top - margins.bottom };
  const titleArea = allocateTitle(document, available);
  const { map, strip } = allocateStrip(document, titleArea.map);
  if (map.width < 12 || map.height < 12) {
    throw new Error('The poster margins, text, and photo strip leave less than 12 mm for the map. Reduce their sizes or choose a larger page.');
  }
  return { page, printable, map, title: titleArea.title, strip };
}

export function posterPrimitives(document: StudioCompositionDocument, layout: StudioLayout, camera: StudioCamera = document.camera): StudioPrimitive[] {
  const { poster } = document.studio;
  if (!poster.enabled) return [];
  const { printable, map, title } = layout;
  const fill = poster.backgroundColor;
  const outer = title && poster.layout === 'overlay'
    ? { ...map, height: Math.max(map.height, title.y + title.height - map.y) }
    : map;
  const primitives: StudioPrimitive[] = [
    { kind: 'rect', box: { x: 0, y: 0, width: printable.width, height: outer.y }, fill },
    { kind: 'rect', box: { x: 0, y: outer.y, width: outer.x, height: outer.height }, fill },
    { kind: 'rect', box: { x: outer.x + outer.width, y: outer.y, width: printable.width - outer.x - outer.width, height: outer.height }, fill },
    { kind: 'rect', box: { x: 0, y: outer.y + outer.height, width: printable.width, height: printable.height - outer.y - outer.height }, fill },
  ];
  if (!title) return primitives;
  primitives.push({ kind: 'rect', box: title, fill });
  let baseline = title.y + 3;
  const x = poster.align === 'left' ? title.x + 2 : (poster.align === 'right' ? title.x + title.width - 2 : title.x + title.width / 2);
  for (const row of textRows(document, camera)) {
    const size = row.fontSizePt * MM_PER_POINT;
    baseline += size;
    primitives.push(studioText(row.text, { x, y: baseline }, { size, maxWidth: title.width - 4, font: row.font, color: row.color, align: poster.align }));
    baseline += size * 0.35;
  }
  return primitives;
}
