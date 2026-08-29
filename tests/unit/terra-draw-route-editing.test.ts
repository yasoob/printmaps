import { describe, expect, it, vi } from 'vitest';
import { createTerraRouteSession, type TerraRouteDrawLike } from '../../src/map/TerraDrawRouteEditing';

function drawHarness(generatedId: string | number = 'route-01') {
  const listeners = new Map<string, (...arguments_: never[]) => void>();
  let feature = {
    id: generatedId,
    type: 'Feature' as const,
    properties: { mode: 'linestring' },
    geometry: { type: 'LineString' as const, coordinates: [[0, 0], [1, 1]] },
  };
  const updateFeatureGeometry = vi.fn((_id: string | number, geometry: { type: string; coordinates: number[][] }) => {
    feature = { ...feature, geometry: { type: 'LineString', coordinates: geometry.coordinates } };
  });
  const draw = {
    addFeatures: vi.fn(() => [{ id: generatedId, valid: true }]),
    clear: vi.fn(),
    getSnapshot: vi.fn(() => [feature]),
    on: vi.fn((event, callback) => listeners.set(event, callback as never)),
    selectFeature: vi.fn(),
    setMode: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    undo: vi.fn(() => true),
    updateFeatureGeometry,
  } as unknown as TerraRouteDrawLike;
  return {
    draw,
    emit: (event: string, ...arguments_: unknown[]) => listeners.get(event)?.(...arguments_ as never[]),
    setCoordinates: (coordinates: number[][]) => { feature = { ...feature, geometry: { ...feature.geometry, coordinates } }; },
    updateFeatureGeometry,
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

  it('updates the generated Terra feature id rather than the project route id', () => {
    const harness = drawHarness('terra-generated-id');
    const session = createTerraRouteSession({
      draw: harness.draw,
      initial: { id: 'project-route-id', coordinates: [[0, 0], [1, 1]] },
      mode: 'edit',
      onCommit: vi.fn(),
      onPreview: vi.fn(),
    });

    expect(session.updateGeometry([[0, 0], [2, 2]])).toBe(true);
    expect(harness.draw.selectFeature).toHaveBeenCalledWith('terra-generated-id');
    expect(harness.updateFeatureGeometry).toHaveBeenCalledWith('terra-generated-id', expect.any(Object));
  });

  it('does not echo API-originated geometry synchronization into route previews', () => {
    const harness = drawHarness();
    const onPreview = vi.fn();
    const session = createTerraRouteSession({
      draw: harness.draw,
      initial: { id: 'project-route-id', coordinates: [[0, 0], [1, 1]] },
      mode: 'edit',
      onCommit: vi.fn(),
      onPreview,
    });

    session.updateGeometry([[0, 0], [2, 2]]);
    harness.emit('change', ['route-01'], 'update', { origin: 'api', target: 'geometry' });

    expect(onPreview).not.toHaveBeenCalled();
  });

  it('updates selected coordinate and midpoint guidance for an external live preview', () => {
    const harness = drawHarness();
    const onPreview = vi.fn();
    const session = createTerraRouteSession({
      draw: harness.draw,
      initial: { id: 'route-01', coordinates: [[0, 0], [1, 1], [2, 0]] },
      mode: 'edit',
      onCommit: vi.fn(),
      onPreview,
    });

    expect(session.updateGeometry([[0, 0], [1, 2], [2, 0]])).toBe(true);
    expect(harness.updateFeatureGeometry).toHaveBeenCalledWith('route-01', {
      type: 'LineString', coordinates: [[0, 0], [1, 2], [2, 0]],
    });
    expect(onPreview).not.toHaveBeenCalled();
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
