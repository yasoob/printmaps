import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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

it.each(['48.2', '48.2000', ' 48.2 '])('does not commit unchanged coordinate text %j on Enter or blur', async (draft) => {
  const user = userEvent.setup();
  const onCommit = vi.fn(() => ({ ok: true as const }));
  render(<CoordinateField ariaLabel="Route latitude" label="Latitude" maximum={85} minimum={-85} onCommit={onCommit} value={48.2} />);
  const input = screen.getByRole('textbox', { name: 'Route latitude' });
  await user.clear(input);
  await user.type(input, draft);
  await user.keyboard('{Enter}');
  await user.tab();
  expect(onCommit).not.toHaveBeenCalled();
  expect(input).toHaveValue('48.2');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('commits a changed coordinate once when Enter is followed by Tab', async () => {
  const user = userEvent.setup();
  const onCommit = vi.fn(() => ({ ok: true as const }));
  function ControlledCoordinate() {
    const [value, setValue] = useState(48.2);
    return <CoordinateField ariaLabel="Route latitude" label="Latitude" maximum={85} minimum={-85} value={value} onCommit={(next) => {
      setValue(next);
      return onCommit();
    }} />;
  }
  render(<ControlledCoordinate />);
  const input = screen.getByRole('textbox', { name: 'Route latitude' });
  await user.clear(input);
  await user.type(input, '48.3{Enter}');
  expect(input).toHaveFocus();
  await user.tab();
  expect(onCommit).toHaveBeenCalledOnce();
  expect(input).toHaveValue('48.3');
});

it('does not confuse blank input with an unchanged zero coordinate', async () => {
  const user = userEvent.setup();
  const onCommit = vi.fn(() => ({ ok: true as const }));
  render(<CoordinateField ariaLabel="Route longitude" label="Longitude" maximum={180} minimum={-180} onCommit={onCommit} value={0} />);
  const input = screen.getByRole('textbox', { name: 'Route longitude' });
  await user.clear(input);
  await user.tab();
  expect(onCommit).not.toHaveBeenCalled();
  expect(input).toHaveValue('0');
  expect(screen.getByRole('alert')).toHaveTextContent('Longitude must be between');
  await user.click(input);
  await user.keyboard('{Enter}');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(onCommit).not.toHaveBeenCalled();
});
