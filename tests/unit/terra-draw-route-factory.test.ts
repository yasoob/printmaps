import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTerraRouteDraw } from '../../src/map/TerraDrawRouteFactory';

const metrics = vi.hoisted(() => ({
  terraDrawOptions: [] as unknown[],
  undoConstructed: vi.fn(),
}));

vi.mock('terra-draw', () => ({
  TerraDraw: vi.fn(function TerraDraw(options: unknown) {
    metrics.terraDrawOptions.push(options);
    return { marker: 'draw' };
  }),
  TerraDrawLineStringMode: vi.fn(function TerraDrawLineStringMode() { return { mode: 'linestring' }; }),
  TerraDrawModeUndoRedo: vi.fn(function TerraDrawModeUndoRedo() {
    metrics.undoConstructed();
    return { marker: 'undo' };
  }),
  TerraDrawSelectMode: vi.fn(function TerraDrawSelectMode() { return { mode: 'select' }; }),
}));
vi.mock('terra-draw-maplibre-gl-adapter', () => ({
  TerraDrawMapLibreGLAdapter: vi.fn(function TerraDrawMapLibreGLAdapter() { return { marker: 'adapter' }; }),
}));

describe('Terra Draw route factory', () => {
  beforeEach(() => {
    metrics.terraDrawOptions.length = 0;
    metrics.undoConstructed.mockClear();
  });

  it('omits Terra undo coordination from edit-only preview synchronization', () => {
    createTerraRouteDraw({} as never, 'straight', false);

    expect(metrics.terraDrawOptions[0]).not.toHaveProperty('undoRedo');
    expect(metrics.undoConstructed).not.toHaveBeenCalled();
  });

  it('keeps mode-level undo enabled for route authoring', () => {
    createTerraRouteDraw({} as never, 'straight', true);

    expect(metrics.terraDrawOptions[0]).toHaveProperty('undoRedo.modeLevel', { marker: 'undo' });
    expect(metrics.undoConstructed).toHaveBeenCalledOnce();
  });
});
