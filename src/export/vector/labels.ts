import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFFont } from 'pdf-lib';
import fontUrl from '@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff?url';
import { Formatted, ResolvedImage, type Feature } from '@maplibre/maplibre-gl-style-spec';
import type { CompiledVectorLayer } from './style';
import type { VectorProjection } from './projection';
import { boundedVectorFetch, type VectorBudget } from './tiles';
import { vectorCircle } from './geometry';
import { vectorUnsupported, type VectorBasemapScene, type VectorPath, type VectorPoint, type VectorText } from './scene';

export async function loadVectorFont(signal: AbortSignal, budget: VectorBudget) {
  const bytes = await boundedVectorFetch(fontUrl, signal, budget);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const font = await document.embedFont(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCodePoint(byte);
  return { font, asset: { bytes, dataUri: `data:font/woff;base64,${btoa(binary)}` } };
}

type LabelCandidate = {
  key: string;
  layerId: string;
  text: string;
  path: readonly VectorPoint[];
  size: number;
  spacing: number;
  color: VectorText['color'];
  halo: VectorText['halo'];
  haloWidth: number;
  icon: string;
  markerColor: VectorText['color'];
  point: boolean;
};

function pathLength(path: readonly VectorPoint[]): number {
  let length = 0;
  for (let index = 1; index < path.length; index++) length += Math.hypot(path[index].x - path[index - 1].x, path[index].y - path[index - 1].y);
  return length;
}

function markerName(feature: Feature, icon: string): string {
  if (/oneway|arrow/.test(icon)) return feature.properties.oneway === -1 ? 'One-way (reverse)' : 'One-way';
  return String(feature.properties.name ?? feature.properties.ref ?? feature.properties.subclass ?? feature.properties.class ?? icon);
}

function visibleIcon(compiled: CompiledVectorLayer, feature: Feature): string {
  if (compiled.number('icon-opacity', feature) === 0 || compiled.number('icon-size', feature) === 0) return '';
  const image = compiled.read('icon-image', feature);
  return image instanceof ResolvedImage ? image.name : (typeof image === 'string' ? image : '');
}

function labelText(compiled: CompiledVectorLayer, feature: Feature) {
  const { layer, read } = compiled;
  const field = read('text-field', feature);
  if (field !== undefined && typeof field !== 'string' && !(field instanceof Formatted)) {
    vectorUnsupported(`Label "${layer.id}" has unsupported formatted content.`);
  }
  let text = (field?.toString() ?? '').replaceAll(/\{([^}]+)\}/g, (_, name: string) => String(feature.properties[name] ?? '')).normalize('NFC');
  const transform = read('text-transform', feature);
  if (transform === 'uppercase') text = text.toUpperCase();
  else if (transform === 'lowercase') text = text.toLowerCase();
  const icon = visibleIcon(compiled, feature);
  if (icon && !text.trim()) text = markerName(feature, icon);
  return { text, icon };
}

function labelKey(layerId: string, feature: Feature, text: string, position: string) {
  return `${layerId}/${feature.id ?? `${text}/${position}`}`;
}

function longestPath(rings: readonly (readonly VectorPoint[])[]) {
  let path = rings[0];
  for (const ring of rings) if (!path || pathLength(ring) > pathLength(path)) path = ring;
  return path;
}

export function vectorLabelCandidate(compiled: CompiledVectorLayer, feature: Feature, rings: readonly (readonly VectorPoint[])[]): LabelCandidate | undefined {
  const { layer, read, number, color } = compiled;
  const { text, icon } = labelText(compiled, feature);
  if (!text.trim()) return;
  if (text.length > 256) vectorUnsupported(`Label "${layer.id}" exceeds the 256-character safety limit.`);
  let path = longestPath(rings);
  if (!path?.length) return;
  const isShield = /road_|shield|motorway|interstate/.test(icon);
  const isPoint = isShield || read('symbol-placement', feature) === 'point' || path.length === 1;
  if (isPoint && path.length > 1) path = [samplePath(path, pathLength(path) / 2)];
  const size = number('text-size', feature);
  if (size <= 0) return;
  if (size > 256) vectorUnsupported(`Label "${layer.id}" exceeds the 256-pixel type size budget.`);
  const key = labelKey(layer.id, feature, text, isPoint ? `${Math.round(path[0].x)},${Math.round(path[0].y)}` : '');
  return {
    key, layerId: layer.id, text, path, size, point: isPoint, icon,
    markerColor: color('icon-color', feature, number('icon-opacity', feature)),
    spacing: number('text-letter-spacing', feature) * size,
    color: color('text-color', feature, number('text-opacity', feature)),
    halo: color('text-halo-color', feature, number('text-opacity', feature)),
    haloWidth: number('text-halo-width', feature),
  };
}

