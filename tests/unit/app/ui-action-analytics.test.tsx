import { StrictMode, type ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { InspectorAccordion } from '../../../src/app/components/PropertyControls';
import { useAuthoringPanelDisclosure } from '../../../src/app/hooks/useAuthoringPanelDisclosure';
import { useMobilePanels } from '../../../src/app/hooks/useMobilePanels';
import { flushEditorAnalytics, type EditorAction } from '../../../src/analytics/editorAnalytics';
import type { RouteAuthoring } from '../../../src/map/useTerraDrawRoutes';

const mapInputs = vi.hoisted(() => ({ routeAuthoring: undefined as RouteAuthoring | undefined }));
vi.mock('../../../src/map/MapCanvas', async () => {
  const { MapCanvas: MockMapCanvas } = await import('./MapCanvasMock');
  return {
    MapCanvas: (props: ComponentProps<typeof MockMapCanvas>) => {
      mapInputs.routeAuthoring = props.routeAuthoring;
      return <MockMapCanvas {...props} />;
    },
  };
});

const gtag = vi.fn<NonNullable<Window['gtag']>>();
const actions = () => gtag.mock.calls.map((call) => call[2].action);
const events = (action: EditorAction) => gtag.mock.calls.filter((call) => call[2].action === action);

beforeEach(() => {
  gtag.mockClear();
  vi.stubGlobal('gtag', gtag);
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  flushEditorAnalytics();
  vi.unstubAllGlobals();
});

it('records accepted tool changes and shared cancel handlers, not mount, repeated selection, or blocked activation', async () => {
  const user = userEvent.setup();
  render(<StrictMode><App autosaveRepository={null} /></StrictMode>);
  expect(gtag).not.toHaveBeenCalled();

  fireEvent.keyDown(document, { key: 'r' });
  fireEvent.keyDown(document, { key: 'r' });
  expect(events('routeToolActivated')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Cancel route' }));
  expect(events('routeCancelRequested')).toHaveLength(1);
  expect(events('selectToolActivated')).toHaveLength(0);

  await user.click(screen.getByRole('button', { name: 'Route (R)' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
  await user.click(screen.getByRole('button', { name: 'Select (V)' }));
  expect(events('routeToolActivated')).toHaveLength(2);
  expect(events('selectToolActivated')).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  fireEvent.keyDown(screen.getByTestId('map-canvas'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Discard changes' }));

  expect(events('routeCancelRequested')).toHaveLength(3);
  expect(events('routeDraftKept')).toHaveLength(1);
  expect(events('routeDraftDiscarded')).toHaveLength(1);
});

it('deduplicates Terra preview/finish callbacks and never records coordinate streams', async () => {
  const user = userEvent.setup();
  render(<StrictMode><App autosaveRepository={null} /></StrictMode>);
  await user.click(screen.getByRole('button', { name: 'Route (R)' }));
  const points: [number, number][] = [[16.123456, 48.234567]];
  act(() => {
    mapInputs.routeAuthoring?.onPreview(points);
    mapInputs.routeAuthoring?.onFinish(points);
  });
  act(() => mapInputs.routeAuthoring?.onPreview(points));
  expect(events('routeDraftPointAdded')).toHaveLength(1);
  expect(events('routeDraftPointAdded')[0][2]).toEqual({
    action: 'routeDraftPointAdded', source: 'map',
  });
  expect(events('drawingSettingsClosed')).toHaveLength(0);
  expect(JSON.stringify(gtag.mock.calls)).not.toMatch(/16\.123456|48\.234567/);
});

it('records draft list edits and keyboard undo/finish separately from the committed route', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Route (R)' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 3' }));
  await user.click(screen.getByText('Draft points (3)'));
  await user.click(screen.getByRole('button', { name: 'Move draft point 3 up' }));
  await user.click(screen.getByRole('button', { name: 'Remove draft point 2' }));
  fireEvent.keyDown(screen.getByTestId('map-canvas'), { key: 'Backspace' });
  fireEvent.keyDown(screen.getByTestId('map-canvas'), { key: 'Enter' });

  expect(events('routeDraftPointAdded')).toHaveLength(3);
  expect(events('routeDraftPointReordered')).toHaveLength(1);
  expect(events('routeDraftPointRemoved')).toHaveLength(1);
  expect(events('routeDraftUndo')).toHaveLength(1);
  expect(events('routeFinishRequested')).toHaveLength(1);
  expect(events('createRoute')).toHaveLength(1);
  expect(events('undo')).toHaveLength(0);
  expect(events('routeCancelRequested')).toHaveLength(0);
});

it('records deliberate route option changes and preview requests, not unchanged selections', async () => {
  const user = userEvent.setup();
  const directions = vi.fn().mockResolvedValue({
    routes: [{ geometry: [[16.31, 48.19], [16.4, 48.24]], distanceMeters: 1000, durationSeconds: 120 }],
    useBoundary: 'provider-response-use-requires-terms-review',
  });
  render(<App autosaveRepository={null} directionsProvider={{ directions }} />);
  await user.click(screen.getByRole('button', { name: 'Route (R)' }));
  const arc = screen.getByRole('radio', { name: 'Arc' });
  await user.click(arc);
  await user.click(arc);
  await user.keyboard('{Home}');
  await user.click(screen.getByRole('radio', { name: 'Road' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Road travel mode' }), 'bike');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Travel marker' }), 'air');
  await user.click(screen.getByText('Add by coordinates or existing place'));
  await user.click(screen.getByRole('checkbox', { name: 'Snap map clicks to nearby places and route anchors' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
  await user.click(screen.getByRole('button', { name: 'Road Preview' }));
  await screen.findByText('Road preview updated.');
  expect(events('routeArcModeSelected')).toHaveLength(1);
  expect(events('routeStraightModeSelected')).toHaveLength(1);
  expect(events('routeRoadModeSelected')).toHaveLength(1);
  expect(events('routeDraftTravelModeChanged')).toHaveLength(1);
  expect(events('routeDraftTravelMarkerChanged')).toHaveLength(1);
  expect(events('routeDraftSnappingChanged')[0][2]).toEqual({
    action: 'routeDraftSnappingChanged', enabled: true,
  });
  expect(events('routePreviewRequested')).toHaveLength(1);
  expect(events('routeFinishRequested')).toHaveLength(0);
});

it('records shape mode and draft requests without double-counting cancel as close', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  fireEvent.keyDown(document, { key: 's' });
  await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
  await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
  fireEvent.keyDown(screen.getByTestId('map-canvas'), { key: 'Backspace' });
  await user.click(screen.getByRole('button', { name: 'Cancel area' }));
  expect(events('shapeToolActivated')).toHaveLength(1);
  expect(events('shapeDrawModeSelected')).toHaveLength(1);
  expect(events('shapeDraftPointAddRequested')).toHaveLength(1);
  expect(events('shapeDraftUndo')).toHaveLength(1);
  expect(events('shapeCancelRequested')).toHaveLength(1);
  expect(events('shapeAuthoringClosed')).toHaveLength(0);

  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  fireEvent.keyDown(screen.getByTestId('map-canvas'), { key: 'Escape' });
  expect(events('shapeAuthoringClosed')).toHaveLength(1);
});

it('records shape finish once through the keyboard and leaves successful creation to the store', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
  await user.click(screen.getByRole('button', { name: 'Map shape point 3' }));
  fireEvent.keyDown(screen.getByTestId('map-canvas'), { key: 'Enter' });
  expect(events('shapeFinishRequested')).toHaveLength(1);
  expect(events('createShape')).toHaveLength(1);
  expect(events('shapeAuthoringClosed')).toHaveLength(0);
});

it('shares fit-page intent across map controls and keyboard without counting blocked shortcuts or rerenders', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Fit page' }));
  fireEvent.keyDown(document, { key: '!', code: 'Digit1', shiftKey: true });
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search places and addresses' }), {
    key: '!', code: 'Digit1', shiftKey: true,
  });
  expect(events('fitPageRequested')).toHaveLength(2);
  await user.click(screen.getByRole('button', { name: 'Camera & location' }));
  await user.click(screen.getByRole('switch', { name: 'Lock map area' }));
  fireEvent.keyDown(document, { key: '!', code: 'Digit1', shiftKey: true });
  rerender(<App autosaveRepository={null} />);
  expect(events('fitPageRequested')).toHaveLength(2);
});

it('keeps disclosure handlers stable and automatic drawing collapse silent', () => {
  const { result, rerender } = renderHook(
    ({ count, compact }) => useAuthoringPanelDisclosure(count, compact),
    { initialProps: { count: 0, compact: true }, wrapper: StrictMode },
  );
  const open = result.current.openSettings;
  const close = result.current.closeSettings;
  expect(gtag).not.toHaveBeenCalled();
  act(open);
  act(open);
  expect(events('drawingSettingsOpened')).toHaveLength(1);
  rerender({ count: 1, compact: true });
  expect(result.current.settingsOpen).toBe(false);
  expect(events('drawingSettingsClosed')).toHaveLength(0);
  expect(result.current.openSettings).toBe(open);
  expect(result.current.closeSettings).toBe(close);
  act(open);
  act(close);
  expect(events('drawingSettingsClosed')).toHaveLength(1);
});

it('records mobile panel transitions but not responsive layout changes', () => {
  let resize: ((event: MediaQueryListEvent) => void) | undefined;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    addEventListener: (_type: string, listener: typeof resize) => {
      if (query === '(max-width: 899px)') resize = listener;
    },
    removeEventListener: vi.fn(),
  }));
  const { result } = renderHook(useMobilePanels, { wrapper: StrictMode });
  const open = result.current.openPanel;
  const close = result.current.closePanel;
  expect(gtag).not.toHaveBeenCalled();
  act(() => open('layers'));
  act(() => open('properties'));
  act(() => close());
  act(() => close());
  expect(actions()).toEqual([
    'layersPanelOpened', 'layersPanelClosed', 'propertiesPanelOpened', 'propertiesPanelClosed',
  ]);
  act(() => open('layers'));
  gtag.mockClear();
  act(() => resize?.({ matches: false } as MediaQueryListEvent));
  act(() => open('properties'));
  expect(gtag).not.toHaveBeenCalled();
  expect(result.current.openPanel).toBe(open);
  expect(result.current.closePanel).toBe(close);
});

