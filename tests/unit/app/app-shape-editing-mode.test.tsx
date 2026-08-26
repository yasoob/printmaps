import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

it('defaults selected simple areas to point editing and switches explicitly to transform mode', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);

  await user.click(screen.getByRole('button', { name: 'Select City center' }));

  const editPoints = screen.getByRole('button', { name: 'Edit area points' });
  const transform = screen.getByRole('button', { name: 'Transform area' });
  expect(screen.getByRole('group', { name: 'Area editing' })).toBeInTheDocument();
  expect(editPoints).toHaveAttribute('aria-pressed', 'true');
  expect(transform).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-shape-edit-mode', 'points');

  await user.click(transform);

  expect(transform).toHaveAttribute('aria-pressed', 'true');
  expect(editPoints).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-shape-edit-mode', 'transform');
});
