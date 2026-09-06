import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ValidatedNumberField } from '../../../src/app/components/ValidatedNumberField';

function Harness({ onCommit }: { onCommit: (value: number) => void }) {
  const [value, setValue] = useState(100);
  return (
    <>
      <ValidatedNumberField
        label="Text scale" value={value} minimum={50} maximum={200} step={5}
        unit="%" resetKey={0}
        onCommit={(next) => { onCommit(next); setValue(next); return { ok: true }; }}
      />
      <button type="button">Next field</button>
    </>
  );
}

it('explains invalid drafts and keeps the rejection message after restoring the saved value', async () => {
  const user = userEvent.setup();
  const onCommit = vi.fn();
  render(<Harness onCommit={onCommit} />);
  const input = screen.getByRole('spinbutton', { name: 'Text scale' });
  await user.clear(input);
  await user.type(input, '250');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('alert')).toHaveTextContent('between 50 and 200');
  await user.tab();
  expect(input).toHaveValue(100);
  expect(screen.getByRole('alert')).toHaveTextContent('Previous value kept.');
  expect(input).toHaveAttribute('aria-describedby', screen.getByRole('alert').id);
  expect(onCommit).not.toHaveBeenCalled();
});

it('commits on Enter without remounting or duplicating the later blur commit', async () => {
  const user = userEvent.setup();
  const onCommit = vi.fn();
  render(<Harness onCommit={onCommit} />);
  const input = screen.getByRole('spinbutton', { name: 'Text scale' });
  await user.clear(input);
  await user.type(input, '125{Enter}');
  expect(screen.getByRole('spinbutton', { name: 'Text scale' })).toBe(input);
  expect(input).toHaveFocus();
  expect(input).toHaveValue(125);
  await user.tab();
  expect(onCommit).toHaveBeenCalledExactlyOnceWith(125);
});

it('cancels on Escape and resets dirty input when the canonical value or document changes', async () => {
  const user = userEvent.setup();
  const onCommit = vi.fn();
  const field = (value: number, resetKey: number) => (
    <ValidatedNumberField label="Width" value={value} minimum={0.1} step={0.1} unit="mm" resetKey={resetKey} onCommit={onCommit} />
  );
  const { rerender } = render(field(297, 0));
  const input = screen.getByRole('spinbutton', { name: 'Width' });
  fireEvent.change(input, { target: { value: '240' } });
  rerender(field(210, 0));
  rerender(field(297, 0));
  expect(input).toHaveValue(297);
  fireEvent.change(input, { target: { value: '240' } });
  rerender(field(297, 1));
  expect(input).toHaveValue(297);
  await user.clear(input);
  await user.type(input, '240{Escape}');
  expect(input).toHaveValue(297);
  await user.tab();
  expect(onCommit).not.toHaveBeenCalled();
});
