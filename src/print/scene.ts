import type { ContentLayer, LayerGeometry, LayerType, ProjectDocument } from '../domain/project';
import { ROUTE_TRAVEL_PROFILE_MARKERS } from '../domain/routeProfiles';
import { resolvePrintLayerStyle } from './layerStyle';
import { serializePoiMarker } from './poiMarker';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';

export type PagePoint = Readonly<{ x: number; y: number }>;

export type CoordinateProjector = (
  coordinate: readonly [number, number],
  context: Readonly<{
    layerId: string;
    pageWidthMm: number;
    pageHeightMm: number;
  }>,
) => PagePoint;

export type RasterBasemapAsset = Readonly<{ dataUri: string; pixelWidth: number; pixelHeight: number }>;

export type PrintSceneOptions = Readonly<{
  basemap: RasterBasemapAsset; attribution: string; project: CoordinateProjector;
  metadata?: string;
}>;

export class PrintSceneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrintSceneError';
  }
}

const expectedGeometry: Readonly<Record<Exclude<LayerType, 'basemap'>, LayerGeometry['type']>> = {
  route: 'LineString',
  poi: 'Point',
  shape: 'Polygon',
};

function escapeXml(value: string): string {
  return value.replaceAll(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[character] as string);
}

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new PrintSceneError(`${label} must be a finite positive number.`);
  }
  return value;
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function formatDimension(value: number): string {
  return Object.is(value, -0) ? '0' : String(value);
}

function opacityValue(layer: ContentLayer): string {
  if (!Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 100) {
    throw new PrintSceneError(`Layer "${layer.id}" has an invalid opacity.`);
  }
  return formatNumber(layer.opacity / 100);
}

function hashIdentifier(value: string): string {
  let hash = 0x81_1C_9D_C5;
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index) as number;
    const codeUnit = codePoint > 65_535
      ? Math.floor((codePoint - 65_536) / 1024) + 55_296
      : codePoint;
    hash ^= codeUnit;
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  return (hash >>> 0).toString(36);
}

function stableLayerId(layerId: string): string {
  const slug = layerId
    .normalize('NFKD')
    .replaceAll(/[\u{0300}-\u{036F}]/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 48) || 'item';
  return `layer-${slug}-${hashIdentifier(layerId)}`;
}

function decodeRasterDataUri(dataUri: string): { mime: 'png' | 'jpeg' | 'webp'; bytes: string } {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUri);
  if (!match || match[2].length % 4 !== 0) {
    throw new PrintSceneError('The basemap must be an embedded base64 PNG, JPEG, or WebP asset.');
  }
  try {
    return { mime: match[1] as 'png' | 'jpeg' | 'webp', bytes: atob(match[2]) };
  } catch {
    throw new PrintSceneError('The basemap contains invalid base64 image data.');
  }
}

function hasBytes(bytes: string, offset: number, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes.codePointAt(offset + index) === value);
}

const isInteger = Number.isInteger.bind(Number);

function hasValidRasterSignature(mime: 'png' | 'jpeg' | 'webp', bytes: string): boolean {
  if (mime === 'png') {
    return bytes.length >= 16
      && hasBytes(bytes, 0, [137, 80, 78, 71, 13, 10, 26, 10])
      && hasBytes(bytes, bytes.length - 8, [73, 69, 78, 68, 174, 66, 96, 130]);
  }
  if (mime === 'jpeg') {
    return bytes.length >= 4
      && hasBytes(bytes, 0, [255, 216, 255])
      && hasBytes(bytes, bytes.length - 2, [255, 217]);
  }
  return bytes.length >= 12
    && hasBytes(bytes, 0, [82, 73, 70, 70])
    && hasBytes(bytes, 8, [87, 69, 66, 80]);
}

function validateBasemap(asset: RasterBasemapAsset | undefined): void {
  if (!asset || typeof asset.dataUri !== 'string') {
    throw new PrintSceneError('A raster basemap asset is required.');
  }
  finitePositive(asset.pixelWidth, 'Basemap pixel width');
  finitePositive(asset.pixelHeight, 'Basemap pixel height');
  if (!isInteger(asset.pixelWidth) || !isInteger(asset.pixelHeight)) {
    throw new PrintSceneError('Basemap pixel dimensions must be integers.');
  }

  const { mime, bytes } = decodeRasterDataUri(asset.dataUri);
  if (!hasValidRasterSignature(mime, bytes)) {
    throw new PrintSceneError(`The basemap data does not contain a valid ${mime.toUpperCase()} signature.`);
  }
}

