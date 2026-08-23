import { moveShapeVertex } from '../domain/shapeGeometry';
import type { ProjectState } from './store';
import { commitDocument, replaceLayers, type ProjectSet } from './storeDocument';

type ShapeGeometryActions = Pick<ProjectState, 'setShapeVertex'>;

export function createShapeGeometryActions(set: ProjectSet): ShapeGeometryActions {
  return {
    setShapeVertex: (id, ringIndex, vertexIndex, coordinates) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      const updatedLayer = moveShapeVertex(layer, ringIndex, vertexIndex, coordinates);
      if (!updatedLayer) return state;

      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((candidate) => candidate.id === id ? updatedLayer : candidate),
      ));
    }),
  };
}
