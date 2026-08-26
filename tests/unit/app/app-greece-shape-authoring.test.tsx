import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

it('exposes every Greek first-order division through the region country selector', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);

  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Region country' }), 'GRC');

  const regions = screen.getByRole('group', { name: 'Greece regions' });
  expect(within(regions).getAllByRole('checkbox')).toHaveLength(14);
  expect(within(regions).getByRole('checkbox', { name: 'Attica' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Crete' })).toBeInTheDocument();
  expect(within(regions).getByRole('checkbox', { name: 'Mount Athos' })).toBeInTheDocument();
  expect(screen.getByText('Greece · Natural Earth')).toBeInTheDocument();
});
