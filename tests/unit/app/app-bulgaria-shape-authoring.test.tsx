import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

it('exposes every Bulgarian province through the region country selector', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);

  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Region country' }), 'BGR');

  const regions = screen.getByRole('group', { name: 'Bulgaria regions' });
  expect(within(regions).getAllByRole('checkbox')).toHaveLength(28);
  expect(within(regions).getByRole('checkbox', { name: 'Plovdiv' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Sofia City' })).toBeInTheDocument();
  expect(screen.getByText('Bulgaria · Natural Earth')).toBeInTheDocument();
});
