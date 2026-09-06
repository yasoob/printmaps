import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { stubMobileViewport } from './mobileViewport';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

it('does not finish a route when Enter activates the unfinished-work disclosure', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Route (R)' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
  const summary = screen.getByRole('status', { name: 'Unfinished drawing' }).closest('summary');
  if (!summary) throw new Error('Expected the unfinished-drawing disclosure');
  summary.focus();
  await user.keyboard('{Enter}');
  expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-interaction-mode', 'route');
  expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('2 points');
  expect(screen.queryByRole('button', { name: 'Select Route 02' })).not.toBeInTheDocument();
});
afterEach(() => vi.unstubAllGlobals());

it('suspends tool shortcuts while export owns the interaction, including events on document', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Export' }));
  const map = screen.getByTestId('map-canvas');
  screen.getByRole('button', { name: 'Close export' }).focus();
  for (const key of ['p', 'r', 's', 'v']) {
    await user.keyboard(key);
    expect(map).toHaveAttribute('data-interaction-mode', 'select');
  }
  fireEvent.keyDown(document, { key: 'p' });
  expect(map).toHaveAttribute('data-interaction-mode', 'select');
  await user.click(screen.getByRole('button', { name: 'Close export' }));
  await user.keyboard('p');
  expect(map).toHaveAttribute('data-interaction-mode', 'pin');
});

it('keeps menu typeahead from changing tools', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Project' }));
  const map = screen.getByTestId('map-canvas');
  for (const key of ['p', 'r', 's']) {
    await user.keyboard(key);
    expect(map).toHaveAttribute('data-interaction-mode', 'select');
  }
  await user.keyboard('{Escape}');
  await user.keyboard('p');
  expect(map).toHaveAttribute('data-interaction-mode', 'pin');
});

it('leaves route drafts unchanged while a menu or discard dialog owns keyboard input', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Route (R)' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
  await user.click(screen.getByRole('button', { name: 'Project' }));
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('1 point');
  await user.click(screen.getByRole('button', { name: 'Cancel route' }));
  screen.getByRole('button', { name: 'Keep editing' }).focus();
  await user.keyboard('s');
  fireEvent.keyDown(document, { key: 'p' });
  expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-interaction-mode', 'route');
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('1 point');
});

it('supports area draft undo/finish and suspends rather than discards on Escape', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
  await user.click(screen.getByRole('button', { name: 'Map shape point 3' }));
  const map = screen.getByTestId('map-canvas');
  fireEvent.keyDown(map, { key: 'Backspace' });
  expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('2 vertices');
  fireEvent.keyDown(map, { key: 'Enter' });
  expect(screen.queryByRole('button', { name: 'Select Area 01' })).not.toBeInTheDocument();
  fireEvent.keyDown(map, { key: 'Escape' });
  expect(map).toHaveAttribute('data-interaction-mode', 'select');
  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('2 vertices');
  fireEvent.keyDown(map, { key: 'Delete' });
  expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('1 vertex');
  await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
  await user.click(screen.getByRole('button', { name: 'Map shape point 3' }));
  fireEvent.keyDown(map, { key: 'Enter' });
  expect(screen.getByRole('button', { name: 'Select Area 01' })).toBeInTheDocument();
});

it('blocks area shortcuts while typing, using buttons, or interacting with menus and modals', async () => {
  stubMobileViewport();
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
  await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
  await user.click(screen.getByRole('button', { name: 'Map shape point 3' }));
  await user.click(screen.getByRole('button', { name: 'Show area settings' }));
  const status = screen.getByRole('status', { name: 'Area drawing status' });
  const map = screen.getByTestId('map-canvas');
  screen.getByRole('textbox', { name: 'New area point longitude' }).focus();
  await user.keyboard('{Escape}{Backspace}{Delete}');
  expect(status).toHaveTextContent('3 vertices');
  expect(map).toHaveAttribute('data-interaction-mode', 'shape');
  await act(async () => {
    for (const key of ['Enter', 'Backspace', 'Delete']) {
      fireEvent.keyDown(screen.getByRole('button', { name: 'Hide area settings' }), { key });
      fireEvent.keyDown(map, { key, ctrlKey: true });
      fireEvent.keyDown(map, { key, repeat: true });
      fireEvent.keyDown(map, { key, isComposing: true });
    }
  });
  expect(status).toHaveTextContent('3 vertices');
  await user.click(screen.getByRole('button', { name: 'Project' }));
  const menuItem = screen.getByRole('menuitem', { name: 'Open project' });
  await act(async () => menuItem.focus());
  await user.keyboard('{Backspace}{Delete}');
  await user.keyboard('{Escape}');
  expect(status).toHaveTextContent('3 vertices');
  await user.click(screen.getByRole('button', { name: 'Project' }));
  await user.click(screen.getByRole('menuitem', { name: 'Rename project' }));
  await screen.findByRole('dialog', { name: 'Rename project' });
  await act(async () => {
    for (const key of ['Enter', 'Backspace', 'Delete']) {
      fireEvent.keyDown(map, { key });
      fireEvent.keyDown(document, { key });
    }
  });
  expect(status).toHaveTextContent('3 vertices');
  expect(map).toHaveAttribute('data-interaction-mode', 'shape');
  await user.keyboard('{Escape}');
  expect(map).toHaveAttribute('data-interaction-mode', 'shape');
  expect(screen.queryByRole('button', { name: 'Select Area 01' })).not.toBeInTheDocument();
});
