import { createRef } from 'react';
import { renderHook } from '@testing-library/react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createInitialProjectDocument, type ContentLayer, type MapStylePreset } from '../../src/domain/project';
import { useRouteVertexEditing } from '../../src/map/useRouteVertexEditing';

function createSession() {
  const cleanup = vi.fn() as ReturnType<typeof vi.fn> & { focusVertex: ReturnType<typeof vi.fn> };
  cleanup.focusVertex = vi.fn();
  return cleanup;
}

const metrics = vi.hoisted(() => ({
  commits: [] as Array<(vertexIndex: number, coordinate: readonly [number, number]) => void>,
  sessions: [] as Array<ReturnType<typeof createSession>>,
}));

vi.mock('../../src/map/RouteVertexEditing', () => ({
  installRouteVertexEditing: vi.fn((
    _map: MapLibreMap,
    _layer: ContentLayer,
    onCommit: (vertexIndex: number, coordinate: readonly [number, number]) => void,
  ) => {
    const session = createSession();
    metrics.commits.push(onCommit);
    metrics.sessions.push(session);
    return session;
  }),
}));

type HookProps = {
  layers: ContentLayer[];
  onChange: (id: string, vertexIndex: number, coordinate: readonly [number, number]) => void;
  selectedId: string | null;
  stylePreset: MapStylePreset;
};

const map = createRef<MapLibreMap>();
map.current = {} as MapLibreMap;

function focusedRouteHandle(vertexIndex: number) {
  const button = document.createElement('button');
  button.dataset.routeVertexIndex = String(vertexIndex);
  document.body.append(button);
  button.focus();
}

function renderRouteHook(initialProps: HookProps) {
  return renderHook((props: HookProps) => useRouteVertexEditing({
    layers: props.layers,
    map,
    onRouteVertexChange: props.onChange,
    selectedId: props.selectedId,
    stylePreset: props.stylePreset,
  }), { initialProps });
}

describe('route vertex editing lifecycle', () => {
  beforeEach(() => {
    metrics.commits.length = 0;
    metrics.sessions.length = 0;
    document.body.replaceChildren();
  });

  it('keeps the marker session stable when the commit callback identity changes', () => {
    const layers = createInitialProjectDocument().layers;
    const firstChange = vi.fn();
    const secondChange = vi.fn();
    const { rerender } = renderRouteHook({
      layers, onChange: firstChange, selectedId: 'route-01', stylePreset: 'paper',
    });

    rerender({ layers, onChange: secondChange, selectedId: 'route-01', stylePreset: 'paper' });

    expect(metrics.sessions).toHaveLength(1);
    expect(metrics.sessions[0]).not.toHaveBeenCalled();
    metrics.commits[0](1, [16.4, 48.25]);
    expect(firstChange).not.toHaveBeenCalled();
    expect(secondChange).toHaveBeenCalledWith('route-01', 1, [16.4, 48.25]);
  });

  it('restores a focused handle across a geometry rerender of the same route', () => {
    const onChange = vi.fn();
    const { rerender } = renderRouteHook({
      layers: createInitialProjectDocument().layers,
      onChange,
      selectedId: 'route-01',
      stylePreset: 'paper',
    });
    focusedRouteHandle(1);

    rerender({
      layers: createInitialProjectDocument().layers,
      onChange,
      selectedId: 'route-01',
      stylePreset: 'paper',
    });

    expect(metrics.sessions[1].focusVertex).toHaveBeenCalledWith(1);
  });

  it('does not restore stale handle focus after selection leaves the route', () => {
    const layers = createInitialProjectDocument().layers;
    const onChange = vi.fn();
    const { rerender } = renderRouteHook({ layers, onChange, selectedId: 'route-01', stylePreset: 'paper' });
    focusedRouteHandle(2);

    rerender({ layers, onChange, selectedId: null, stylePreset: 'paper' });
    const layerButton = document.createElement('button');
    document.body.append(layerButton);
    layerButton.focus();
    rerender({ layers, onChange, selectedId: 'route-01', stylePreset: 'paper' });

    expect(metrics.sessions[1].focusVertex).not.toHaveBeenCalled();
  });
});
