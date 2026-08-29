import { renderHook } from '@testing-library/react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createInitialProjectDocument } from '../../src/domain/project';
import { useTerraDrawRoutes } from '../../src/map/useTerraDrawRoutes';

const metrics = vi.hoisted(() => ({
  createDraw: vi.fn(() => ({ marker: 'draw' })),
  createSession: vi.fn(() => ({ destroy: vi.fn(), undo: vi.fn(() => true) })),
}));

vi.mock('../../src/map/TerraDrawRouteFactory', () => ({ createTerraRouteDraw: metrics.createDraw }));
vi.mock('../../src/map/TerraDrawRouteEditing', () => ({ createTerraRouteSession: metrics.createSession }));

const map = {} as MapLibreMap;

describe('Terra Draw route hook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('edits the selected route with its canonical line shape and tears down on deselection', () => {
    const layers = createInitialProjectDocument().layers;
    const route = layers[0];
    if (route.appearance?.kind !== 'route') throw new Error('Route appearance unavailable');
    route.geometry = { type: 'Arc', anchors: [[16.3, 48.2], [16.5, 48.2]] };
    const onRouteGeometryChange = vi.fn();
    const { rerender } = renderHook(({ selectedId }) => useTerraDrawRoutes({
      layers,
      map,
      onRouteGeometryChange,
      onRoutePreview: vi.fn(),
      selectedId,
    }), { initialProps: { selectedId: route.id as string | null } });

    expect(metrics.createDraw).toHaveBeenCalledWith(map, 'arc', false);
    expect(metrics.createSession).toHaveBeenCalledWith(expect.objectContaining({
      initial: { id: route.id, coordinates: route.geometry.anchors },
      mode: 'edit',
    }));
    const session = metrics.createSession.mock.results[0].value;

    rerender({ selectedId: null });
    expect(session.destroy).toHaveBeenCalledOnce();
  });

  it('runs route authoring through Terra Draw and forwards undo requests', () => {
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
    const session = metrics.createSession.mock.results[0].value;

    expect(metrics.createDraw).toHaveBeenCalledWith(map, 'straight', true);
    expect(metrics.createSession).toHaveBeenCalledWith(expect.objectContaining({ mode: 'draw' }));
    rerender({ undoRequest: 1 });
    expect(session.undo).toHaveBeenCalledOnce();
  });
});
