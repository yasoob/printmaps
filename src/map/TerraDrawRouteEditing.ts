import { isValidPosition } from '../domain/routeGeometry';
import { synchronizeRouteMoveClosure } from '../domain/routePointMovement';

type Position = [number, number];
type TerraFeature = {
  id?: string | number;
  geometry: { type: string; coordinates: unknown };
};
type TerraRouteEvent = 'change' | 'finish';
type TerraRouteListener = (...arguments_: never[]) => void;

export type TerraRouteDrawLike = {
  addFeatures: (features: unknown[]) => Array<{ id?: string | number; reason?: string; valid: boolean }>;
  clear: () => void;
  getSnapshot: () => TerraFeature[];
  on: (event: TerraRouteEvent, callback: TerraRouteListener) => void;
  selectFeature: (id: string | number) => void;
  setMode: (mode: string) => void;
  start: () => void;
  stop: () => void;
  undo: () => boolean;
  updateFeatureGeometry: (id: string | number, geometry: { type: string; coordinates: unknown }) => void;
};

type RouteSessionOptions = {
  draw: TerraRouteDrawLike;
  pointerTarget?: HTMLElement;
  initial?: { id: string; coordinates: readonly (readonly [number, number])[] };
  mode: 'draw' | 'edit';
  onCancel?: () => void;
  onCommit?: (coordinates: Position[]) => void;
  onFinish?: (coordinates: Position[]) => void;
  onPreview: (coordinates: Position[]) => void;
};

function trackPointerGesture(target: HTMLElement | undefined, onCancel: () => void) {
  let activePointer: number | null = null;
  const view = target?.ownerDocument.defaultView;
  const start = (event: PointerEvent) => {
    if (activePointer === null && event.isPrimary) activePointer = event.pointerId;
  };
  const end = (event: PointerEvent) => {
    if (activePointer === event.pointerId) activePointer = null;
  };
  const cancel = (event: PointerEvent) => {
    if (!event.isPrimary || activePointer !== event.pointerId) return;
    try { onCancel(); } finally { activePointer = null; }
  };
  target?.addEventListener('pointerdown', start, true);
  view?.addEventListener('pointerup', end, true);
  view?.addEventListener('pointercancel', cancel, true);
  return {
    isActive: () => activePointer !== null,
    destroy: () => {
      target?.removeEventListener('pointerdown', start, true);
      view?.removeEventListener('pointerup', end, true);
      activePointer = null;
      view?.removeEventListener('pointercancel', cancel, true);
    },
  };
}

function routeCoordinates(draw: TerraRouteDrawLike, id?: string | number): Position[] | null {
  const feature = draw.getSnapshot().find((candidate) => id === undefined || candidate.id === id);
  if (!feature || feature.geometry.type !== 'LineString' || !Array.isArray(feature.geometry.coordinates)) return null;
  const coordinates = feature.geometry.coordinates;
  if (coordinates.length === 0 || coordinates.some((position) => (
    !Array.isArray(position)
    || position.length < 2
    || typeof position[0] !== 'number'
    || typeof position[1] !== 'number'
    || !isValidPosition(position[0], position[1])
  ))) return null;
  return coordinates.map((position) => [position[0], position[1]] as Position);
}

function initializeSession(options: RouteSessionOptions) {
  const { draw, initial, mode } = options;
  draw.start();
  if (mode === 'draw') {
    draw.setMode('linestring');
    return;
  }
  if (!initial) throw new Error('A Terra Draw edit session requires an initial route.');
  const result = draw.addFeatures([{
    type: 'Feature',
    properties: { mode: 'linestring' },
    geometry: {
      type: 'LineString',
      coordinates: initial.coordinates.map((coordinate) => [...coordinate]),
    },
  }]);
  const validation = result[0];
  if (!validation?.valid || validation.id === undefined) {
    const detail = validation?.reason ? `: ${validation.reason}` : '';
    throw new Error(`Terra Draw rejected the selected route geometry${detail}.`);
  }
  draw.setMode('select');
  draw.selectFeature(validation.id);
  return validation.id;
}

function isUserGeometryChange(context?: { origin?: string; target?: string }) {
  return context?.origin !== 'api' && context?.target !== 'properties';
}

export function createTerraRouteSession(options: RouteSessionOptions) {
  const { draw } = options;
  const editingId = initializeSession(options);
  let isDestroyed = false;
  const gesture = trackPointerGesture(options.pointerTarget, () => options.onCancel?.());
  let currentCoordinates = options.initial?.coordinates ?? [];
  const handleChange = ((ids: Array<string | number>, _type: string, context?: { origin?: string; target?: string }) => {
    if (isDestroyed || !isUserGeometryChange(context)) return;
    const coordinates = routeCoordinates(draw, ids[0]);
    if (!coordinates) return;
    const preview = options.mode === 'draw' ? coordinates.slice(0, -1)
      : synchronizeRouteMoveClosure(currentCoordinates, coordinates);
    options.onPreview(preview);
  }) as TerraRouteListener;
  const handleFinish = ((id: string | number, context: { action: string }) => {
    if (isDestroyed) return;
    const coordinates = routeCoordinates(draw, id);
    if (!coordinates || coordinates.length < 2) return;
    const next = options.mode === 'edit'
      ? synchronizeRouteMoveClosure(currentCoordinates, coordinates) : coordinates;
    options.onPreview(next);
    // Terra finishes insertion at drag start; commit the combined gesture at drag end.
    if (context.action === 'insertMidpoint' && gesture.isActive()) return;
    if (context.action === 'draw') {
      if (options.mode === 'draw') options.onFinish?.(next);
      return;
    }
    if (options.mode === 'edit') {
      currentCoordinates = next;
      options.onCommit?.(next);
    }
  }) as TerraRouteListener;
  draw.on('change', handleChange);
  draw.on('finish', handleFinish);
  return {
    destroy: () => {
      if (isDestroyed) return false;
      const wasInteracting = gesture.isActive();
      isDestroyed = true;
      gesture.destroy();
      draw.stop();
      return wasInteracting;
    },
    updateGeometry: (coordinates: Position[]) => {
      if (isDestroyed) return false;
      const targetId = editingId
        ?? (options.mode === 'draw' ? draw.getSnapshot()[0]?.id : undefined);
      if (targetId === undefined) return false;
      try {
        draw.updateFeatureGeometry(targetId, {
          type: 'LineString', coordinates: coordinates.map((coordinate) => [...coordinate]),
        });
        currentCoordinates = coordinates.map((coordinate) => [...coordinate]);
        return true;
      } catch {
        return false;
      }
    },
    undo: () => !isDestroyed && draw.undo(),
  };
}