it('records explicit inspector disclosures without reading titles, summaries, or storage keys', async () => {
  const user = userEvent.setup();
  render(
    <StrictMode>
      <InspectorAccordion isDefaultExpanded={false} storageKey="private-key" summary="Private address" title="Secret title">
        Private content
      </InspectorAccordion>
    </StrictMode>,
  );
  expect(gtag).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Secret title' }));
  await user.keyboard('{Enter}');
  expect(events('inspectorSectionToggled').map((call) => call[2])).toEqual([
    { action: 'inspectorSectionToggled', enabled: true },
    { action: 'inspectorSectionToggled', enabled: false },
  ]);
  expect(JSON.stringify(gtag.mock.calls)).not.toMatch(/private|Private|Secret/);
});

it('records customizer navigation from the common back handler for keyboard and pointer', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Map style' }));
  await user.click(screen.getByRole('button', { name: 'Customize colors' }));
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Customize colors' }));
  await user.click(screen.getByRole('button', { name: 'Back to project properties' }));
  expect(events('mapStyleCustomizerOpened')).toHaveLength(2);
  expect(events('mapStyleCustomizerClosed')).toHaveLength(2);
});

it('records eligible layer previews and filter controls without collecting layer names or queries', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.hover(screen.getByRole('button', { name: 'Select Route 01' }));
  await user.hover(screen.getByRole('button', { name: 'Select Paper basemap' }));
  expect(events('layerPreviewed')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Search layers' }));
  await user.type(screen.getByRole('searchbox', { name: 'Filter layers by name' }), 'private destination');
  await user.click(screen.getByRole('button', { name: 'Clear layer filter' }));
  await user.keyboard('{Escape}');
  expect(events('layerFilterOpened')).toHaveLength(1);
  expect(events('layerFilterCleared')).toHaveLength(1);
  expect(events('layerFilterClosed')).toHaveLength(1);
  expect(JSON.stringify(gtag.mock.calls)).not.toMatch(/Route 01|Paper basemap|private destination/);
});
