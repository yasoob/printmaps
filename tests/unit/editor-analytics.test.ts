import { CORE_ACTIONS, flushEditorAnalytics, trackEditorAction } from '../../src/analytics/editorAnalytics';
import { PROJECT_ACTIONS } from '../../src/analytics/projectActions';
import { UI_ACTIONS } from '../../src/analytics/uiActions';
import { WORKFLOW_ACTIONS } from '../../src/analytics/workflowActions';

const gtag = vi.fn();

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

it('uses the existing GA queue with an editor event and bounded metadata', () => {
  trackEditorAction('setMapStyle', { map_style: 'graphite' });
  expect(gtag).toHaveBeenCalledExactlyOnceWith('event', 'editor_action', {
    action: 'setMapStyle', map_style: 'graphite',
  });
});

it('does not load analytics or retain interactions when GA is unavailable', () => {
  vi.stubGlobal('gtag', undefined);
  trackEditorAction('setLayerOpacity', { layer_type: 'shape' }, { debounce: true });
  vi.stubGlobal('gtag', gtag);
  vi.runAllTimers();
  flushEditorAnalytics();
  expect(gtag).not.toHaveBeenCalled();
});

it('is safe during server-side evaluation', () => {
  vi.stubGlobal('window', undefined);
  expect(() => trackEditorAction('editorOpened')).not.toThrow();
  expect(gtag).not.toHaveBeenCalled();
});

it('does not leak arbitrary properties, invalid enum values or an overridden action', () => {
  const parameters = {
    layer_type: 'poi' as const,
    enabled: false,
    title: 'Private project',
    coordinates: [-71.1, 42.3],
    filename: 'private.gpx',
    action: 'private name',
  };
  trackEditorAction('selectLayer', parameters);
  Reflect.apply(trackEditorAction, undefined, ['setMapStyle', {
    map_style: 'private label', source: 'private URL', enabled: 'private content',
  }]);
  expect(gtag.mock.calls).toEqual([
    ['event', 'editor_action', { action: 'selectLayer', layer_type: 'poi', enabled: false }],
    ['event', 'editor_action', { action: 'setMapStyle' }],
  ]);
});

it('rejects an unregistered action without logging its potentially private value', () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  Reflect.apply(trackEditorAction, undefined, ['private file name']);
  expect(gtag).not.toHaveBeenCalled();
  expect(warning).toHaveBeenCalledExactlyOnceWith('Editor analytics rejected an unknown action.');
  warning.mockRestore();
});

it('isolates a broken analytics script without exposing its raw exception', () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  gtag.mockImplementationOnce(() => { throw new Error('private error details'); });
  expect(() => trackEditorAction('undo')).not.toThrow();
  expect(warning).toHaveBeenCalledExactlyOnceWith('Editor analytics could not queue an event.');
  warning.mockRestore();
});

it('coalesces rapid changes into one event after 500ms of inactivity', () => {
  trackEditorAction('setLayerOpacity', { layer_type: 'shape' }, { debounce: true });
  vi.advanceTimersByTime(400);
  trackEditorAction('setLayerOpacity', { layer_type: 'shape' }, { debounce: true });
  vi.advanceTimersByTime(499);
  expect(gtag).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(gtag).toHaveBeenCalledExactlyOnceWith('event', 'editor_action', {
    action: 'setLayerOpacity', layer_type: 'shape',
  });
});

it('flushes pending edits before a discrete action without dropping repeated clicks', () => {
  trackEditorAction('setProjectTitle', {}, { debounce: true });
  trackEditorAction('undo');
  trackEditorAction('undo');
  vi.runAllTimers();
  expect(gtag.mock.calls.map((call) => call[2].action)).toEqual([
    'setProjectTitle', 'undo', 'undo',
  ]);
});

it('does not merge edits of different appearance settings into the same event', () => {
  trackEditorAction('setLayerAppearance', { layer_type: 'poi', setting: 'label' }, { debounce: true });
  trackEditorAction('setLayerAppearance', { layer_type: 'poi', setting: 'color' }, { debounce: true });
  vi.runAllTimers();
  expect(gtag.mock.calls.map((call) => call[2].setting)).toEqual(['label', 'color']);
});

it.each(['pagehide', 'visibilitychange'])('flushes a pending edit on %s exactly once', (event) => {
  trackEditorAction('setProjectTitle', {}, { debounce: true });
  if (event === 'visibilitychange') {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event(event));
    visibility.mockRestore();
  } else {
    window.dispatchEvent(new Event(event));
  }
  vi.runAllTimers();
  expect(gtag).toHaveBeenCalledExactlyOnceWith('event', 'editor_action', { action: 'setProjectTitle' });
});

it('registers every catalog action once using GA-safe bounded names', () => {
  const actions = [...CORE_ACTIONS, ...PROJECT_ACTIONS, ...WORKFLOW_ACTIONS, ...UI_ACTIONS];
  expect(new Set(actions).size).toBe(actions.length);
  for (const action of actions) {
    expect(action).toMatch(/^[a-zA-Z][a-zA-Z0-9_]{0,99}$/);
    trackEditorAction(action);
  }
  expect(gtag).toHaveBeenCalledTimes(actions.length);
});
