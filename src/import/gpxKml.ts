import type { ContentLayer, LayerGeometry } from '../domain/project';
import {
  createLayer,
  directChild,
  directChildren,
  finiteNumber,
  GpxKmlImportError,
  MAX_GPX_KML_FEATURES,
  parseXml,
  position,
  sanitizeName,
  type CoordinateCounter,
  type GpxKmlImportOptions,
} from './gpxKmlShared';

export {
  GpxKmlImportError,
  MAX_GPX_KML_COORDINATES,
  MAX_GPX_KML_FEATURES,
  MAX_GPX_KML_FILE_BYTES,
  MAX_GPX_KML_NAME_LENGTH,
  type GpxKmlImportOptions,
} from './gpxKmlShared';

type FeatureKind = 'Waypoint' | 'Route' | 'Track';

const GPX_NAMESPACES = new Set([
  '',
  // eslint-disable-next-line unicorn/prefer-https -- This fixed URI is the official XML namespace identifier.
  'http://www.topografix.com/GPX/1/0',
  // eslint-disable-next-line unicorn/prefer-https -- This fixed URI is the official XML namespace identifier.
  'http://www.topografix.com/GPX/1/1',
]);
const KML_NAMESPACES = new Set([
  '',
  // eslint-disable-next-line unicorn/prefer-https -- These fixed URIs are official XML namespace identifiers.
  'http://earth.google.com/kml/2.0',
  // eslint-disable-next-line unicorn/prefer-https -- These fixed URIs are official XML namespace identifiers.
  'http://earth.google.com/kml/2.1',
  // eslint-disable-next-line unicorn/prefer-https -- This fixed URI is the official XML namespace identifier.
  'http://www.opengis.net/kml/2.2',
]);

function gpxPoint(element: Element, label: string, counter: CoordinateCounter): [number, number] {
  return position(element.getAttribute('lon'), element.getAttribute('lat'), label, counter);
}

function gpxGeometry(
  element: Element,
  kind: FeatureKind,
  label: string,
  counter: CoordinateCounter,
): LayerGeometry {
  if (kind === 'Waypoint') {
    return { type: 'Point', coordinates: gpxPoint(element, label, counter) };
  }
  const trackSegments = kind === 'Track' ? directChildren(element, 'trkseg') : [];
  if (trackSegments.length > 1) {
    throw new GpxKmlImportError(`${label} has multiple segments, which are not supported.`);
  }
  const points = kind === 'Route'
    ? directChildren(element, 'rtept')
    : trackSegments.flatMap((segment) => directChildren(segment, 'trkpt'));
  if (points.length < 2) {
    throw new GpxKmlImportError(`${label} needs at least two positions.`);
  }
  return {
    type: 'LineString',
    coordinates: points.map((pointElement, index) => (
      gpxPoint(pointElement, `${label} position ${index + 1}`, counter)
    )),
  };
}

function gpxFeatureKind(element: Element): FeatureKind | undefined {
  if (element.localName === 'wpt') return 'Waypoint';
  if (element.localName === 'rte') return 'Route';
  if (element.localName === 'trk') return 'Track';
  return undefined;
}

/**
 * Imports GPX into the project's deliberately 2D geometry contract. Source
 * elevation and timestamp elements are retained by neither ContentLayer nor
 * LayerGeometry; longitude and latitude are projected without modification.
 */
export function parseGpxText(
  text: string,
  options: GpxKmlImportOptions = {},
): ContentLayer[] {
  const document = parseXml(text, 'GPX');
  const root = document.documentElement;
  if (root.localName !== 'gpx') {
    throw new GpxKmlImportError('GPX root element must be gpx.');
  }
  if (!GPX_NAMESPACES.has(root.namespaceURI ?? '')) {
    throw new GpxKmlImportError('GPX root namespace is not supported.');
  }
  const features = directChildren(root).flatMap((element) => {
    const kind = gpxFeatureKind(element);
    return kind === undefined ? [] : [{ element, kind }];
  });
  if (features.length === 0) {
    throw new GpxKmlImportError('GPX contains no supported features.');
  }
  if (features.length > MAX_GPX_KML_FEATURES) {
    throw new GpxKmlImportError(`GPX may contain at most ${MAX_GPX_KML_FEATURES} features.`);
  }
  const counter = { value: 0 };
  const usedIds = new Set(options.existingLayerIds);
  return features.map(({ element, kind }, index) => {
    const fallback = `${kind} ${index + 1}`;
    const name = sanitizeName(directChild(element, 'name')?.textContent ?? undefined, fallback);
    return createLayer({
      prefix: 'gpx',
      name,
      fallback,
      geometry: gpxGeometry(element, kind, fallback, counter),
      usedIds,
    });
  });
}

function descendantElements(element: Element, localName: string): Element[] {
  return [...element.querySelectorAll('*')].filter((child) => (
    child.localName === localName && child.namespaceURI === element.namespaceURI
  ));
}

