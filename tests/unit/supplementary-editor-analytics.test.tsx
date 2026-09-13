import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { flushEditorAnalytics } from '../../src/analytics/editorAnalytics';
import { RouteMapMatchingControl } from '../../src/app/components/RouteMapMatchingControl';
import { usePoiSpreadsheet } from '../../src/app/hooks/usePoiSpreadsheet';
import type { MapMatchingProvider, MapMatchingResponse } from '../../src/services/mapbox/contracts';

const gtag = vi.fn();
const recorded = () => gtag.mock.calls.map((call) => call[2].action);
const coordinates = [[16.35, 48.2], [16.37, 48.21]] as const;
const response: MapMatchingResponse = {
  matches: [{ geometry: coordinates, confidence: 0.9 }],
  useBoundary: 'provider-response-use-requires-terms-review',
};

beforeEach(() => {
  gtag.mockReset();
  vi.stubGlobal('gtag', gtag);
});

afterEach(() => {
  cleanup();
  flushEditorAnalytics();
  vi.unstubAllGlobals();
});

it('records one map-matching success and never sends its trace or response', async () => {
  const user = userEvent.setup();
  const match = vi.fn<MapMatchingProvider['match']>().mockResolvedValue(response);
  render(<RouteMapMatchingControl coordinates={coordinates} disabled={false} documentEpoch={0}
    onApply={() => ({ ok: true, changed: true })} provider={{ match }} />);
  expect(gtag).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Snap route to roads' }));
  expect(await screen.findByRole('status', { name: 'Map matching status' })).toBeVisible();
  expect(recorded()).toEqual(['mapMatchingStarted', 'mapMatchingCompleted']);
  expect(gtag.mock.calls.map((call) => call[2])).toEqual([
    { action: 'mapMatchingStarted' }, { action: 'mapMatchingCompleted' },
  ]);
});

it.each(['provider', 'admission'])('records a %s rejection without sending the error', async (failure) => {
  const user = userEvent.setup();
  const match = vi.fn<MapMatchingProvider['match']>();
  if (failure === 'provider') match.mockRejectedValue(new Error('Private provider details'));
  else match.mockResolvedValue(response);
  render(<RouteMapMatchingControl coordinates={coordinates} disabled={false} documentEpoch={0}
    onApply={() => ({ ok: false, code: 'stale', error: 'Private mutation details' })} provider={{ match }} />);
  await user.click(screen.getByRole('button', { name: 'Snap route to roads' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(recorded()).toEqual(['mapMatchingStarted', 'mapMatchingFailed']);
  expect(JSON.stringify(gtag.mock.calls)).not.toContain('Private');
});

it('records cancellation once and ignores a late map-matching response', async () => {
  const user = userEvent.setup();
  let finish!: (value: MapMatchingResponse) => void;
  const match = vi.fn<MapMatchingProvider['match']>(() => new Promise((resolve) => { finish = resolve; }));
  const onApply = vi.fn(() => ({ ok: true as const, changed: true }));
  const view = render(<RouteMapMatchingControl coordinates={coordinates} disabled={false} documentEpoch={0}
    onApply={onApply} provider={{ match }} />);
  await user.click(screen.getByRole('button', { name: 'Snap route to roads' }));
  view.unmount();
  await act(async () => finish(response));
  expect(recorded()).toEqual(['mapMatchingStarted', 'mapMatchingCancelled']);
  expect(onApply).not.toHaveBeenCalled();
});

it('tracks spreadsheet editing and successful addition without pasted rows', () => {
  const onSubmit = vi.fn(() => ({ ok: true as const, changed: true }));
  const hook = renderHook(() => usePoiSpreadsheet({ documentEpoch: 0, onSubmit, onComplete: vi.fn() }));
  expect(gtag).not.toHaveBeenCalled();
  act(() => hook.result.current.changeText('Private place\t16.35\t48.2'));
  act(() => { expect(hook.result.current.commit()).toMatchObject({ ok: true }); });
  expect(recorded()).toEqual(['poiListEdited', 'poiListCommitStarted', 'poiListCommitCompleted']);
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(gtag.mock.calls)).not.toMatch(/Private|16\.35|48\.2/);
});

it('records rejected spreadsheet input and an explicit discard without counting success', () => {
  const onSubmit = vi.fn(() => ({ ok: true as const, changed: true }));
  const hook = renderHook(() => usePoiSpreadsheet({ documentEpoch: 0, onSubmit, onComplete: vi.fn() }));
  act(() => hook.result.current.changeText('Private invalid rows'));
  act(() => { expect(hook.result.current.commit()).toMatchObject({ ok: false }); });
  act(() => hook.result.current.discard());
  expect(recorded()).toEqual(['poiListEdited', 'poiListCommitStarted', 'poiListCommitFailed', 'poiListDiscarded']);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(JSON.stringify(gtag.mock.calls)).not.toContain('Private');
});
