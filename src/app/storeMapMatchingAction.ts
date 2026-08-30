import {
  normalizeCameraPrecision,
  type ContentLayer,
  type MapMatchingInput,
} from '../domain/project';
import { isValidPosition } from '../domain/routeGeometry';
import { isCompleteRouteLayer } from '../domain/routeModel';
import {
  convertRoute,
  openRoute,
  replaceRouteSemanticPoints,
} from '../domain/routeTransformations';
import type { ProjectState } from './store';
import { commitDocument, replaceLayers, type ProjectSet } from './storeDocument';

const PROFILES = new Set<MapMatchingInput['profile']>(['driving', 'cycling', 'walking']);

function canonicalGeometry(input: MapMatchingInput['geometry']): [number, number][] | null {
  if (!Array.isArray(input) || input.length < 2 || input.length > 50_000) return null;
  const geometry: [number, number][] = [];
  for (const position of input) {
    if (!Array.isArray(position) || position.length !== 2) return null;
    const coordinate: [number, number] = [
      normalizeCameraPrecision(position[0]),
      normalizeCameraPrecision(position[1]),
    ];
    if (!isValidPosition(coordinate[0], coordinate[1])) return null;
    geometry.push(coordinate);
  }
  const distinctPointCount = new Set(geometry.map(([longitude, latitude]) => `${longitude},${latitude}`)).size;
  return distinctPointCount === geometry.length ? geometry : null;
}

function isMetadataValid(input: MapMatchingInput): boolean {
  const isConfidenceValid = input.confidence === undefined
    || (Number.isFinite(input.confidence) && input.confidence >= 0 && input.confidence <= 1);
  return PROFILES.has(input.profile)
    && Number.isSafeInteger(input.sourcePointCount)
    && input.sourcePointCount >= 2
    && input.sourcePointCount <= 100
    && isConfidenceValid;
}

function canonicalInput(input: MapMatchingInput): MapMatchingInput | null {
  const geometry = canonicalGeometry(input.geometry);
  if (!geometry || !isMetadataValid(input)) return null;
  return {
    geometry,
    profile: input.profile,
    sourcePointCount: input.sourcePointCount,
    ...(input.confidence !== undefined && { confidence: input.confidence }),
  };
}

function mapMatchedLayer(
  layer: ContentLayer,
  input: MapMatchingInput,
): ContentLayer | null {
  let local = convertRoute(layer, 'straight');
  if (local?.route.closed) local = openRoute(local);
  const transformed = local && replaceRouteSemanticPoints(local, input.geometry);
  if (!transformed) return null;
  const candidate: ContentLayer = {
    ...transformed,
    provenance: {
      provider: 'mapbox',
      service: 'map-matching-v5',
      profile: input.profile,
      sourcePointCount: input.sourcePointCount,
      ...(input.confidence !== undefined && { confidence: input.confidence }),
    },
  };
  return isCompleteRouteLayer(candidate) ? candidate : null;
}

export function createMapMatchingAction(set: ProjectSet): ProjectState['applyMapMatching'] {
  return (id, candidate, expectedDocumentEpoch) => {
    let didApply = false;
    set((state) => {
      if (state.documentEpoch !== expectedDocumentEpoch) return state;
      const layer = state.document.layers.find((item) => item.id === id);
      const input = canonicalInput(candidate);
      if (!input || !layer || layer.locked || !layer.visible || layer.type !== 'route') return state;
      const nextLayer = mapMatchedLayer(layer, input);
      if (!nextLayer) return state;
      didApply = true;
      return commitDocument(state, replaceLayers(state.document, state.document.layers.map((item) => (
        item.id === id ? nextLayer : item
      ))));
    });
    return didApply;
  };
}
