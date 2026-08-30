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
  points?: readonly (readonly [number, number])[];
  revision?: number;
  undoRequest: number;
};

type TerraDrawRoutesOptions = {
  authoring?: RouteAuthoring;
  layers: ContentLayer[];
  loadRouteEditor?: () => Promise<typeof import('./TerraDrawRouteFactory')>;
  map: MapLibreMap | null;
  onEditorError?: (message: string | null) => void;
  onRouteGeometryChange: (id: string, coordinates: readonly (readonly [number, number])[]) => void;
  onRoutePreview: (id: string, coordinates: [number, number][] | null) => void;
  selectedId: string | null;
};

type RouteCallbacks = {
  authoringError?: RouteAuthoring['onError'];
  authoringFinish?: RouteAuthoring['onFinish'];
  authoringPreview?: RouteAuthoring['onPreview'];
  editorError?: TerraDrawRoutesOptions['onEditorError'];
  onRouteGeometryChange: TerraDrawRoutesOptions['onRouteGeometryChange'];
  onRoutePreview: TerraDrawRoutesOptions['onRoutePreview'];
};

type RouteSession = ReturnType<typeof createTerraRouteSession> & {
  resetAuthoring?: (points: readonly (readonly [number, number])[]) => void;
};
type EditableRoute = ContentLayer;

function editableRouteFor(options: TerraDrawRoutesOptions): EditableRoute | null {
  const layer = options.layers.find((candidate) => candidate.id === options.selectedId);
  if (layer?.type !== 'route' || !layer.visible || layer.locked) return null;
  if (layer.geometry?.type !== 'LineString') return null;
  if (layer.provenance?.service === 'directions-v5') return null;
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
    editorError: options.onEditorError,
    onRouteGeometryChange: options.onRouteGeometryChange,
    onRoutePreview: options.onRoutePreview,
  });
  useLayoutEffect(() => {
    callbacks.current = {
      authoringError: options.authoring?.onError,
      authoringFinish: options.authoring?.onFinish,
      authoringPreview: options.authoring?.onPreview,
      editorError: options.onEditorError,
      onRouteGeometryChange: options.onRouteGeometryChange,
      onRoutePreview: options.onRoutePreview,
    };
  });
  return callbacks;
}

function createAuthoringSession(
  draw: ReturnType<typeof createTerraRouteDraw>,
  callbacks: RefObject<RouteCallbacks>,
  initialPoints: readonly (readonly [number, number])[],
): RouteSession {
  let basePoints = initialPoints.map(([longitude, latitude]) => [longitude, latitude] as [number, number]);
  const withBasePoints = (coordinates: [number, number][]) => [
    ...basePoints.map(([longitude, latitude]) => [longitude, latitude] as [number, number]),
    ...coordinates,
  ];
  const session = createTerraRouteSession({
    draw,
    mode: 'draw',
    onFinish: (coordinates) => callbacks.current.authoringFinish?.(withBasePoints(coordinates)),
    onPreview: (coordinates) => callbacks.current.authoringPreview?.(withBasePoints(coordinates)),
  });
  return {
    ...session,
    resetAuthoring: (points) => {
      basePoints = points.map(([longitude, latitude]) => [longitude, latitude]);
      draw.clear();
      draw.setMode('linestring');
    },
  };
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

function sessionFor(options: {
  authoringPoints: readonly (readonly [number, number])[];
  callbacks: RefObject<RouteCallbacks>;
  draw: ReturnType<typeof createTerraRouteDraw>;
  editableRoute: EditableRoute | null;
  isAuthoring: boolean;
}) {
  const { authoringPoints, callbacks, draw, editableRoute, isAuthoring } = options;
  if (isAuthoring) return createAuthoringSession(draw, callbacks, authoringPoints);
  if (editableRoute) return createEditingSession(draw, editableRoute, callbacks);
  return null;
}

function reportRouteEditorLoadError(
  callbacks: RefObject<RouteCallbacks>,
  isAuthoring: boolean,
) {
  if (isAuthoring) {
    callbacks.current.authoringError?.('The route editor could not be loaded. Close the Route tool and try again.');
    return;
  }
  callbacks.current.editorError?.('The route editor could not be loaded. Select another layer, then select this route to try again.');
}

function useRouteSession(
  options: TerraDrawRoutesOptions,
  callbacks: RefObject<RouteCallbacks>,
  authoringPoints: RefObject<readonly (readonly [number, number])[] | undefined>,
) {
  const session = useRef<RouteSession | null>(null);
  const isAuthoring = options.authoring?.active === true;
  const editableRoute = editableRouteFor(options);
  const lineShape = isAuthoring ? options.authoring?.lineShape : routeLineShape(editableRoute);
  const { map } = options;

  useEffect(() => {
    if (!lineShape || !map) {
      if (!isAuthoring) callbacks.current.editorError?.(null);
      return;
    }
    const { onRoutePreview } = callbacks.current;
    let isCancelled = false;
    let owned: RouteSession | null = null;
    // terra-draw only matters once a route is being drawn or edited, so the
    // editor is fetched at that point rather than shipped with the first paint.
    void (async () => {
      try {
        const loaded = await (options.loadRouteEditor ?? loadTerraRouteDraw)();
        if (isCancelled) return;
        owned = sessionFor({
          authoringPoints: authoringPoints.current ?? [],
          callbacks,
          draw: loaded.createTerraRouteDraw(map, lineShape, isAuthoring),
          editableRoute,
          isAuthoring,
        });
        session.current = owned;
        if (isAuthoring) callbacks.current.authoringError?.(null);
        else callbacks.current.editorError?.(null);
      } catch {
        if (!isCancelled) reportRouteEditorLoadError(callbacks, isAuthoring);
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
  }, [authoringPoints, callbacks, editableRoute, isAuthoring, lineShape, map, options.loadRouteEditor]);

  return { isAuthoring, session };
}

export function useTerraDrawRoutes(options: TerraDrawRoutesOptions) {
  const callbacks = useLatestCallbacks(options);
  const authoringPoints = useRef(options.authoring?.points);
  useLayoutEffect(() => {
    authoringPoints.current = options.authoring?.points;
  }, [options.authoring?.points]);
  const { isAuthoring, session } = useRouteSession(options, callbacks, authoringPoints);
  const lastUndoRequest = useRef(options.authoring?.undoRequest ?? 0);

  useEffect(() => {
    const undoRequest = options.authoring?.undoRequest ?? 0;
    if (!isAuthoring || undoRequest === lastUndoRequest.current) return;
    lastUndoRequest.current = undoRequest;
    session.current?.undo();
  }, [isAuthoring, options.authoring?.undoRequest, session]);

  useEffect(() => {
    if (!isAuthoring || options.authoring?.revision === undefined) return;
    session.current?.resetAuthoring?.(authoringPoints.current ?? []);
  }, [
    isAuthoring,
    options.authoring?.revision,
    session,
  ]);

  const updateEditingGeometry = useCallback((coordinates: [number, number][]) => (
    session.current?.updateGeometry(coordinates) ?? false
  ), [session]);
  return { updateEditingGeometry };
}
