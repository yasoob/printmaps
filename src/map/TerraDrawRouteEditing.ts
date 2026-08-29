import { isValidPosition } from '../domain/routeGeometry';

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
  initial?: { id: string; coordinates: readonly (readonly [number, number])[] };
  mode: 'draw' | 'edit';
  onCommit?: (coordinates: Position[]) => void;
  onFinish?: (coordinates: Position[]) => void;
  onPreview: (coordinates: Position[]) => void;
};

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

export function createTerraRouteSession(options: RouteSessionOptions) {
  const { draw } = options;
  const editingId = initializeSession(options);
  const handleChange = ((ids: Array<string | number>, _type: string, context?: { origin?: string; target?: string }) => {
    if (context?.origin === 'api' || context?.target === 'properties') return;
    const coordinates = routeCoordinates(draw, ids[0]);
    if (!coordinates) return;
    const preview = options.mode === 'draw' ? coordinates.slice(0, -1) : coordinates;
    options.onPreview(preview);
  }) as TerraRouteListener;
  const handleFinish = ((id: string | number, context: { action: string }) => {
    const coordinates = routeCoordinates(draw, id);
    if (!coordinates || coordinates.length < 2) return;
    options.onPreview(coordinates);
    if (options.mode === 'draw' && context.action === 'draw') options.onFinish?.(coordinates);
    if (options.mode === 'edit' && context.action !== 'draw') options.onCommit?.(coordinates);
  }) as TerraRouteListener;
  draw.on('change', handleChange);
  draw.on('finish', handleFinish);
  return {
    destroy: () => draw.stop(),
    updateGeometry: (coordinates: Position[]) => {
      if (editingId === undefined || options.mode !== 'edit') return false;
      try {
        draw.updateFeatureGeometry(editingId, {
          type: 'LineString', coordinates: coordinates.map((coordinate) => [...coordinate]),
        });
        return true;
      } catch {
        return false;
      }
    },
    undo: () => draw.undo(),
  };
}
