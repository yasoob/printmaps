import { act, renderHook } from '@testing-library/react';
import { createInitialProjectDocument } from '../../src/domain/project';
import type { ProjectMutationResult } from '../../src/domain/projectMutation';
import { useRouteExtensionActivation, type RouteStateSetters } from '../../src/app/hooks/canvasRouteAuthoringSupport';

it('retains one deferred extension command across unrelated renders and equivalent request objects', () => {
  const document = createInitialProjectDocument();
  const request = { request: 1, layer: document.layers[0], endpoint: 'end' as const, trigger: window.document.createElement('button') };
  let approve!: () => ProjectMutationResult;
  const parameters = {
    documentEpoch: 0, layers: document.layers, routeExtensionRequest: request,
    requestExtensionActivation: vi.fn((onApproved: () => ProjectMutationResult) => { approve = onApproved; return false; }),
    onExtensionActivated: vi.fn(), setActiveTool: vi.fn(), setToolDocumentEpoch: vi.fn(),
    onLayerSelect: vi.fn(), onAuthoringChange: vi.fn(),
  };
  const setters: RouteStateSetters = {
    setAnnouncement: vi.fn(), setError: vi.fn(), setExtension: vi.fn(), setLineShape: vi.fn(),
    setPoints: vi.fn(), setRoadTravelMode: vi.fn(), setTravelMarker: vi.fn(),
  };
  const hook = renderHook((props) => useRouteExtensionActivation(props, setters), { initialProps: parameters });
  hook.rerender({ ...parameters, routeExtensionRequest: { ...request } });
  expect(parameters.requestExtensionActivation).toHaveBeenCalledOnce();
  expect(parameters.setActiveTool).not.toHaveBeenCalled();
  act(() => expect(approve()).toEqual({ ok: true }));
  expect(setters.setExtension).toHaveBeenCalledExactlyOnceWith(request);
  expect(parameters.setActiveTool).toHaveBeenCalledExactlyOnceWith('route');
  expect(parameters.onExtensionActivated).toHaveBeenCalledOnce();
  hook.rerender({ ...parameters, routeExtensionRequest: { ...request } });
  expect(parameters.setActiveTool).toHaveBeenCalledOnce();
});
