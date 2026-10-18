import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox, Switch } from '../../../src/app/components/UiControls';

describe('shared inspector controls', () => {
  it('keeps checkbox semantics, keyboard behavior, and a Lucide checked indicator', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Show roads" isChecked={false} onCheckedChange={onCheckedChange} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Show roads' });
    expect(checkbox).toHaveAttribute('data-slot', 'checkbox');
    checkbox.focus();
    await user.keyboard(' ');

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('toggles a checkbox from its visible label and shows the Lucide check when checked', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Show water" isChecked onCheckedChange={onCheckedChange} />);
    expect(screen.getByRole('checkbox', { name: 'Show water' }).querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await user.click(screen.getByText('Show water'));
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it('exposes standalone state as an accessible switch with native disabled behavior', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch label="Lock map area" isChecked disabled onCheckedChange={onCheckedChange} />);

    const control = screen.getByRole('switch', { name: 'Lock map area' });
    expect(control).toBeChecked();
    expect(control).toBeDisabled();
    await user.click(control);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
