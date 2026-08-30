import { renderHook, waitFor } from '@testing-library/react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createInitialProjectDocument } from '../../src/domain/project';
import { useTerraDrawRoutes } from '../../src/map/useTerraDrawRoutes';

type MockSessionOptions = {
  onPreview: (coordinates: [number, number][]) => void;
};

const metrics = vi.hoisted(() => ({
  createDraw: vi.fn(() => ({ clear: vi.fn(), marker: 'draw', setMode: vi.fn() })),
  createSession: vi.fn((options: MockSessionOptions) => {
    void options;
    return {
      destroy: vi.fn(),
      undo: vi.fn(() => true),
      updateGeometry: vi.fn(() => true),
    };
  }),
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

  it('synchronizes external semantic draft edits into Terra Draw guidance', async () => {
    const layers = createInitialProjectDocument().layers;
    const onPreview = vi.fn();
    const { rerender } = renderHook(({ points, revision }) =>
      useTerraDrawRoutes({
        authoring: {
          active: true,
          lineShape: 'straight',
          onFinish: vi.fn(),
          onPreview,
          points,
          revision,
          undoRequest: 0,
        },
        layers,
        map,
        onRouteGeometryChange: vi.fn(),
        onRoutePreview: vi.fn(),
        selectedId: null,
      }), {
      initialProps: {
        points: [[0, 0], [1, 1]] as [number, number][],
        revision: 0,
      },
    });
    await waitFor(() => expect(metrics.createSession).toHaveBeenCalled());
    const draw = metrics.createDraw.mock.results[0].value;

    rerender({ points: [[0, 0], [2, 2]], revision: 1 });

    expect(draw.clear).toHaveBeenCalledOnce();
    expect(draw.setMode).toHaveBeenLastCalledWith('linestring');
    metrics.createSession.mock.calls[0][0].onPreview([[3, 3]]);
    expect(onPreview).toHaveBeenLastCalledWith([[0, 0], [2, 2], [3, 3]]);
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

  it('announces a completed-route editor load failure', async () => {
    const onEditorError = vi.fn();
    const layers = createInitialProjectDocument().layers;
    renderHook(() => useTerraDrawRoutes({
      layers,
      loadRouteEditor: () => Promise.reject(new Error('offline')),
      map,
      onEditorError,
      onRouteGeometryChange: vi.fn(),
      onRoutePreview: vi.fn(),
      selectedId: layers[0].id,
    }));

    await waitFor(() => expect(onEditorError).toHaveBeenCalledWith(
      'The route editor could not be loaded. Select another layer, then select this route to try again.',
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
