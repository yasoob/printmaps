import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouteVertexControls } from '../../../src/app/components/RouteVertexControls';

const points: [number, number][] = [[0, 0], [1, 1], [2, 0], [0, 0]];

it('explains the closed minimum before removal and updates eligibility after insertion', async () => {
  const user = userEvent.setup();
  const onRemove = vi.fn(() => ({ ok: true as const }));
  const props = {
    isClosed: true, middleOnlyRemove: true, noun: 'Anchor' as const,
    onChange: vi.fn(), onInsert: vi.fn(), onRemove,
  };
  const { rerender } = render(<RouteVertexControls {...props} coordinates={points} />);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Route anchor' }), '1');
  const remove = screen.getByRole('button', { name: 'Remove selected route anchor' });
  expect(remove).toBeDisabled();
  expect(remove).toHaveAccessibleDescription('Closed routes need at least three distinct points.');
  await user.click(remove);
  expect(onRemove).not.toHaveBeenCalled();
  rerender(<RouteVertexControls {...props} coordinates={[[0, 0], [1, 1], [2, 0], [1, -1], [0, 0]]} />);
  expect(remove).toBeEnabled();
  expect(remove).not.toHaveAttribute('aria-describedby');
  await user.click(remove);
  expect(onRemove).toHaveBeenCalledExactlyOnceWith(1);
});

it('keeps open minimum and endpoint rules while allowing a removable middle point', async () => {
  const user = userEvent.setup();
  const props = { middleOnlyRemove: true, onChange: vi.fn(), onInsert: vi.fn(), onRemove: vi.fn(() => ({ ok: true as const })) };
  const { rerender } = render(<RouteVertexControls {...props} coordinates={points.slice(0, 2)} />);
  const remove = screen.getByRole('button', { name: 'Remove selected route vertex' });
  expect(remove).toBeDisabled();
  expect(remove).toHaveAccessibleDescription('Routes need at least two distinct points.');
  rerender(<RouteVertexControls {...props} coordinates={points.slice(0, 3)} />);
  expect(remove).toBeDisabled();
  expect(remove).toHaveAccessibleDescription('Only a middle route point can be removed.');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Route vertex' }), '1');
  expect(remove).toBeEnabled();
});
