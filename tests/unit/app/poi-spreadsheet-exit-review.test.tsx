import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import * as storeModule from '../../../src/app/store';
import { createInitialProjectDocument } from '../../../src/domain/project';
import type { SearchProvider, SearchResponse } from '../../../src/services/mapbox/contracts';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

const response: SearchResponse = {
  results: [{ label: 'Matched Vienna, Austria', providerFeatureId: 'address.vienna', center: [16.3, 48.2] }],
  useBoundary: 'provider-response-use-requires-terms-review',
};

async function prepareLists(search = vi.fn<SearchProvider['search']>().mockResolvedValue(response)) {
  const store = storeModule.createProjectStore(createInitialProjectDocument());
  const factory = vi.spyOn(storeModule, 'createProjectStore').mockReturnValueOnce(store);
  render(<App autosaveRepository={null} searchProvider={{ search }} />);
  factory.mockRestore();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Place (P)' }));
  await user.click(screen.getByRole('button', { name: 'Paste POI list' }));
  const input = screen.getByRole('textbox', { name: 'POI spreadsheet rows' });
  fireEvent.change(input, { target: { value: 'Coordinate list\t16.4\t48.2' } });
  await user.click(screen.getByRole('radio', { name: 'Addresses' }));
  fireEvent.change(input, { target: { value: 'Address list\tVienna' } });
  await user.click(screen.getByRole('button', { name: 'Look up addresses' }));
  return { user, store, search };
}

it.each(['start', 'end'] as const)('keeps both lists on canceled Extend %s, then resumes the exact extension after explicit discard', async (endpoint) => {
  const { user, store, search } = await prepareLists();
  await screen.findByText('Matched location: Matched Vienna, Austria');
  await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
  const before = store.getState();
  await user.click(screen.getByRole('button', { name: `Extend ${endpoint}` }));
  const dialog = await screen.findByRole('dialog', { name: 'Discard unadded POI lists?' });
  await user.click(within(dialog).getByRole('button', { name: 'Keep editing lists' }));
  expect(screen.getByText('Matched location: Matched Vienna, Austria')).toBeInTheDocument();
  await user.click(screen.getByRole('radio', { name: 'Coordinates' }));
  expect(screen.getByRole('textbox', { name: 'POI spreadsheet rows' })).toHaveValue('Coordinate list\t16.4\t48.2');
  await user.click(screen.getByRole('radio', { name: 'Addresses' }));
  await user.click(screen.getByRole('button', { name: 'Back to pasted rows' }));
  expect(screen.getByRole('textbox', { name: 'POI spreadsheet rows' })).toHaveValue('Address list\tVienna');
  await user.click(screen.getByRole('button', { name: 'Return to review' }));
  expect(search).toHaveBeenCalledOnce();
  expect(store.getState().document).toBe(before.document);
  expect(store.getState().past).toBe(before.past);
  expect(store.getState().hasUnfinishedDrawing).toBe(true);
  await user.click(screen.getByRole('button', { name: `Extend ${endpoint}` }));
  await user.click(await screen.findByRole('button', { name: 'Discard lists' }));
  await screen.findByText(`Extending Route 01 from its ${endpoint}.`);
  expect(screen.getByRole('button', { name: 'Route (R)' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('form', { name: 'Place multiple points' })).toBeNull();
  expect(store.getState().document).toBe(before.document);
  expect(store.getState().past).toBe(before.past);
});

it('does not discard lists when the pending extension target changes before approval', async () => {
  const { user, store } = await prepareLists();
  await screen.findByText('Matched location: Matched Vienna, Austria');
  await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
  await user.click(screen.getByRole('button', { name: 'Extend end' }));
  const dialog = await screen.findByRole('dialog', { name: 'Discard unadded POI lists?' });
  act(() => store.getState().toggleLayerLock('route-01'));
  await user.click(within(dialog).getByRole('button', { name: 'Discard lists' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent('route changed before extension could start');
  await user.click(within(dialog).getByRole('button', { name: 'Keep editing lists' }));
  expect(screen.getByText('Matched location: Matched Vienna, Austria')).toBeInTheDocument();
  await user.click(screen.getByRole('radio', { name: 'Coordinates' }));
  expect(screen.getByRole('textbox', { name: 'POI spreadsheet rows' })).toHaveValue('Coordinate list\t16.4\t48.2');
});

it.each(['finished', 'stopped'] as const)('scopes %s lookup messages to Addresses while retaining cross-mode success notices', async (outcome) => {
  const search = vi.fn<SearchProvider['search']>();
  let finishLookup: ((value: SearchResponse) => void) | undefined;
  if (outcome === 'finished') search.mockResolvedValue(response);
  else search.mockImplementation(() => new Promise<SearchResponse>((resolve) => { finishLookup = resolve; }));
  const { user } = await prepareLists(search);
  if (outcome === 'finished') await screen.findByText('Matched location: Matched Vienna, Austria');
  else await user.click(screen.getByRole('button', { name: 'Stop lookup' }));
  await user.click(screen.getByRole('radio', { name: 'Coordinates' }));
  expect(screen.queryByRole('region', { name: 'POI list messages' })).toBeNull();
  await user.click(screen.getByRole('radio', { name: 'Addresses' }));
  await waitFor(() => expect(screen.getByRole('region', { name: 'POI list messages' })).toHaveTextContent(`Lookup ${outcome}`));
  await user.click(screen.getByRole('radio', { name: 'Coordinates' }));
  await user.click(screen.getByRole('button', { name: 'Add POIs' }));
  expect(screen.getByRole('region', { name: 'POI list messages' })).toHaveTextContent('Added 1 POI. Your other list is still unadded.');
  await act(async () => finishLookup?.(response));
  expect(screen.getByRole('region', { name: 'POI list messages' })).toHaveTextContent('Added 1 POI. Your other list is still unadded.');
});
