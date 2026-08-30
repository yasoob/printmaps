import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';
import type { RouteLineShape } from '../domain/routeProfiles';
import type { createTerraRouteDraw } from './TerraDrawRouteFactory';
import { createTerraRouteSession } from './TerraDrawRouteEditing';

// Concurrent editor sessions share one in-flight import instead of racing
// separate requests for the same chunk. A failed fetch is never cached, so the
// next activation retries.
const terraRouteDraw: { module: Promise<typeof import('./TerraDrawRouteFactory')> | null } = { module: null };

async function importRouteEditor() {
  try {
    return await import('./TerraDrawRouteFactory');
  } catch (error) {
    terraRouteDraw.module = null;
    throw error;
  }
}

const loadTerraRouteDraw = () => (terraRouteDraw.module ??= importRouteEditor());

/**
 * Warms the route editor chunk before the tool is activated. Route clicks are
 * handled by terra-draw alone, so a click landing before the chunk arrives is
 * dropped; fetching on hover/focus closes that window.
 */
export function preloadRouteEditor() {
  void (async () => {
    try {
      await loadTerraRouteDraw();
    } catch {
      // Warm-up is best effort; the activating effect reports the real attempt.
    }
  })();
}

export type RouteAuthoring = {
  active: boolean;
  lineShape: RouteLineShape;
  onError?: (message: string | null) => void;
  onFinish: (coordinates: [number, number][]) => void;
  onPreview: (coordinates: [number, number][]) => void;
  undoRequest: number;
};

type TerraDrawRoutesOptions = {
  authoring?: RouteAuthoring;
  layers: ContentLayer[];
  loadRouteEditor?: () => Promise<typeof import('./TerraDrawRouteFactory')>;
  map: MapLibreMap | null;
  onRouteGeometryChange: (id: string, coordinates: readonly (readonly [number, number])[]) => void;
  onRoutePreview: (id: string, coordinates: [number, number][] | null) => void;
  selectedId: string | null;
};

type RouteCallbacks = {
  authoringError?: RouteAuthoring['onError'];
  authoringFinish?: RouteAuthoring['onFinish'];
  authoringPreview?: RouteAuthoring['onPreview'];
  onRouteGeometryChange: TerraDrawRoutesOptions['onRouteGeometryChange'];
  onRoutePreview: TerraDrawRoutesOptions['onRoutePreview'];
};

type RouteSession = ReturnType<typeof createTerraRouteSession>;
type EditableRoute = ContentLayer;

function editableRouteFor(options: TerraDrawRoutesOptions): EditableRoute | null {
  const layer = options.layers.find((candidate) => candidate.id === options.selectedId);
  if (layer?.type !== 'route' || !layer.visible || layer.locked) return null;
  if (layer.geometry?.type !== 'LineString') return null;
  return layer;
}

function routeLineShape(layer: EditableRoute | null): RouteLineShape | undefined {
  if (layer?.geometry?.type === 'LineString') return 'straight';
}

function routeCoordinates(layer: EditableRoute | null) {
  if (layer?.geometry?.type === 'LineString') return layer.geometry.coordinates;
}

function useLatestCallbacks(options: TerraDrawRoutesOptions) {
  const callbacks = useRef<RouteCallbacks>({
    authoringError: options.authoring?.onError,
    authoringFinish: options.authoring?.onFinish,
    authoringPreview: options.authoring?.onPreview,
    onRouteGeometryChange: options.onRouteGeometryChange,
    onRoutePreview: options.onRoutePreview,
  });
  useLayoutEffect(() => {
    callbacks.current = {
      authoringError: options.authoring?.onError,
      authoringFinish: options.authoring?.onFinish,
      authoringPreview: options.authoring?.onPreview,
      onRouteGeometryChange: options.onRouteGeometryChange,
      onRoutePreview: options.onRoutePreview,
    };
  });
  return callbacks;
}

