import {
  createDefaultLayerAppearance,
  type ContentLayer,
  type LayerGeometry,
  type LayerType,
} from '../domain/project';

export const MAX_GPX_KML_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_GPX_KML_FEATURES = 1000;
export const MAX_GPX_KML_COORDINATES = 200_000;
export const MAX_GPX_KML_NAME_LENGTH = 100;

const DECIMAL_NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu;

export type GpxKmlImportOptions = {
  existingLayerIds?: Iterable<string>;
};

export type CoordinateCounter = { value: number };

export class GpxKmlImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GpxKmlImportError';
  }
}

export function parseXml(text: string, format: 'GPX' | 'KML'): XMLDocument {
  if (new TextEncoder().encode(text).byteLength > MAX_GPX_KML_FILE_BYTES) {
    throw new GpxKmlImportError(
      `${format} files may be at most ${MAX_GPX_KML_FILE_BYTES} bytes.`,
    );
  }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/iu.test(text)) {
    throw new GpxKmlImportError(`${format} DTD and entity declarations are not allowed.`);
  }
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new GpxKmlImportError(`This file is not valid ${format} XML.`);
  }
  return document;
}

export function directChildren(element: Element, localName?: string): Element[] {
  const children = [...element.children].filter((child) => child.namespaceURI === element.namespaceURI);
  return localName === undefined
    ? children
    : children.filter((child) => child.localName === localName);
}

export function directChild(element: Element, localName: string): Element | undefined {
  return directChildren(element, localName)[0];
}

export function finiteNumber(value: string | null, label: string): number {
  const decimalValue = value?.trim();
  if (!decimalValue || !DECIMAL_NUMBER_PATTERN.test(decimalValue)) {
    throw new GpxKmlImportError(`${label} must be a finite number.`);
  }
  const number = Number(decimalValue);
  if (!Number.isFinite(number)) {
    throw new GpxKmlImportError(`${label} must be a finite number.`);
  }
  return number;
}

export function position(
  longitudeValue: string | null,
  latitudeValue: string | null,
  label: string,
  counter: CoordinateCounter,
): [number, number] {
  const longitude = finiteNumber(longitudeValue, `${label} longitude`);
  const latitude = finiteNumber(latitudeValue, `${label} latitude`);
  if (Math.abs(longitude) > 180) {
    throw new GpxKmlImportError(`${label} longitude must be between -180 and 180.`);
  }
  if (Math.abs(latitude) > 90) {
    throw new GpxKmlImportError(`${label} latitude must be between -90 and 90.`);
  }
  counter.value += 1;
  if (counter.value > MAX_GPX_KML_COORDINATES) {
    throw new GpxKmlImportError(
      `GPX/KML may contain at most ${MAX_GPX_KML_COORDINATES} positions.`,
    );
  }
  return [longitude, latitude];
}

export function sanitizeName(value: string | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  const sanitized = value
    .normalize('NFKC')
    .replaceAll(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
  const bounded = [...sanitized].slice(0, MAX_GPX_KML_NAME_LENGTH).join('').trimEnd();
  return bounded || fallback;
}

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .replaceAll(/[\u{0300}-\u{036F}]/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .slice(0, 64)
    .replaceAll(/-$/g, '');
}

function uniqueId(prefix: string, name: string, fallback: string, usedIds: Set<string>): string {
  const baseId = `${prefix}-${slug(name) || slug(fallback)}`;
  let id = baseId;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

type LayerOptions = {
  prefix: string;
  name: string;
  fallback: string;
  geometry: LayerGeometry;
  usedIds: Set<string>;
};

export function createLayer({
  prefix,
  name,
  fallback,
  geometry,
  usedIds,
}: LayerOptions): ContentLayer {
  const layerTypes: Record<LayerGeometry['type'], LayerType> = {
    Point: 'poi',
    LineString: 'route',
    Polygon: 'shape',
  };
  const type = layerTypes[geometry.type];
  return {
    id: uniqueId(prefix, name, fallback, usedIds),
    name,
    type,
    visible: true,
    locked: false,
    opacity: 100,
    appearance: createDefaultLayerAppearance(type),
    geometry,
  };
}