function kmlPositions(
  element: Element,
  label: string,
  counter: CoordinateCounter,
): [number, number][] {
  const coordinateText = directChild(element, 'coordinates')?.textContent?.trim();
  if (!coordinateText) {
    throw new GpxKmlImportError(`${label} coordinates must not be empty.`);
  }
  return coordinateText.split(/\s+/).map((tuple, index) => {
    const values = tuple.split(',');
    if (values.length < 2 || values.length > 3 || values.some((value) => value.trim() === '')) {
      throw new GpxKmlImportError(
        `${label} position ${index + 1} must contain longitude, latitude, and optional altitude.`,
      );
    }
    if (values[2] !== undefined) finiteNumber(values[2], `${label} position ${index + 1} altitude`);
    return position(
      values[0],
      values[1],
      `${label} position ${index + 1}`,
      counter,
    );
  });
}

function kmlRing(
  boundary: Element | undefined,
  label: string,
  counter: CoordinateCounter,
): [number, number][] {
  const ringElement = boundary && directChild(boundary, 'LinearRing');
  if (!ringElement) throw new GpxKmlImportError(`${label} is missing its LinearRing.`);
  const ring = kmlPositions(ringElement, label, counter);
  if (ring.length < 4) {
    throw new GpxKmlImportError(`${label} needs at least four positions.`);
  }
  const first = ring[0];
  const last = ring.at(-1);
  if (!last || first[0] !== last[0] || first[1] !== last[1]) {
    throw new GpxKmlImportError(`${label} must end at its starting position.`);
  }
  return ring;
}

function kmlGeometry(
  placemark: Element,
  label: string,
  counter: CoordinateCounter,
): LayerGeometry {
  const geometryNames = new Set([
    'Point', 'LineString', 'Polygon', 'MultiGeometry', 'Model', 'Track', 'MultiTrack',
  ]);
  const geometries = directChildren(placemark).filter((child) => geometryNames.has(child.localName));
  if (geometries.length === 0) throw new GpxKmlImportError(`${label} has no geometry.`);
  if (geometries.length > 1) {
    throw new GpxKmlImportError(`${label} must contain exactly one geometry.`);
  }
  const geometry = geometries[0];
  if (geometry.localName !== 'Point' && geometry.localName !== 'LineString' && geometry.localName !== 'Polygon') {
    throw new GpxKmlImportError(`${label} geometry type ${geometry.localName} is not supported.`);
  }
  if (geometry.localName === 'Point') {
    const coordinates = kmlPositions(geometry, `${label} Point`, counter);
    if (coordinates.length !== 1) {
      throw new GpxKmlImportError(`${label} Point must contain exactly one position.`);
    }
    return { type: 'Point', coordinates: coordinates[0] };
  }
  if (geometry.localName === 'LineString') {
    const coordinates = kmlPositions(geometry, `${label} LineString`, counter);
    if (coordinates.length < 2) {
      throw new GpxKmlImportError(`${label} LineString needs at least two positions.`);
    }
    return { type: 'LineString', coordinates };
  }
  const outerBoundary = directChild(geometry, 'outerBoundaryIs');
  if (!outerBoundary) throw new GpxKmlImportError(`${label} Polygon needs an outer boundary.`);
  const outerRing = kmlRing(outerBoundary, `${label} Polygon outer ring`, counter);
  const innerRings = directChildren(geometry, 'innerBoundaryIs').map((boundary, index) => (
    kmlRing(boundary, `${label} Polygon inner ring ${index + 1}`, counter)
  ));
  return { type: 'Polygon', coordinates: [outerRing, ...innerRings] };
}

/**
 * Imports supported KML Placemark geometry into detached 2D project layers.
 */
export function parseKmlText(
  text: string,
  options: GpxKmlImportOptions = {},
): ContentLayer[] {
  const document = parseXml(text, 'KML');
  const root = document.documentElement;
  if (root.localName !== 'kml') {
    throw new GpxKmlImportError('KML root element must be kml.');
  }
  if (!KML_NAMESPACES.has(root.namespaceURI ?? '')) {
    throw new GpxKmlImportError('KML root namespace is not supported.');
  }
  const placemarks = descendantElements(root, 'Placemark');
  if (placemarks.length === 0) {
    throw new GpxKmlImportError('KML contains no supported features.');
  }
  if (placemarks.length > MAX_GPX_KML_FEATURES) {
    throw new GpxKmlImportError(`KML may contain at most ${MAX_GPX_KML_FEATURES} features.`);
  }
  const counter = { value: 0 };
  const usedIds = new Set(options.existingLayerIds);
  return placemarks.map((placemark, index) => {
    const label = `Placemark ${index + 1}`;
    const geometry = kmlGeometry(placemark, label, counter);
    const fallback = `${geometry.type === 'LineString' ? 'Line' : geometry.type} ${index + 1}`;
    const name = sanitizeName(directChild(placemark, 'name')?.textContent ?? undefined, fallback);
    return createLayer({ prefix: 'kml', name, fallback, geometry, usedIds });
  });
}
