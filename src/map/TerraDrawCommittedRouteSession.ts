import type { RefObject } from 'react';
import type { ContentLayer } from '../domain/project';
import type { ProjectMutationResult } from '../domain/projectMutation';
import { createTerraRouteSession, type TerraRouteDrawLike } from './TerraDrawRouteEditing';

export type CommittedRouteCallbacks = {
  editingLayer: ContentLayer | null;
  editorError?: (message: string | null) => void;
  onRouteGeometryChange: (id: string, coordinates: readonly (readonly [number, number])[]) => ProjectMutationResult;
  onRoutePreview: (id: string, coordinates: [number, number][] | null) => void;
};

export function routeCoordinates(layer: ContentLayer | null) {
  if (layer?.geometry?.type === 'LineString') return layer.geometry.coordinates;
}

export function createEditingSession(
  draw: TerraRouteDrawLike,
  route: ContentLayer,
  callbacks: RefObject<CommittedRouteCallbacks>,
  interaction: { pointerTarget: HTMLElement; onCancel: () => void },
) {
  const coordinates = routeCoordinates(route);
  if (!coordinates) return null;
  const session = createTerraRouteSession({
    draw, ...interaction,
    initial: { id: route.id, coordinates },
    mode: 'edit',
    onCommit: (nextCoordinates) => {
      callbacks.current.onRoutePreview(route.id, null);
      const result = callbacks.current.onRouteGeometryChange(route.id, nextCoordinates);
      if (result.ok) {
        callbacks.current.editorError?.(null);
        return;
      }
      const current = callbacks.current.editingLayer;
      const canonical = current?.id === route.id ? routeCoordinates(current) : null;
      if (canonical) session.updateGeometry(canonical);
      else draw.clear();
      callbacks.current.editorError?.(result.error);
    },
    onPreview: (nextCoordinates) => callbacks.current.onRoutePreview(route.id, nextCoordinates),
  });
  return session;
}
