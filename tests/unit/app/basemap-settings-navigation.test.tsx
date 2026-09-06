import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

it('offers a clear path from basemap metadata to the canonical map design controls', async () => {
  localStorage.removeItem('print-map-studio:inspector:project:map-style');
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Select Paper basemap' }));
  expect(screen.getByRole('textbox', { name: 'Layer name' })).toHaveValue('Paper basemap');
  await user.click(screen.getByRole('button', { name: 'Map design settings' }));
  expect(screen.getByRole('heading', { name: 'Project' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Map style' }));
  expect(screen.getByRole('radiogroup', { name: 'Map style presets' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Map language' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Map details' })).toBeInTheDocument();
});