function samplePath(path: readonly VectorPoint[], distance: number) {
  for (let index = 1; index < path.length; index++) {
    const start = path[index - 1], end = path[index];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length === 0) continue;
    if (distance <= length || index === path.length - 1) {
      const t = distance / length;
      return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t, angle: Math.atan2(end.y - start.y, end.x - start.x) };
    }
    distance -= length;
  }
  return { ...path[0], angle: 0 };
}

function labelGlyphs(label: LabelCandidate, font: PDFFont, supported: ReadonlySet<number>): VectorText['glyphs'] {
  const characters = [...label.text.replaceAll(/\s+/g, ' ')];
  for (const character of characters) {
    if (!supported.has(character.codePointAt(0)!)) {
      vectorUnsupported(`The bundled Noto Sans Latin font cannot encode "${character}" in "${label.text}". Choose a Latin map language or Hybrid mode.`);
    }
  }
  const widths = characters.map((character) => font.widthOfTextAtSize(character, label.size));
  const total = widths.reduce((sum, width) => sum + width, 0) + label.spacing * Math.max(0, characters.length - 1);
  const length = pathLength(label.path);
  if (!label.point && total + label.size * 2 > length) return [];
  let path = label.path;
  const midpoint = samplePath(path, length / 2);
  if (!label.point && Math.abs(midpoint.angle) > Math.PI / 2) {
    const reversed = [...path];
    reversed.reverse();
    path = reversed;
  }
  let position = ((label.point ? 0 : length) - total) / 2;
  return characters.map((text, index) => {
    const width = widths[index];
    const sample = label.point ? { ...path[0], angle: 0 } : samplePath(path, position + width / 2);
    const x = label.point ? sample.x + position : sample.x - width / 2 * Math.cos(sample.angle);
    const y = label.point ? sample.y - (label.icon ? label.size * 0.65 : -label.size * 0.35) : sample.y - width / 2 * Math.sin(sample.angle);
    position += width + label.spacing;
    return { text, x, y, angle: sample.angle };
  });
}

type LabelBox = { left: number; top: number; right: number; bottom: number };

function labelBox(glyphs: VectorText['glyphs'], size: number): LabelBox {
  const xs = glyphs.map(({ x }) => x), ys = glyphs.map(({ y }) => y);
  return { left: Math.min(...xs) - 2, right: Math.max(...xs) + size + 2, top: Math.min(...ys) - size - 2, bottom: Math.max(...ys) + size * 0.3 + 2 };
}

function iconPath(label: LabelCandidate, box: LabelBox): VectorPath {
  const center = label.point ? label.path[0] : samplePath(label.path, pathLength(label.path) / 2);
  const isShield = /road_|shield|motorway|interstate/.test(label.icon);
  return {
    rings: [isShield ? [
      { x: box.left - 2, y: box.top - 1 }, { x: box.right + 2, y: box.top - 1 },
      { x: box.right + 2, y: box.bottom + 1 }, { x: box.left - 2, y: box.bottom + 1 },
    ] : vectorCircle(center, Math.max(2, label.size * 0.18))],
    closed: true, fill: isShield ? [1, 1, 1, label.markerColor[3]] : label.markerColor, stroke: label.markerColor, width: 0.75,
  };
}

function uniqueLabels(candidates: readonly LabelCandidate[]) {
  const unique = new Map<string, LabelCandidate>();
  for (const candidate of candidates) {
    const prior = unique.get(candidate.key);
    if (!prior || pathLength(candidate.path) > pathLength(prior.path)) unique.set(candidate.key, candidate);
  }
  if (unique.size > 10_000) vectorUnsupported('The map exceeds the 10,000-label layout budget. Zoom in.');
  const labels = [...unique.values()];
  labels.reverse();
  return labels;
}

function isOutsidePage(box: LabelBox, projection: VectorProjection): boolean {
  return box.right < 0 || box.bottom < 0 || box.left > projection.width || box.top > projection.height;
}

export function layoutVectorLabels(candidates: readonly LabelCandidate[], font: PDFFont, projection: VectorProjection) {
  const supported = new Set(font.getCharacterSet());
  const occupied: LabelBox[] = [];
  const byLayer = new Map<string, { paths: VectorPath[]; texts: VectorText[] }>();
  // Later place/country layers get priority over minor road and water labels.
  for (const label of uniqueLabels(candidates)) {
    const glyphs = labelGlyphs(label, font, supported);
    if (glyphs.length === 0) continue;
    const box = labelBox(glyphs, label.size);
    if (isOutsidePage(box, projection)) continue;
    if (occupied.some((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) continue;
    occupied.push(box);
    const group = byLayer.get(label.layerId) ?? { paths: [], texts: [] };
    if (label.icon) group.paths.push(iconPath(label, box));
    group.texts.push({ text: label.text, size: label.size, color: label.color, halo: label.halo, haloWidth: label.haloWidth, glyphs });
    byLayer.set(label.layerId, group);
  }
  return byLayer;
}

export type VectorFontAsset = NonNullable<VectorBasemapScene['font']>;
