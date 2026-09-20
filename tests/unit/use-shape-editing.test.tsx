import { createRef } from 'react';
import { renderHook } from '@testing-library/react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createInitialProjectDocument, type ContentLayer } from '../../src/domain/project';
import { useShapeTransformEditing } from '../../src/map/useShapeTransformEditing';
import { useShapeVertexEditing } from '../../src/map/useShapeVertexEditing';

const pointSessions = vi.hoisted(() => [] as Array<ReturnType<typeof createPointSession>>);
const transformSessions = vi.hoisted(() => [] as Array<ReturnType<typeof createTransformSession>>);

function createPointSession() {
  return Object.assign(vi.fn(), {
    focusPoint: vi.fn(),
    synchronizeLayer: vi.fn<(layer: ContentLayer) => boolean>(() => true),
  });
}

function createTransformSession() {
  return Object.assign(vi.fn(), {
    focusHandle: vi.fn(),
    synchronizeLayer: vi.fn<(layer: ContentLayer) => boolean>(() => true),
  });
}

vi.mock(import('../../src/map/ShapeVertexEditing'), async (importOriginal) => ({
  ...await importOriginal(),
  installShapeVertexEditing: vi.fn(() => {
    const session = createPointSession();
    pointSessions.push(session);
    return session;
  }),
}));

vi.mock(import('../../src/map/ShapeTransformEditing'), async (importOriginal) => ({
  ...await importOriginal(),
  installShapeTransformEditing: vi.fn(() => {
    const session = createTransformSession();
    transformSessions.push(session);
    return session;
  }),
}));

const shapeLayers = () => createInitialProjectDocument().layers;
function movedShapeLayers(): ContentLayer[] {
  return shapeLayers().map((layer) => layer.geometry?.type === 'Polygon' ? {
    ...layer,
    geometry: {
      ...layer.geometry,
      coordinates: layer.geometry.coordinates.map((ring) => ring.map(([longitude, latitude]): [number, number] => [longitude + 0.01, latitude])),
    },
  } : layer);
}
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
  return button;
}

function focusedTransformHandle(role: string) {
  const button = document.createElement('button');
  button.dataset.shapeTransformHandle = role;
  document.body.append(button);
  button.focus();
  return button;
}

describe('shape editing focus lifecycle', () => {
  beforeEach(() => {
    pointSessions.length = 0;
    transformSessions.length = 0;
    document.body.replaceChildren();
  });

  it('retains the point session and focus during geometry synchronization', () => {
    const { rerender } = renderHook(({ layers, selectedId }: HookProps) => useShapeVertexEditing({
      active: true, layers, map, onShapeGeometryChange, selectedId, stylePreset: 'paper',
    }), { initialProps: { layers: shapeLayers(), selectedId: 'area-center' } as HookProps });
    const handle = focusedPoint(0, 2);
    const next = movedShapeLayers();

    rerender({ layers: next, selectedId: 'area-center' });

    expect(pointSessions).toHaveLength(1);
    expect(pointSessions[0]).not.toHaveBeenCalled();
    expect(pointSessions[0].synchronizeLayer).toHaveBeenLastCalledWith(next.find(({ id }) => id === 'area-center'));
    expect(document.activeElement).toBe(handle);
  });

  it('restores point focus when a topology change requires a new session', () => {
    const { rerender } = renderHook(({ layers, selectedId }: HookProps) => useShapeVertexEditing({
      active: true, layers, map, onShapeGeometryChange, selectedId, stylePreset: 'paper',
    }), { initialProps: { layers: shapeLayers(), selectedId: 'area-center' } as HookProps });
    focusedPoint(0, 2);
    const next = shapeLayers();
    const geometry = next.find(({ id }) => id === 'area-center')?.geometry;
    if (geometry?.type !== 'Polygon') throw new Error('Expected the polygon fixture.');
    const ring = geometry.coordinates[0];
    geometry.coordinates[0] = [...ring.slice(0, -1), [16.354, 48.209], ring[0]];
    rerender({ layers: next, selectedId: 'area-center' });
    expect(pointSessions).toHaveLength(2);
    expect(pointSessions[0]).toHaveBeenCalledOnce();
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

  it('retains the transform session and focus during geometry synchronization', () => {
    const { rerender } = renderHook(({ layers, selectedId }: HookProps) => useShapeTransformEditing({
      active: true, layers, map, onShapeGeometryChange, selectedId, stylePreset: 'paper',
    }), { initialProps: { layers: shapeLayers(), selectedId: 'area-center' } as HookProps });
    const handle = focusedTransformHandle('move');
    const next = movedShapeLayers();

    rerender({ layers: next, selectedId: 'area-center' });

    expect(transformSessions).toHaveLength(1);
    expect(transformSessions[0]).not.toHaveBeenCalled();
    expect(transformSessions[0].synchronizeLayer).toHaveBeenLastCalledWith(next.find(({ id }) => id === 'area-center'));
    expect(document.activeElement).toBe(handle);
  });
});
