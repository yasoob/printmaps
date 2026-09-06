import type { ContentLayer, LayerGeometry, LayerType } from '../domain/project';
import { cloneContentLayer } from '../domain/project';
import { mutationRejected } from '../domain/projectMutation';
import { isValidPosition } from '../domain/routeGeometry';
import {
  arePositionsEqual,
  isCompleteRouteLayer,
  routePositionKey,
  semanticRoutePoints,
} from '../domain/routeModel';
import { isEditableShapeRing } from '../domain/shapeGeometry';
import type { ProjectState } from './store';
import { commitDocument, hasSameDocumentContent, replaceLayers, type ProjectSet } from './storeDocument';

function positionIsValid([longitude, latitude]: readonly [number, number]) {
  return isValidPosition(longitude, latitude);
}

function ringIsValid(ring: readonly (readonly [number, number])[]) {
  return isEditableShapeRing(ring)
    && ring.every((position) => positionIsValid(position));
}

function isGeometryCompatible(type: LayerType, geometry: LayerGeometry): boolean {
  if (type === 'route' && geometry.type === 'LineString') {
    return geometry.coordinates.length >= 2
      && geometry.coordinates.every((position) => positionIsValid(position));
  }
  if (type === 'poi' && geometry.type === 'Point') return positionIsValid(geometry.coordinates);
  if (type === 'shape' && geometry.type === 'Polygon') {
    return geometry.coordinates.length > 0
      && geometry.coordinates.every((ring) => ringIsValid(ring));
  }
  if (type === 'shape' && geometry.type === 'MultiPolygon') {
    return geometry.coordinates.length > 0
      && geometry.coordinates.every((polygon) => (
        polygon.length > 0 && polygon.every((ring) => ringIsValid(ring))
      ));
  }
  return false;
}

function semanticLegKey(
  start: readonly [number, number],
  end: readonly [number, number],
) {
  const left = routePositionKey(start);
  const right = routePositionKey(end);
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function replaceImportedRoute(
  target: ContentLayer,
  geometry: Extract<LayerGeometry, { type: 'LineString' }>,
): ContentLayer | null {
  if (!isCompleteRouteLayer(target)) return null;
  const currentPoints = semanticRoutePoints(target)!;
  const stylesByLeg = new Map(
    currentPoints.slice(1).map((point, index) => [
      semanticLegKey(currentPoints[index], point),
      target.appearance.segmentStyles[index],
    ]),
  );
  const replacement = cloneContentLayer(target);
  const closed = arePositionsEqual(
    geometry.coordinates[0],
    geometry.coordinates.at(-1)!,
  );
  replacement.route = { kind: 'straight', closed };
  replacement.geometry = geometry;
  replacement.appearance = {
    ...target.appearance,
    marker: target.appearance.marker && {
      ...target.appearance.marker,
      placement: { ...target.appearance.marker.placement },
    },
    segmentStyles: geometry.coordinates.slice(1).map((point, index) => {
      const style = stylesByLeg.get(
        semanticLegKey(geometry.coordinates[index], point),
      );
      return style ? { ...style } : null;
    }),
  };
  delete replacement.provenance;
  return isCompleteRouteLayer(replacement) ? replacement : null;
}

function replacementLayer(
  target: ContentLayer,
  geometry: LayerGeometry,
): ContentLayer | null {
  if (target.type === 'route' && geometry.type === 'LineString') {
    return replaceImportedRoute(target, geometry);
  }
  return { ...target, geometry };
}

export function createReplaceLayerFromImportAction(
  set: ProjectSet,
): ProjectState['replaceLayerFromImport'] {
  return (id, importedLayer, documentEpoch, sourceDocument) => set((state) => {
      if (documentEpoch !== state.documentEpoch || !hasSameDocumentContent(sourceDocument, state.document)) return mutationRejected('The project changed before the replacement could be applied. Choose the data again.', 'stale');
      const target = state.document.layers.find((layer) => layer.id === id);
      const importedCopy = cloneContentLayer(importedLayer);
      const geometry = importedCopy.geometry;
      if (
        !target
        || !geometry
        || target.locked
        || target.type === 'basemap'
        || importedCopy.type !== target.type
        || !isGeometryCompatible(target.type, geometry)
      ) return mutationRejected('This data cannot replace the selected layer. Use matching geometry and unlock the layer.');
      const replacement = replacementLayer(target, geometry);
      if (!replacement) return mutationRejected('The replacement geometry is invalid. The original layer was kept.');
      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((layer) => (
          layer.id === id ? replacement : layer
        )),
      ));
    });
}
