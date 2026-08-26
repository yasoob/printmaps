import { describe, expect, it, vi } from 'vitest';
import { createTerraRouteSession, type TerraRouteDrawLike } from '../../src/map/TerraDrawRouteEditing';

function drawHarness() {
  const listeners = new Map<string, (...arguments_: never[]) => void>();
  let feature = {
    id: 'route-01',
    type: 'Feature' as const,
    properties: { mode: 'linestring' },
    geometry: { type: 'LineString' as const, coordinates: [[0, 0], [1, 1]] },
  };
  const draw: TerraRouteDrawLike = {
    addFeatures: vi.fn(() => [{ id: 'route-01', valid: true }]),
    clear: vi.fn(),
    getSnapshot: vi.fn(() => [feature]),
    on: vi.fn((event, callback) => listeners.set(event, callback as never)),
    selectFeature: vi.fn(),
    setMode: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    undo: vi.fn(() => true),
  };
  return {
    draw,
    emit: (event: string, ...arguments_: unknown[]) => listeners.get(event)?.(...arguments_ as never[]),
    setCoordinates: (coordinates: number[][]) => { feature = { ...feature, geometry: { ...feature.geometry, coordinates } }; },
  };
}

describe('Terra Draw route session', () => {
  it('publishes edit previews but commits only on a completed Terra Draw edit', () => {
    const harness = drawHarness();
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    const session = createTerraRouteSession({
      draw: harness.draw,
      initial: { id: 'route-01', coordinates: [[0, 0], [1, 1]] },
      mode: 'edit',
      onCommit,
      onPreview,
    });
    expect(harness.draw.addFeatures).toHaveBeenCalledWith([
      expect.not.objectContaining({ id: expect.anything() }),
    ]);
    expect(harness.draw.selectFeature).toHaveBeenCalledWith('route-01');
    harness.setCoordinates([[0, 0], [2, 2]]);

    harness.emit('change', ['route-01'], 'update', { target: 'geometry' });
    expect(onPreview).toHaveBeenLastCalledWith([[0, 0], [2, 2]]);
    expect(onCommit).not.toHaveBeenCalled();

    harness.emit('finish', 'route-01', { action: 'dragCoordinate', mode: 'select' });
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith([[0, 0], [2, 2]]);

    session.destroy();
    expect(harness.draw.stop).toHaveBeenCalledOnce();
  });

  it('excludes Terra Draw’s trailing live coordinate from the canonical authoring preview', () => {
    const harness = drawHarness();
    const onPreview = vi.fn();
    createTerraRouteSession({
      draw: harness.draw,
      mode: 'draw',
      onFinish: vi.fn(),
      onPreview,
    });
    harness.setCoordinates([[0, 0], [0.5, 0.5]]);

    harness.emit('change', ['route-01'], 'update', { target: 'geometry' });

    expect(onPreview).toHaveBeenLastCalledWith([[0, 0]]);
  });

  it('finishes a drawn route and exposes library undo without creating project history itself', () => {
    const harness = drawHarness();
    const onFinish = vi.fn();
    const session = createTerraRouteSession({
      draw: harness.draw,
      mode: 'draw',
      onFinish,
      onPreview: vi.fn(),
    });

    harness.emit('finish', 'route-01', { action: 'draw', mode: 'linestring' });
    expect(onFinish).toHaveBeenCalledWith([[0, 0], [1, 1]]);
    expect(session.undo()).toBe(true);
    expect(harness.draw.undo).toHaveBeenCalledOnce();
  });
});
