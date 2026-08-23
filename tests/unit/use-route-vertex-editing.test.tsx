import { createRef } from 'react';
import { renderHook } from '@testing-library/react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createInitialProjectDocument, type ContentLayer } from '../../src/domain/project';
import { useRouteVertexEditing } from '../../src/map/useRouteVertexEditing';

const sessions = vi.hoisted(() => [] as Array<ReturnType<typeof createSession>>);

function createSession() {
  const cleanup = vi.fn() as ReturnType<typeof vi.fn> & { focusVertex: ReturnType<typeof vi.fn> };
  cleanup.focusVertex = vi.fn();
  return cleanup;
}

vi.mock('../../src/map/RouteVertexEditing', () => ({
  installRouteVertexEditing: vi.fn(() => {
    const session = createSession();
    sessions.push(session);
    return session;
  }),
}));

const routeLayers = () => createInitialProjectDocument().layers;

function focusedRouteHandle(vertexIndex: number) {
  const button = document.createElement('button');
  button.dataset.routeVertexIndex = String(vertexIndex);
  document.body.append(button);
  button.focus();
  return button;
}

type HookProps = {
  layers: ContentLayer[];
  selectedId: string | null;
};

const map = createRef<MapLibreMap>();
map.current = {} as MapLibreMap;
const onRouteVertexChange = vi.fn();

describe('route vertex editing focus lifecycle', () => {
  beforeEach(() => {
    sessions.length = 0;
    document.body.replaceChildren();
  });

  it('restores a focused handle across a geometry rerender of the same route', () => {
    const { rerender } = renderHook(({ layers, selectedId }: HookProps) => useRouteVertexEditing({
      layers,
      map,
      onRouteVertexChange,
      selectedId,
      stylePreset: 'liberty',
    }), { initialProps: { layers: routeLayers(), selectedId: 'route-01' } as HookProps });
    focusedRouteHandle(1);

    rerender({ layers: routeLayers(), selectedId: 'route-01' });

    expect(sessions[1].focusVertex).toHaveBeenCalledWith(1);
  });

  it('does not restore stale handle focus after selection leaves the route', () => {
    const { rerender } = renderHook(({ layers, selectedId }: HookProps) => useRouteVertexEditing({
      layers,
      map,
      onRouteVertexChange,
      selectedId,
      stylePreset: 'liberty',
    }), { initialProps: { layers: routeLayers(), selectedId: 'route-01' } as HookProps });
    focusedRouteHandle(2);

    rerender({ layers: routeLayers(), selectedId: null });
    const layerButton = document.createElement('button');
    document.body.append(layerButton);
    layerButton.focus();
    rerender({ layers: routeLayers(), selectedId: 'route-01' });

    expect(sessions[1].focusVertex).not.toHaveBeenCalled();
  });
});
