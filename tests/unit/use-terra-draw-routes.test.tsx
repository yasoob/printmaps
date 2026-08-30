import { renderHook, waitFor } from '@testing-library/react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createInitialProjectDocument } from '../../src/domain/project';
import { useTerraDrawRoutes } from '../../src/map/useTerraDrawRoutes';

const metrics = vi.hoisted(() => ({
  createDraw: vi.fn(() => ({ marker: 'draw' })),
  createSession: vi.fn(() => ({ destroy: vi.fn(), undo: vi.fn(() => true), updateGeometry: vi.fn(() => true) })),
}));

vi.mock('../../src/map/TerraDrawRouteFactory', () => ({ createTerraRouteDraw: metrics.createDraw }));
vi.mock('../../src/map/TerraDrawRouteEditing', () => ({ createTerraRouteSession: metrics.createSession }));

const map = {} as MapLibreMap;

describe('Terra Draw route hook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('leaves Arc editing to the accessible DOM marker editor', async () => {
    const layers = createInitialProjectDocument().layers;
    const route = layers[0];
    if (route.appearance?.kind !== 'route') throw new Error('Route appearance unavailable');
    route.geometry = { type: 'Arc', anchors: [[16.3, 48.2], [16.5, 48.2]], curvatures: [0.35] };
    const onRouteGeometryChange = vi.fn();
    renderHook(() => useTerraDrawRoutes({
      layers,
      map,
      onRouteGeometryChange,
      onRoutePreview: vi.fn(),
      selectedId: route.id,
    }));

    await Promise.resolve();
    expect(metrics.createDraw).not.toHaveBeenCalled();
    expect(metrics.createSession).not.toHaveBeenCalled();
  });

  it('runs route authoring through Terra Draw and forwards undo requests', async () => {
    const layers = createInitialProjectDocument().layers;
    const authoring = {
      active: true,
      lineShape: 'straight' as const,
      onFinish: vi.fn(),
      onPreview: vi.fn(),
      undoRequest: 0,
    };
    const { rerender } = renderHook(({ undoRequest }) => useTerraDrawRoutes({
      authoring: { ...authoring, undoRequest },
      layers,
      map,
      onRouteGeometryChange: vi.fn(),
      onRoutePreview: vi.fn(),
      selectedId: null,
    }), { initialProps: { undoRequest: 0 } });
    await waitFor(() => expect(metrics.createSession).toHaveBeenCalled());
    const session = metrics.createSession.mock.results[0].value;

    expect(metrics.createDraw).toHaveBeenCalledWith(map, 'straight', true);
    expect(metrics.createSession).toHaveBeenCalledWith(expect.objectContaining({ mode: 'draw' }));
    rerender({ undoRequest: 1 });
    expect(session.undo).toHaveBeenCalledOnce();
  });

  it('announces an activating route-editor load failure', async () => {
    const onError = vi.fn();
    renderHook(() => useTerraDrawRoutes({
      authoring: {
        active: true,
        lineShape: 'arc',
        onError,
        onFinish: vi.fn(),
        onPreview: vi.fn(),
        undoRequest: 0,
      },
      layers: createInitialProjectDocument().layers,
      loadRouteEditor: () => Promise.reject(new Error('offline')),
      map,
      onRouteGeometryChange: vi.fn(),
      onRoutePreview: vi.fn(),
      selectedId: null,
    }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(
      'The route editor could not be loaded. Close the Route tool and try again.',
    ));
  });

  it('keeps the newest session when the selection changes while the editor is still loading', async () => {
    const layers = createInitialProjectDocument().layers;
    const first = layers[0];
    if (first.appearance?.kind !== 'route') throw new Error('Route appearance unavailable');
    const second = { ...first, id: `${first.id}-second` };
    layers.push(second);

    const { rerender, result } = renderHook(({ selectedId }) => useTerraDrawRoutes({
      layers,
      map,
      onRouteGeometryChange: vi.fn(),
      onRoutePreview: vi.fn(),
      selectedId,
    }), { initialProps: { selectedId: first.id as string | null } });

    // No await here: both effects run while the terra-draw import is still pending,
    // so the abandoned run must not tear down the session the new run publishes.
    rerender({ selectedId: second.id });

    await waitFor(() => expect(metrics.createSession).toHaveBeenCalledOnce());
    const live = metrics.createSession.mock.results[0].value;
    expect(metrics.createSession).toHaveBeenCalledWith(expect.objectContaining({
      initial: { id: second.id, coordinates: first.geometry?.type === 'LineString' ? first.geometry.coordinates : [] },
    }));
    expect(live.destroy).not.toHaveBeenCalled();
    expect(result.current.updateEditingGeometry([[16.3, 48.2]])).toBe(true);
  });
});
