import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('editor panel layout', () => {
  it('collapses and expands Layers without changing document history or selection', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));

    const collapse = screen.getByRole('button', { name: 'Collapse layers' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    await user.click(collapse);

    const expand = screen.getByRole('button', { name: 'Expand layers' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect(expand).toHaveFocus();
    expect(screen.getByRole('main')).toHaveClass('is-layers-collapsed');
    expect(screen.getByRole('heading', { name: 'Coffee stop' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: 'Collapse layers' })).toHaveFocus();
    expect(screen.getByRole('main')).not.toHaveClass('is-layers-collapsed');
    expect(screen.getByRole('button', { name: 'Select Coffee stop' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});