function projectCoordinate(
  coordinate: readonly [number, number],
  layer: ContentLayer,
  options: PrintSceneOptions,
  page: Readonly<{ width: number; height: number }>,
): PagePoint {
  if (coordinate.length !== 2 || coordinate.some((value) => !Number.isFinite(value))) {
    throw new PrintSceneError(`Layer "${layer.id}" contains an invalid coordinate.`);
  }
  let point: PagePoint;
  try {
    point = options.project([coordinate[0], coordinate[1]], {
      layerId: layer.id,
      pageWidthMm: page.width,
      pageHeightMm: page.height,
    });
  } catch {
    throw new PrintSceneError(`The coordinate projector failed for layer "${layer.id}".`);
  }
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new PrintSceneError(`The coordinate projector returned an invalid page point for layer "${layer.id}".`);
  }
  return point;
}

function pointText(point: PagePoint): string {
  return `${formatNumber(point.x)} ${formatNumber(point.y)}`;
}

function routeTravelModeMarker(
  layer: ContentLayer,
  points: readonly PagePoint[],
  color: string,
): string {
  const appearance = layer.appearance?.kind === 'route' ? layer.appearance : undefined;
  if (!appearance?.showTravelModeIcon) return '';
  const point = points[Math.floor((points.length - 1) / 2)];
  const label = ROUTE_TRAVEL_PROFILE_MARKERS[appearance.travelProfile];
  return `<g data-route-travel-profile="${appearance.travelProfile}" aria-label="${escapeXml(label)} travel-mode marker"><circle cx="${formatNumber(point.x)}" cy="${formatNumber(point.y)}" r="4" fill="${escapeXml(color)}" stroke="#ffffff" stroke-width="0.6"/><text x="${formatNumber(point.x)}" y="${formatNumber(point.y)}" fill="#ffffff" font-family="sans-serif" font-size="1.8" font-weight="700" text-anchor="middle" dominant-baseline="middle">${escapeXml(label)}</text></g>`;
}

