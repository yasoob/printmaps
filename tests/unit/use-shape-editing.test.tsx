import { createRef } from 'react';
import { renderHook } from '@testing-library/react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createInitialProjectDocument, type ContentLayer } from '../../src/domain/project';
import { useShapeTransformEditing } from '../../src/map/useShapeTransformEditing';
import { useShapeVertexEditing } from '../../src/map/useShapeVertexEditing';

const pointSessions = vi.hoisted(() => [] as Array<ReturnType<typeof createPointSession>>);
const transformSessions = vi.hoisted(() => [] as Array<ReturnType<typeof createTransformSession>>);

function createPointSession() {
  const cleanup = vi.fn() as ReturnType<typeof vi.fn> & { focusPoint: ReturnType<typeof vi.fn> };
  cleanup.focusPoint = vi.fn();
  return cleanup;
}

function createTransformSession() {
  const cleanup = vi.fn() as ReturnType<typeof vi.fn> & { focusHandle: ReturnType<typeof vi.fn> };
  cleanup.focusHandle = vi.fn();
  return cleanup;
}

vi.mock('../../src/map/ShapeVertexEditing', () => ({
  installShapeVertexEditing: vi.fn(() => {
    const session = createPointSession();
    pointSessions.push(session);
    return session;
  }),
}));

vi.mock('../../src/map/ShapeTransformEditing', () => ({
  installShapeTransformEditing: vi.fn(() => {
    const session = createTransformSession();
    transformSessions.push(session);
    return session;
  }),
}));

const shapeLayers = () => createInitialProjectDocument().layers;
const map = createRef<MapLibreMap>();
map.current = {} as MapLibreMap;
const onShapeGeometryChange = vi.fn();
type HookProps = { layers: ContentLayer[]; selectedId: string | null };

function focusedPoint(ringIndex: number, vertexIndex: number) {
  const button = document.createElement('button');
  button.dataset.shapeRingIndex = String(ringIndex);
  button.dataset.shapeVertexIndex = String(vertexIndex);
  document.body.append(button);
  button.focus();
}

function focusedTransformHandle(role: string) {
  const button = document.createElement('button');
  button.dataset.shapeTransformHandle = role;
  document.body.append(button);
  button.focus();
}

describe('shape editing focus lifecycle', () => {
  beforeEach(() => {
    pointSessions.length = 0;
    transformSessions.length = 0;
    document.body.replaceChildren();
  });

  it('restores the same point handle across a geometry rerender', () => {
    const { rerender } = renderHook(({ layers, selectedId }: HookProps) => useShapeVertexEditing({
      active: true, layers, map, onShapeGeometryChange, selectedId, stylePreset: 'paper',
    }), { initialProps: { layers: shapeLayers(), selectedId: 'area-center' } as HookProps });
    focusedPoint(0, 2);

    rerender({ layers: shapeLayers(), selectedId: 'area-center' });

    expect(pointSessions[1].focusPoint).toHaveBeenCalledWith(0, 2);
  });

  it('does not restore stale point focus after selection leaves the area', () => {
    const { rerender } = renderHook(({ layers, selectedId }: HookProps) => useShapeVertexEditing({
      active: true, layers, map, onShapeGeometryChange, selectedId, stylePreset: 'paper',
    }), { initialProps: { layers: shapeLayers(), selectedId: 'area-center' } as HookProps });
    focusedPoint(0, 1);

    rerender({ layers: shapeLayers(), selectedId: null });
    rerender({ layers: shapeLayers(), selectedId: 'area-center' });

    expect(pointSessions[1].focusPoint).not.toHaveBeenCalled();
  });

  it('restores the same transform handle across a geometry rerender', () => {
    const { rerender } = renderHook(({ layers, selectedId }: HookProps) => useShapeTransformEditing({
      active: true, layers, map, onShapeGeometryChange, selectedId, stylePreset: 'paper',
    }), { initialProps: { layers: shapeLayers(), selectedId: 'area-center' } as HookProps });
    focusedTransformHandle('move');

    rerender({ layers: shapeLayers(), selectedId: 'area-center' });

    expect(transformSessions[1].focusHandle).toHaveBeenCalledWith('move');
  });
});
