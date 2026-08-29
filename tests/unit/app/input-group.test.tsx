import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { InputGroup, InputGroupAddon, InputNumber } from '../../../src/app/components/InputGroup';

function ScrubHarness({ onCommit = () => {} }: { onCommit?: (value: number) => void }) {
  const [value, setValue] = useState('4');
  return (
    <InputGroup>
      <InputGroupAddon enableScrubbing sensitivity={4}>W</InputGroupAddon>
      <InputNumber
        aria-label="Width"
        min={0}
        max={10}
        step={2}
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        onBlur={(event) => onCommit(event.currentTarget.valueAsNumber)}
      />
      <InputGroupAddon align="inline-end">px</InputGroupAddon>
    </InputGroup>
  );
}

function ScientificHarness({ value: initialValue, step }: { value: string; step: number }) {
  const [value, setValue] = useState(initialValue);
  return (
    <InputGroup>
      <InputGroupAddon enableScrubbing sensitivity={4}>Value</InputGroupAddon>
      <InputNumber aria-label="Scientific value" min={0} step={step} value={value} onChange={(event) => setValue(event.currentTarget.value)} />
    </InputGroup>
  );
}

describe('InputGroup numeric scrubbing', () => {
  it('scrubs through the addon using the nearby InputNumber constraints and commits once', () => {
    const onCommit = vi.fn();
    render(<ScrubHarness onCommit={onCommit} />);
    const input = screen.getByRole('spinbutton', { name: 'Width' });
    const addon = screen.getByText('W');

    fireEvent.pointerDown(addon, { button: 0, clientX: 10, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 18, pointerId: 1 });
    expect(input).toHaveValue(8);
    fireEvent.pointerMove(window, { clientX: 2, pointerId: 1 });
    expect(input).toHaveValue(0);
    fireEvent.pointerMove(window, { clientX: 42, pointerId: 1 });
    expect(input).toHaveValue(10);
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, { clientX: 42, pointerId: 1 });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(10);
  });

  it('isolates repeated scrubs by their initiating pointer', () => {
    const onCommit = vi.fn();
    render(<ScrubHarness onCommit={onCommit} />);
    const input = screen.getByRole('spinbutton', { name: 'Width' });
    const addon = screen.getByText('W');

    fireEvent.pointerDown(addon, { button: 0, clientX: 10, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 14, pointerId: 1 });
    expect(input).toHaveValue(6);
    fireEvent.pointerDown(addon, { button: 0, clientX: 14, pointerId: 2 });
    fireEvent.pointerMove(window, { clientX: 22, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 22, pointerId: 1 });
    expect(input).toHaveValue(6);
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.pointerMove(window, { clientX: 18, pointerId: 2 });
    fireEvent.pointerUp(window, { clientX: 18, pointerId: 2 });
    expect(input).toHaveValue(8);
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it('removes active pointer listeners and scrub state when unmounted', () => {
    const onCommit = vi.fn();
    const view = render(<ScrubHarness onCommit={onCommit} />);
    const addon = screen.getByText('W');

    fireEvent.pointerDown(addon, { button: 0, clientX: 10, pointerId: 7 });
    fireEvent.pointerMove(window, { clientX: 14, pointerId: 7 });
    expect(document.body).toHaveClass('is-number-scrubbing');
    view.unmount();
    expect(document.body).not.toHaveClass('is-number-scrubbing');
    fireEvent.pointerMove(window, { clientX: 30, pointerId: 7 });
    fireEvent.pointerUp(window, { clientX: 30, pointerId: 7 });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it.each([
    ['1.23e-7', 1e-9, 1.24e-7],
    ['1e-101', 1e-102, 1.1e-101],
  ] as const)('preserves scrub precision for %s without throwing', (initial, step, expected) => {
    render(<ScientificHarness value={initial} step={step} />);
    const addon = screen.getByText('Value');
    const input = screen.getByRole('spinbutton', { name: 'Scientific value' });

    expect(() => {
      fireEvent.pointerDown(addon, { button: 0, clientX: 10, pointerId: 1 });
      fireEvent.pointerMove(window, { clientX: 14, pointerId: 1 });
      fireEvent.pointerUp(window, { clientX: 14, pointerId: 1 });
    }).not.toThrow();
    expect(input).toHaveValue(expected);
  });
});
