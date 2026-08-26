import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

describe('editor history shortcuts', () => {
  it('supports platform undo and redo shortcuts outside editable controls', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select City center' }));
    const name = screen.getByRole('textbox', { name: 'Layer name' });
    await user.clear(name);
    await user.type(name, 'Poster boundary');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Select Poster boundary' })).toBeInTheDocument();

    screen.getByRole('button', { name: 'Undo' }).focus();
    await user.keyboard('{Control>}z{/Control}');
    expect(screen.getByRole('button', { name: 'Select City center' })).toBeInTheDocument();

    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(screen.getByRole('button', { name: 'Select Poster boundary' })).toBeInTheDocument();

    await user.keyboard('{Control>}y{/Control}');
    expect(screen.getByRole('button', { name: 'Select Poster boundary' })).toBeInTheDocument();
  });

  it('does not intercept undo while a text field is active', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select City center' }));
    const name = screen.getByRole('textbox', { name: 'Layer name' });
    await user.clear(name);
    await user.type(name, 'Draft title');
    await user.keyboard('{Control>}z{/Control}');

    expect(name).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});
