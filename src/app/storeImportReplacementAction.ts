import type { LayerGeometry, LayerType } from '../domain/project';
import { cloneContentLayer } from '../domain/project';
import { MAX_PROJECT_COORDINATES } from '../domain/projectFile';
import { geometryPositionCount } from '../domain/projectGeometry';
import { isValidPosition } from '../domain/routeGeometry';
import { isEditableShapeRing } from '../domain/shapeGeometry';
import type { ProjectState } from './store';
import { commitDocument, replaceLayers, type ProjectSet } from './storeDocument';

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

export function createReplaceLayerFromImportAction(
  set: ProjectSet,
): ProjectState['replaceLayerFromImport'] {
  return (id, importedLayer, documentEpoch, sourceDocument) => {
    let wasReplaced = false;
    set((state) => {
      if (documentEpoch !== state.documentEpoch || sourceDocument !== state.document) return state;
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
      ) return state;
      const positionCount = state.document.layers.reduce((total, layer) => (
        total + geometryPositionCount(layer.id === id ? geometry : layer.geometry)
      ), 0);
      if (positionCount > MAX_PROJECT_COORDINATES) return state;
      wasReplaced = true;
      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((layer) => (
          layer.id === id ? { ...layer, geometry } : layer
        )),
      ));
    });
    return wasReplaced;
  };
}
