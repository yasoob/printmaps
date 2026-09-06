import { areShapeGeometriesEqual, moveShapeVertex, replaceShapeGeometry } from '../domain/shapeGeometry';
import type { ProjectState } from './store';
import { commitDocument, replaceLayers, type ProjectSet } from './storeDocument';
import { mutationRejected } from '../domain/projectMutation';
import type { ContentLayer } from '../domain/project';

type ShapeGeometryActions = Pick<ProjectState, 'setShapeGeometry' | 'setShapeVertex'>;

function isUnchangedVertex(layer: ContentLayer, ringIndex: number, vertexIndex: number, coordinates: readonly [number, number]) {
  const ring = layer.geometry?.type === 'Polygon' ? layer.geometry.coordinates[ringIndex] : null;
  const point = ring?.[vertexIndex];
  return Boolean(point && vertexIndex < ring!.length - 1 && point[0] === coordinates[0] && point[1] === coordinates[1]);
}

export function createShapeGeometryActions(set: ProjectSet): ShapeGeometryActions {
  return {
    setShapeGeometry: (id, geometry) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      if (layer?.type !== 'shape' || layer.locked || !layer.visible) return mutationRejected('Unlock and show this area before editing it.', 'unavailable');
      if ((layer.geometry?.type === 'Polygon' || layer.geometry?.type === 'MultiPolygon')
        && areShapeGeometriesEqual(layer.geometry, geometry)) return state;
      const updatedLayer = replaceShapeGeometry(layer, geometry);
      if (!updatedLayer) return mutationRejected('This area edit is invalid. The original area was kept.');
      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((candidate) => candidate.id === id ? updatedLayer : candidate),
      ));
    }),
    setShapeVertex: (id, ringIndex, vertexIndex, coordinates) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      if (layer?.type !== 'shape' || layer.locked || !layer.visible) return mutationRejected('Unlock and show this area before editing it.', 'unavailable');
      if (isUnchangedVertex(layer, ringIndex, vertexIndex, coordinates)) return state;
      const updatedLayer = moveShapeVertex(layer, ringIndex, vertexIndex, coordinates);
      if (!updatedLayer) return mutationRejected('This area point is invalid. The original area was kept.');

      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((candidate) => candidate.id === id ? updatedLayer : candidate),
      ));
    }),
  };
}
