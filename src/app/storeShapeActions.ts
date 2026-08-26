import { moveShapeVertex, replaceShapeGeometry } from '../domain/shapeGeometry';
import type { ProjectState } from './store';
import { commitDocument, replaceLayers, type ProjectSet } from './storeDocument';

type ShapeGeometryActions = Pick<ProjectState, 'setShapeGeometry' | 'setShapeVertex'>;

export function createShapeGeometryActions(set: ProjectSet): ShapeGeometryActions {
  return {
    setShapeGeometry: (id, geometry) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      if (!layer || layer.locked || !layer.visible) return state;
      const updatedLayer = replaceShapeGeometry(layer, geometry);
      if (!updatedLayer) return state;
      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((candidate) => candidate.id === id ? updatedLayer : candidate),
      ));
    }),
    setShapeVertex: (id, ringIndex, vertexIndex, coordinates) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      if (!layer || layer.locked || !layer.visible) return state;
      const updatedLayer = moveShapeVertex(layer, ringIndex, vertexIndex, coordinates);
      if (!updatedLayer) return state;

      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((candidate) => candidate.id === id ? updatedLayer : candidate),
      ));
    }),
  };
}
