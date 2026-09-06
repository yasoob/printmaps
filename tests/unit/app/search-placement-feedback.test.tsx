import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import type { SearchProvider } from '../../../src/services/mapbox/contracts';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

const searchProvider: SearchProvider = {
  search: async () => ({
    results: [{ providerFeatureId: 'new-york', label: 'New York', center: [-73.9857, 40.7484] }],
    useBoundary: 'provider-response-use-requires-terms-review',
  }),
};

async function addSearchedPlace(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Place (P)' }));
  await user.type(screen.getByRole('combobox', { name: 'Search places and addresses' }), 'New York{Enter}');
  await user.click(await screen.findByRole('option', { name: 'New York' }));
}

it('keeps framing until the explicit Show on map action', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} searchProvider={searchProvider} />);
  await addSearchedPlace(user);
  const map = screen.getByTestId('map-canvas');
  expect(map).toHaveAttribute('data-map-location-request', '0');
  expect(screen.getByRole('status', { name: 'Place search status' })).toHaveTextContent('Added New York.');
  await user.click(screen.getByRole('button', { name: 'Show on map' }));
  expect(map).toHaveAttribute('data-map-location-request', '1:-73.9857,40.7484');
  expect(screen.queryByRole('button', { name: 'Show on map' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
});

it('explains a locked map and enables locating after unlocking', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} searchProvider={searchProvider} />);
  await user.click(screen.getByRole('switch', { name: 'Lock map area' }));
  await addSearchedPlace(user);
  expect(screen.getByRole('button', { name: 'Show on map' })).toBeDisabled();
  expect(screen.getByText('Unlock the map area to show this location.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Map background' }));
  await user.click(screen.getByRole('switch', { name: 'Lock map area' }));
  expect(screen.getByRole('button', { name: 'Show on map' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Hide New York' }));
  expect(screen.getByRole('button', { name: 'Show on map' })).toBeDisabled();
  expect(screen.getByText('Show this layer before locating it.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Show New York' }));
  expect(screen.getByRole('button', { name: 'Show on map' })).toBeEnabled();
});

it('does not revive stale confirmation after the created layer is undone and redone', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} searchProvider={searchProvider} />);
  await addSearchedPlace(user);
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  expect(screen.queryByRole('button', { name: 'Show on map' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Redo' }));
  expect(screen.queryByRole('button', { name: 'Show on map' })).not.toBeInTheDocument();
});

it('clears an old confirmation while typing without stealing input focus', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} searchProvider={searchProvider} />);
  await addSearchedPlace(user);
  const input = screen.getByRole('combobox', { name: 'Search places and addresses' });
  await user.clear(input);
  await user.type(input, 'Paris');
  expect(input).toHaveFocus();
  expect(screen.queryByRole('button', { name: 'Show on map' })).not.toBeInTheDocument();
});