function createAuthoringSession(
  draw: ReturnType<typeof createTerraRouteDraw>,
  callbacks: RefObject<RouteCallbacks>,
): RouteSession {
  return createTerraRouteSession({
    draw,
    mode: 'draw',
    onFinish: (coordinates) => callbacks.current.authoringFinish?.(coordinates),
    onPreview: (coordinates) => callbacks.current.authoringPreview?.(coordinates),
  });
}

function createEditingSession(
  draw: ReturnType<typeof createTerraRouteDraw>,
  route: EditableRoute,
  callbacks: RefObject<RouteCallbacks>,
): RouteSession | null {
  const coordinates = routeCoordinates(route);
  if (!coordinates) return null;
  return createTerraRouteSession({
    draw,
    initial: { id: route.id, coordinates },
    mode: 'edit',
    onCommit: (nextCoordinates) => {
      callbacks.current.onRoutePreview(route.id, null);
      callbacks.current.onRouteGeometryChange(route.id, nextCoordinates);
    },
    onPreview: (nextCoordinates) => callbacks.current.onRoutePreview(route.id, nextCoordinates),
  });
}

function sessionFor(
  draw: ReturnType<typeof createTerraRouteDraw>,
  isAuthoring: boolean,
  editableRoute: EditableRoute | null,
  callbacks: RefObject<RouteCallbacks>,
) {
  if (isAuthoring) return createAuthoringSession(draw, callbacks);
  if (editableRoute) return createEditingSession(draw, editableRoute, callbacks);
  return null;
}

function useRouteSession(options: TerraDrawRoutesOptions, callbacks: RefObject<RouteCallbacks>) {
  const session = useRef<RouteSession | null>(null);
  const isAuthoring = options.authoring?.active === true;
  const editableRoute = editableRouteFor(options);
  const lineShape = isAuthoring ? options.authoring?.lineShape : routeLineShape(editableRoute);
  const { map } = options;

  useEffect(() => {
    if (!lineShape || !map) return;
    const { onRoutePreview } = callbacks.current;
    let isCancelled = false;
    let owned: RouteSession | null = null;
    // terra-draw only matters once a route is being drawn or edited, so the
    // editor is fetched at that point rather than shipped with the first paint.
    void (async () => {
      try {
        const loaded = await (options.loadRouteEditor ?? loadTerraRouteDraw)();
        if (isCancelled) return;
        owned = sessionFor(loaded.createTerraRouteDraw(map, lineShape, isAuthoring), isAuthoring, editableRoute, callbacks);
        session.current = owned;
        if (isAuthoring) callbacks.current.authoringError?.(null);
      } catch {
        if (!isCancelled && isAuthoring) {
          callbacks.current.authoringError?.('The route editor could not be loaded. Close the Route tool and try again.');
        }
      }
    })();
    return () => {
      // Only this run's session is torn down: a later run may already have
      // published its own session to the ref while this one was still loading.
      isCancelled = true;
      owned?.destroy();
      if (session.current === owned) session.current = null;
      if (editableRoute) onRoutePreview(editableRoute.id, null);
    };
  }, [callbacks, editableRoute, isAuthoring, lineShape, map, options.loadRouteEditor]);

  return { isAuthoring, session };
}

export function useTerraDrawRoutes(options: TerraDrawRoutesOptions) {
  const callbacks = useLatestCallbacks(options);
  const { isAuthoring, session } = useRouteSession(options, callbacks);
  const lastUndoRequest = useRef(options.authoring?.undoRequest ?? 0);

  useEffect(() => {
    const undoRequest = options.authoring?.undoRequest ?? 0;
    if (!isAuthoring || undoRequest === lastUndoRequest.current) return;
    lastUndoRequest.current = undoRequest;
    session.current?.undo();
  }, [isAuthoring, options.authoring?.undoRequest, session]);

  const updateEditingGeometry = useCallback((coordinates: [number, number][]) => (
    session.current?.updateGeometry(coordinates) ?? false
  ), [session]);
  return { updateEditingGeometry };
}
