import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

it('exposes every mainland Finnish region through the region country selector', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);

  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Region country' }), 'FIN');

  const regions = screen.getByRole('group', { name: 'Finland regions' });
  expect(within(regions).getAllByRole('checkbox')).toHaveLength(18);
  expect(within(regions).getByRole('checkbox', { name: 'Uusimaa' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Lapland' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Northern Ostrobothnia' })).toBeInTheDocument();
  expect(screen.getByText('Finland · Natural Earth')).toBeInTheDocument();
});
