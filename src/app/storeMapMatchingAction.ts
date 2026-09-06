import {
  normalizeCameraPrecision,
  type ContentLayer,
  type MapMatchingInput,
} from '../domain/project';
import { isValidPosition } from '../domain/routeGeometry';
import { arePositionsEqual, isCompleteRouteLayer, routePointValidationError, semanticRoutePoints } from '../domain/routeModel';
import {
  convertRoute,
  replaceRouteSemanticPoints,
} from '../domain/routeTransformations';
import type { ProjectState } from './store';
import { commitDocument, replaceLayers, type ProjectSet } from './storeDocument';
import { mutationRejected } from '../domain/projectMutation';

const PROFILES = new Set<MapMatchingInput['profile']>(['driving', 'cycling', 'walking']);

function canonicalGeometry(input: MapMatchingInput['geometry']): [number, number][] | null {
  if (!Array.isArray(input) || input.length < 2 || input.length > 50_000) return null;
  const geometry: [number, number][] = [];
  for (const position of input) {
    if (!Array.isArray(position) || position.length !== 2
      || typeof position[0] !== 'number' || typeof position[1] !== 'number') return null;
    const coordinate: [number, number] = [
      normalizeCameraPrecision(position[0]),
      normalizeCameraPrecision(position[1]),
    ];
    if (!isValidPosition(coordinate[0], coordinate[1])) return null;
    geometry.push(coordinate);
  }
  return geometry;
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
  const local = convertRoute(layer, 'straight');
  if (semanticRoutePoints(local ?? layer)?.length !== input.sourcePointCount) return null;
  // The transformation accepts unique semantic points and recreates the validated closing alias.
  const points = local?.route.closed ? input.geometry.slice(0, -1) : input.geometry;
  const transformed = local && replaceRouteSemanticPoints(local, points);
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
  return (id, candidate, expectedDocumentEpoch) => set((state) => {
      if (state.documentEpoch !== expectedDocumentEpoch) return mutationRejected('The project changed before the matched route could be applied. Try again.', 'stale');
      const layer = state.document.layers.find((item) => item.id === id);
      const input = canonicalInput(candidate);
      if (!input || !layer || layer.locked || !layer.visible || !isCompleteRouteLayer(layer)) return mutationRejected('This matched route cannot be applied. Check the result and unlock and show the route.');
      if (layer.route.closed && !arePositionsEqual(input.geometry[0], input.geometry.at(-1)!)) {
        return mutationRejected('The matched route does not close at its starting point. The closed route was kept. Use Open loop first if you want an open route.');
      }
      const pointError = routePointValidationError(input.geometry, { kind: 'straight', closed: layer.route.closed });
      if (pointError) return mutationRejected(`The matched geometry is invalid: ${pointError} The original route was kept.`);
      const nextLayer = mapMatchedLayer(layer, input);
      if (!nextLayer) return mutationRejected('The matched geometry is invalid for this route. The original route was kept.');
      return commitDocument(state, replaceLayers(state.document, state.document.layers.map((item) => (
        item.id === id ? nextLayer : item
      ))));
    });
}
