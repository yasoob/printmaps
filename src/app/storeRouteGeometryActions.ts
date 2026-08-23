import { insertRouteVertex, moveRouteVertex, removeRouteVertex } from '../domain/routeGeometry';
import type { ProjectState } from './store';
import { commitDocument, replaceLayers, type ProjectSet } from './storeDocument';

type RouteGeometryActions = Pick<ProjectState, 'insertRouteVertex' | 'removeRouteVertex' | 'setRouteVertex'>;

function commitRouteGeometry(
  set: ProjectSet,
  id: string,
  update: (layer: ProjectState['document']['layers'][number] | undefined) => ProjectState['document']['layers'][number] | null,
) {
  set((state) => {
    const layer = state.document.layers.find((candidate) => candidate.id === id);
    if (layer?.type !== 'route' || layer.locked || !layer.visible) return state;
    const updatedLayer = update(layer);
    if (!updatedLayer) return state;
    return commitDocument(state, replaceLayers(
      state.document,
      state.document.layers.map((candidate) => candidate.id === id ? updatedLayer : candidate),
    ));
  });
}

export function createRouteGeometryActions(set: ProjectSet): RouteGeometryActions {
  return {
    insertRouteVertex: (id, vertexIndex) => commitRouteGeometry(
      set,
      id,
      (layer) => insertRouteVertex(layer, vertexIndex),
    ),
    removeRouteVertex: (id, vertexIndex) => commitRouteGeometry(
      set,
      id,
      (layer) => removeRouteVertex(layer, vertexIndex),
    ),
    setRouteVertex: (id, vertexIndex, coordinates) => commitRouteGeometry(
      set,
      id,
      (layer) => moveRouteVertex(layer, vertexIndex, coordinates),
    ),
  };
}
