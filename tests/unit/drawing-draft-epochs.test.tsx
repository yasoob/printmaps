import { createRef } from 'react';
import { act, renderHook } from '@testing-library/react';
import { createProjectStore } from '../../src/app/store';
import { useRouteCoreState } from '../../src/app/hooks/useRouteCoreState';
import { useRoutePointInput } from '../../src/app/hooks/useRoutePointInput';
import { useShapeDrawingDraft } from '../../src/app/hooks/useShapeDrawingDraft';
import type { RouteAuthoringParameters } from '../../src/app/hooks/canvasRouteAuthoringSupport';

function routeParameters(documentEpoch: number): RouteAuthoringParameters {
  const store = createProjectStore().getState();
  return {
    documentEpoch, toolDocumentEpoch: documentEpoch,
    activeTool: 'route', isModalOpen: false, isMobileViewport: false,
    camera: store.document.camera, layers: store.document.layers,
    routeExtensionRequest: null,
    selectToolRef: createRef<HTMLButtonElement>(),
    setActiveTool: vi.fn(), setToolDocumentEpoch: vi.fn(),
    onAuthoringChange: vi.fn(), onLayerSelect: vi.fn(),
    onCreateRoute: store.createRoute,
    onCreateDirectionsRoute: store.createDirectionsRoute,
    onReplaceDirectionsRoute: store.replaceDirectionsRoute,
    onReplaceRouteDraft: store.replaceRouteDraft,
    onReplaceAuthoredRoute: store.replaceAuthoredRoute,
  };
}

it('rejects late route geometry callbacks from the previous document epoch', () => {
  const { result, rerender } = renderHook(
    ({ epoch }) => useRouteCoreState(routeParameters(epoch)),
    { initialProps: { epoch: 0 } },
  );
  act(() => result.current.editPoints([[16, 48], [17, 49]]));
  const old = result.current;
  rerender({ epoch: 1 });
  expect(result.current.points).toEqual([]);
  expect(result.current.hasUnfinishedWork).toBe(false);
  act(() => result.current.editPoints([[20, 50]]));
  act(() => old.editPoints([[30, 60], [31, 61]]));
  expect(result.current.points).toEqual([[20, 50]]);
  act(() => old.resetPoints([]));
  expect(result.current.points).toEqual([[20, 50]]);
});

it('resets route entry by document epoch and ignores late old-epoch input or resets', () => {
  const { result, rerender } = renderHook(
    ({ epoch }) => useRoutePointInput(epoch, [16, 48]),
    { initialProps: { epoch: 0 } },
  );
  act(() => result.current.onChange(0, '181'));
  const old = result.current;
  rerender({ epoch: 1 });
  expect(result.current.coordinates).toEqual(['16', '48']);
  expect(result.current.hasUnfinishedInput).toBe(false);
  act(() => result.current.onChange(0, '20'));
  act(() => { old.onChange(0, '30'); old.reset(); });
  expect(result.current.coordinates).toEqual(['20', '48']);
  expect(result.current.hasUnfinishedInput).toBe(true);
});

it('ignores old area edits and clears without replacing the new document drawing', () => {
  const { result, rerender } = renderHook(
    ({ epoch }) => useShapeDrawingDraft(epoch, [16, 48]),
    { initialProps: { epoch: 0 } },
  );
  act(() => result.current.addPoint([17, 49]));
  const old = result.current;
  rerender({ epoch: 1 });
  expect(result.current.hasUnfinishedWork).toBe(false);
  act(() => result.current.addPoint([20, 50]));
  act(() => { old.addPoint([30, 60]); old.clear(); old.pointInput.onChange(0, '181'); });
  expect(result.current.points).toEqual([[20, 50]]);
  expect(result.current.pointInput.coordinates).toEqual(['16', '48']);
});
