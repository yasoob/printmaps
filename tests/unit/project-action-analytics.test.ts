import { flushEditorAnalytics } from '../../src/analytics/editorAnalytics';
import { PROJECT_ACTIONS } from '../../src/analytics/projectActions';
import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';

const gtag = vi.fn();
const createStore = () => createProjectStore(createInitialProjectDocument());
const actions = () => gtag.mock.calls.map((call) => call[2].action);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('gtag', gtag);
  gtag.mockReset();
});

afterEach(() => {
  flushEditorAnalytics();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('covers every public project action except document restoration and internal drawing status', () => {
  const store = createStore();
  const names = Object.entries(store.getState())
    .filter(([, value]) => typeof value === 'function')
    .map(([name]) => name)
    .filter((name) => name !== 'openDocument' && name !== 'setHasUnfinishedDrawing');
  expect(names).toHaveLength(PROJECT_ACTIONS.length);
  expect(new Set(names)).toEqual(new Set(PROJECT_ACTIONS));
});

it('does not track initial state, rehydration, internal flags or no-op changes', () => {
  const store = createStore();
  store.getState().openDocument(createInitialProjectDocument());
  const state = store.getState();
  state.setHasUnfinishedDrawing(state.documentEpoch, true);
  state.selectLayer(null);
  state.selectLayer('nonexistent');
  state.setPageBoundaryVisible(true);
  state.setMapStyle('paper');
  state.setProjectTitle(state.document.title);
  state.undo();
  state.redo();
  state.deleteLayer('basemap');
  vi.runAllTimers();
  expect(gtag).not.toHaveBeenCalled();
});

it('tracks successful actions once while preserving return values and stable identities', () => {
  const store = createStore();
  const initialActions = store.getState();
  expect(initialActions.setPagePreset('A3')).toEqual({ ok: true, changed: true });
  expect(initialActions.setPagePreset('A3')).toEqual({ ok: true, changed: false });
  initialActions.selectLayer('poi-cafe');
  initialActions.selectLayer('poi-cafe');
  initialActions.toggleLayerVisibility('poi-cafe');
  initialActions.undo();
  initialActions.redo();
  expect(actions()).toEqual(['setPagePreset', 'selectLayer', 'toggleLayerVisibility', 'undo', 'redo']);
  expect(gtag.mock.calls[0][2]).toEqual({ action: 'setPagePreset', page_preset: 'A3' });
  expect(gtag.mock.calls[1][2]).toEqual({ action: 'selectLayer', layer_type: 'poi' });
  for (const name of PROJECT_ACTIONS) {
    expect(store.getState()[name]).toBe(initialActions[name]);
  }
});

it('does not count rejected, stale or locked edits as successes', () => {
  const store = createStore();
  const state = store.getState();
  expect(state.createShape([[0, 0], [1, 1]])).toMatchObject({ ok: false });
  expect(state.importLayers([], -1, state.document)).toMatchObject({ ok: false });
  state.setCameraBearing(NaN);
  state.setPageDimension('widthMm', -10);
  state.toggleLayerLock('poi-cafe');
  gtag.mockClear();
  state.deleteLayer('poi-cafe');
  state.moveLayer('unknown', 0);
  vi.runAllTimers();
  expect(gtag).not.toHaveBeenCalled();
});

it('ignores automatic viewport amendments but records committed map navigation', () => {
  const store = createStore();
  store.getState().setCameraViewport([1, 2], 4, 'amend');
  expect(gtag).not.toHaveBeenCalled();
  store.getState().setCameraViewport([3, 4], 5, 'history');
  expect(gtag).toHaveBeenCalledExactlyOnceWith('event', 'editor_action', { action: 'setCameraViewport' });
});

it('coalesces setting changes and sends neither text nor geographic data', () => {
  const store = createStore();
  const state = store.getState();
  state.setProjectTitle('Private map title');
  state.setProjectTitle('Another private title');
  state.renameLayer('poi-cafe', 'Private home address');
  state.setPoiCoordinates('poi-cafe', [-71.1, 42.3]);
  state.setLayerOpacity('poi-cafe', 70);
  state.setLayerOpacity('poi-cafe', 60);
  vi.runAllTimers();
  expect(actions()).toEqual(['setProjectTitle', 'renameLayer', 'setPoiCoordinates', 'setLayerOpacity']);
  expect(gtag.mock.calls.map((call) => call[2])).toEqual([
    { action: 'setProjectTitle' },
    { action: 'renameLayer', layer_type: 'poi' },
    { action: 'setPoiCoordinates', layer_type: 'poi' },
    { action: 'setLayerOpacity', layer_type: 'poi' },
  ]);
});

it('identifies appearance settings without transmitting labels or custom colors', () => {
  const store = createStore();
  const poi = store.getState().document.layers.find((layer) => layer.id === 'poi-cafe');
  if (poi?.appearance?.kind !== 'poi') throw new Error('Expected fixture place appearance.');
  store.getState().setLayerAppearance(poi.id, { ...poi.appearance, label: 'Private label' });
  vi.runAllTimers();
  expect(gtag).toHaveBeenCalledExactlyOnceWith('event', 'editor_action', {
    action: 'setLayerAppearance', layer_type: 'poi', setting: 'label',
  });
});

it('does not turn a successful mutation into a failure if analytics fails', () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  gtag.mockImplementation(() => { throw new Error('analytics unavailable'); });
  const store = createStore();
  expect(store.getState().setPagePreset('A3')).toEqual({ ok: true, changed: true });
  expect(store.getState().document.page.preset).toBe('A3');
  expect(warning).toHaveBeenCalledWith('Editor analytics could not queue an event.');
  warning.mockRestore();
});
