export type RouteVertexPreviewState = {
  hasUncommitted: boolean;
  lastPreview: {
    coordinate: [number, number];
    vertexIndex: number;
  } | null;
};

export function createRouteVertexPreviewState(): RouteVertexPreviewState {
  return { hasUncommitted: false, lastPreview: null };
}

export function clearRouteVertexPreview(
  state: RouteVertexPreviewState,
  hasUncommitted = false,
) {
  state.hasUncommitted = hasUncommitted;
  state.lastPreview = null;
}

export function recordRouteVertexPreview(
  state: RouteVertexPreviewState,
  vertexIndex: number,
  coordinate: readonly [number, number],
) {
  state.hasUncommitted = true;
  state.lastPreview = {
    coordinate: [coordinate[0], coordinate[1]],
    vertexIndex,
  };
}

export function isCurrentRouteVertexPreview(
  state: RouteVertexPreviewState,
  vertexIndex: number,
  coordinate: readonly [number, number],
) {
  const preview = state.lastPreview;
  return preview?.vertexIndex === vertexIndex
    && preview.coordinate[0] === coordinate[0]
    && preview.coordinate[1] === coordinate[1];
}
