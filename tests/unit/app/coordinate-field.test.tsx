import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoordinateField } from '../../../src/app/components/CoordinateField';
import { MAX_MERCATOR_LATITUDE } from '../../../src/domain/project';

it('resets and announces a rejected Mercator latitude commit', async () => {
  const user = userEvent.setup();
  const onCommit = vi.fn();
  render(
    <CoordinateField
      ariaLabel="Route latitude"
      label="Latitude"
      maximum={MAX_MERCATOR_LATITUDE}
      minimum={-MAX_MERCATOR_LATITUDE}
      onCommit={onCommit}
      value={48.2}
    />,
  );
  const input = screen.getByRole('textbox', { name: 'Route latitude' });

  await user.clear(input);
  await user.type(input, '89');
  await user.tab();

  expect(input).toHaveValue('48.2');
  expect(screen.getByRole('alert')).toHaveTextContent(`Latitude must be between -${MAX_MERCATOR_LATITUDE} and ${MAX_MERCATOR_LATITUDE}.`);
  expect(onCommit).not.toHaveBeenCalled();
});
