import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

it('exposes every Italian region through the region country selector', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);

  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Region country' }), 'ITA');

  const regions = screen.getByRole('group', { name: 'Italy regions' });
  expect(within(regions).getAllByRole('checkbox')).toHaveLength(20);
  expect(within(regions).getByRole('checkbox', { name: 'Lazio' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Sicily' })).toBeInTheDocument();
  expect(screen.getByText('Italy · Natural Earth')).toBeInTheDocument();
});