function geometryElement(
  layer: ContentLayer,
  options: PrintSceneOptions,
  context: Readonly<{ assets: Record<string, CustomMarkerAsset>; width: number; height: number }>,
): string {
  const { assets, width, height } = context;
  if (layer.type === 'basemap') throw new PrintSceneError('Unexpected basemap geometry request.');
  const geometry = layer.geometry;
  if (!geometry || geometry.type !== expectedGeometry[layer.type]) {
    throw new PrintSceneError(`Layer "${layer.id}" is missing valid ${expectedGeometry[layer.type]} geometry.`);
  }
  const style = resolvePrintLayerStyle(layer, (message) => { throw new PrintSceneError(message); });
  const stroke = `stroke="${escapeXml(style.stroke)}" stroke-width="${formatNumber(style.strokeWidthMm)}"`;

  if (geometry.type === 'Point') {
    const point = projectCoordinate(geometry.coordinates, layer, options, { width, height });
    return serializePoiMarker({
      appearance: layer.appearance?.kind === 'poi' ? layer.appearance : undefined,
      assets,
      point,
      style,
    });
  }
  if (geometry.type === 'LineString') {
    if (geometry.coordinates.length < 2) {
      throw new PrintSceneError(`Layer "${layer.id}" route must contain at least two coordinates.`);
    }
    const points = geometry.coordinates.map((coordinate) => (
      projectCoordinate(coordinate, layer, options, { width, height })
    ));
    const commands = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${pointText(point)}`).join(' ');
    return `<path d="${commands}" fill="none" ${stroke} stroke-linecap="round" stroke-linejoin="round"/>${routeTravelModeMarker(layer, points, style.stroke)}`;
  }

  if (geometry.coordinates.length === 0) {
    throw new PrintSceneError(`Layer "${layer.id}" polygon must contain at least one ring.`);
  }
  const rings = geometry.coordinates.map((ring) => {
    if (ring.length < 4) {
      throw new PrintSceneError(`Layer "${layer.id}" polygon rings must contain at least four coordinates.`);
    }
    const first = ring[0];
    const last = ring.at(-1);
    if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
      throw new PrintSceneError(`Layer "${layer.id}" polygon rings must be closed.`);
    }
    return ring
      .map((coordinate, index) => `${index === 0 ? 'M' : 'L'} ${pointText(projectCoordinate(coordinate, layer, options, { width, height }))}`)
      .join(' ') + ' Z';
  });
  return `<path d="${rings.join(' ')}" fill="${escapeXml(style.fill)}" ${stroke} fill-rule="evenodd" stroke-linejoin="round"/>`;
}

function layerGroupAttributes(layer: ContentLayer, role: 'raster-basemap' | 'vector-overlay'): string {
  const visibility = layer.visible ? 'visible' : 'hidden';
  return [
    `id="${stableLayerId(layer.id)}"`,
    `data-scene-role="${role}"`,
    `data-layer-id="${escapeXml(layer.id)}"`,
    `data-layer-name="${escapeXml(layer.name)}"`,
    `visibility="${visibility}"`,
    `opacity="${opacityValue(layer)}"`,
    'clip-path="url(#page-clip)"',
  ].join(' ');
}

function requiredAttribution(options: PrintSceneOptions): string {
  const attribution = options.attribution?.replaceAll(/\s+/g, ' ').trim();
  if (!attribution) {
    throw new PrintSceneError('Map attribution is required for the print scene.');
  }
  return attribution;
}

function splitLayers(layers: readonly ContentLayer[]): {
  basemapLayer: ContentLayer;
  vectorLayers: ContentLayer[];
} {
  const layerIds = new Set<string>();
  for (const layer of layers) {
    if (!layer.id || !layer.name || layerIds.has(layer.id)) {
      throw new PrintSceneError('Every layer must have a unique non-empty ID and name.');
    }
    layerIds.add(layer.id);
  }
  const basemapLayers = layers.filter((layer) => layer.type === 'basemap');
  if (basemapLayers.length !== 1) {
    throw new PrintSceneError('The project must contain exactly one basemap layer.');
  }
  return {
    basemapLayer: basemapLayers[0] as ContentLayer,
    vectorLayers: layers.filter((layer) => layer.type !== 'basemap'),
  };
}

function validatedLayers(layers: readonly ContentLayer[]): readonly ContentLayer[] {
  if (!Array.isArray(layers)) {
    throw new PrintSceneError('Project layers are unavailable.');
  }
  return layers;
}

function validateSceneInputs(document: ProjectDocument, options: PrintSceneOptions) {
  finitePositive(document.page?.widthMm, 'Page width');
  finitePositive(document.page?.heightMm, 'Page height');
  if (!options || typeof options.project !== 'function') {
    throw new PrintSceneError('A coordinate-to-page-point projector is required.');
  }
  const width = document.page.widthMm;
  const height = document.page.heightMm;
  validateBasemap(options.basemap);
  const attribution = requiredAttribution(options);
  const layers = validatedLayers(document.layers);
  return { width, height, attribution, ...splitLayers(layers) };
}

/**
 * Serializes a ProjectDocument into a deterministic, dependency-free SVG print scene.
 * The basemap is always one embedded raster image; route, POI, and shape layers remain vectors.
 */
export function serializePrintScene(document: ProjectDocument, options: PrintSceneOptions): string {
  const { width, height, attribution, basemapLayer, vectorLayers } = validateSceneInputs(document, options);
  const widthText = formatDimension(width);
  const heightText = formatDimension(height);
  const metadata = options.metadata?.replaceAll(/\s+/g, ' ').trim();

  const basemapGroup = `<g ${layerGroupAttributes(basemapLayer, 'raster-basemap')}><title>${escapeXml(basemapLayer.name)}</title><image href="${escapeXml(options.basemap.dataUri)}" x="0" y="0" width="${widthText}" height="${heightText}" preserveAspectRatio="xMidYMid slice" data-pixel-width="${options.basemap.pixelWidth}" data-pixel-height="${options.basemap.pixelHeight}"/></g>`;
  const vectorGroups = vectorLayers.map((layer) => (
    `<g ${layerGroupAttributes(layer, 'vector-overlay')}><title>${escapeXml(layer.name)}</title>${geometryElement(layer, options, { assets: document.assets, width, height })}</g>`
  ));
  const attributionHeight = Math.min(5, height);
  const attributionY = height - attributionHeight;
  const attributionGroup = `<g id="attribution" data-scene-role="attribution" data-layer-name="Attribution" clip-path="url(#page-clip)"><title>Attribution</title><rect x="0" y="${formatNumber(attributionY)}" width="${widthText}" height="${formatNumber(attributionHeight)}" fill="#ffffff" opacity="0.88"/><text x="2" y="${formatNumber(height - attributionHeight / 2)}" fill="#111827" font-family="sans-serif" font-size="2.5" dominant-baseline="middle">${escapeXml(attribution)}</text></g>`;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthText}mm" height="${heightText}mm" viewBox="0 0 ${widthText} ${heightText}" data-basemap-content="raster" data-overlay-content="vector">`,
    `<title>${escapeXml(document.title)}</title>`,
    '<desc>Layered print scene with one raster basemap and vector route, POI, and shape overlays.</desc>',
    `<metadata data-project-id="${escapeXml(document.id)}">${escapeXml(metadata || 'Raster basemap; vector overlays; physical dimensions in millimetres.')}</metadata>`,
    `<defs><clipPath id="page-clip"><rect x="0" y="0" width="${widthText}" height="${heightText}"/></clipPath></defs>`,
    basemapGroup,
    ...vectorGroups,
    attributionGroup,
    '</svg>',
  ].join('');
}
