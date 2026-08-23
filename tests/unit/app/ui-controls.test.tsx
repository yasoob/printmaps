import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox, Switch } from '../../../src/app/components/UiControls';

describe('shared inspector controls', () => {
  it('keeps checkbox semantics, keyboard behavior, and a Lucide checked indicator', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Show roads" isChecked={false} onCheckedChange={onCheckedChange} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Show roads' });
    expect(checkbox).toHaveClass('studio-checkbox-native');
    expect(checkbox.parentElement?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    checkbox.focus();
    await user.keyboard(' ');

    expect(onCheckedChange).toHaveBeenCalledWith(true);
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
