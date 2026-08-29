import { bringTerraRouteHandlesToFront } from '../../src/map/TerraDrawRouteFactory';
import { scheduleTerraRouteHandleOrder } from '../../src/map/useMapCanvasController';

describe('Terra Draw route handle order', () => {
  it('reports moved after raising both Terra handle layers', () => {
    const map = {
      getLayer: vi.fn((id: string) => ({ id })),
      moveLayer: vi.fn(),
    };

    expect(bringTerraRouteHandlesToFront(map as never)).toBe('moved');
    expect(map.moveLayer.mock.calls).toEqual([
      ['studio-route-editor-point'],
      ['studio-route-editor-point-marker'],
    ]);
  });

  it('moves the point and marker layers above route content without failing when optional layers are absent', () => {
    const map = {
      getLayer: vi.fn((id: string) => id.endsWith('-point') ? { id } : undefined),
      moveLayer: vi.fn(),
    };

    expect(bringTerraRouteHandlesToFront(map as never)).toBe('moved');
    expect(map.moveLayer).toHaveBeenCalledOnce();
    expect(map.moveLayer).toHaveBeenCalledWith('studio-route-editor-point');

    map.getLayer.mockReturnValue(undefined);
    expect(bringTerraRouteHandlesToFront(map as never)).toBe('absent');
  });

  it('reports a partial move failure when only one handle layer reaches the front', () => {
    const map = {
      getLayer: vi.fn((id: string) => ({ id })),
      moveLayer: vi.fn((id: string) => {
        if (id.endsWith('-point-marker')) throw new Error('style changed');
      }),
    };

    expect(bringTerraRouteHandlesToFront(map as never)).toBe('failed');
    expect(map.moveLayer).toHaveBeenCalledTimes(2);
  });

  it('schedules one next-render retry when Terra handle layers are not installed yet', () => {
    let areLayersReady = false;
    let retry: (() => void) | undefined;
    const map = {
      getLayer: vi.fn((id: string) => areLayersReady ? { id } : undefined),
      isStyleLoaded: vi.fn(() => true),
      moveLayer: vi.fn(),
      once: vi.fn((_event: string, callback: () => void) => { retry = callback; }),
    };

    expect(scheduleTerraRouteHandleOrder(map as never)).toBe('absent');
    expect(map.once).toHaveBeenCalledWith('render', expect.any(Function));
    areLayersReady = true;
    retry?.();

    expect(map.moveLayer.mock.calls).toEqual([
      ['studio-route-editor-point'],
      ['studio-route-editor-point-marker'],
    ]);
    expect(map.once).toHaveBeenCalledOnce();
  });

  it('waits for style readiness before retrying a failed handle move once', () => {
    let isStyleReady = false;
    let retry: (() => void) | undefined;
    const map = {
      getLayer: vi.fn((id: string) => ({ id })),
      isStyleLoaded: vi.fn(() => isStyleReady),
      moveLayer: vi.fn(() => {
        if (!isStyleReady) throw new Error('style loading');
      }),
      once: vi.fn((_event: string, callback: () => void) => { retry = callback; }),
    };

    expect(scheduleTerraRouteHandleOrder(map as never)).toBe('failed');
    expect(map.once).toHaveBeenCalledWith('style.load', expect.any(Function));
    isStyleReady = true;
    retry?.();

    expect(map.moveLayer).toHaveBeenCalledTimes(4);
    expect(map.once).toHaveBeenCalledOnce();
  });

  it('returns the ordering result when a lightweight map lacks retry events', () => {
    const map = {
      getLayer: vi.fn(),
      moveLayer: vi.fn(),
    };

    expect(() => scheduleTerraRouteHandleOrder(map as never)).not.toThrow();
    expect(scheduleTerraRouteHandleOrder(map as never)).toBe('absent');
  });

  it('fails closed when a style transition rejects a layer move', () => {
    const map = {
      getLayer: vi.fn(() => ({ id: 'studio-route-editor-point' })),
      moveLayer: vi.fn(() => { throw new Error('Style is reloading'); }),
    };

    expect(() => bringTerraRouteHandlesToFront(map as never)).not.toThrow();
    expect(bringTerraRouteHandlesToFront(map as never)).toBe('failed');
  });
});
