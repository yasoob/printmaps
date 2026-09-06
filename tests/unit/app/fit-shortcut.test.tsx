import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

it('accepts the physical shifted digit and semantic fallback without bypassing input or lock guards', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  const map = screen.getByTestId('map-canvas');
  fireEvent.keyDown(document, { key: '!', code: 'Digit1', shiftKey: true });
  expect(map).toHaveAttribute('data-fit-request', '1');
  fireEvent.keyDown(document, { key: '1', shiftKey: true });
  expect(map).toHaveAttribute('data-fit-request', '2');
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search places and addresses' }), {
    key: '!', code: 'Digit1', shiftKey: true,
  });
  fireEvent.keyDown(document, { key: '!', code: 'Digit1', shiftKey: true, ctrlKey: true });
  expect(map).toHaveAttribute('data-fit-request', '2');
  await user.click(screen.getByRole('switch', { name: 'Lock map area' }));
  fireEvent.keyDown(document, { key: '!', code: 'Digit1', shiftKey: true });
  expect(map).toHaveAttribute('data-fit-request', '2');
});
