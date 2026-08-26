import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('calm editor defaults', () => {
  it('keeps optional style choices collapsed and removes low-value layer chrome', () => {
    localStorage.removeItem('print-map-studio:inspector:project:map-style');
    render(<App />);

    expect(screen.getByRole('button', { name: 'Map style' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('radiogroup', { name: 'Map style presets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Filter layers' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^4 layers$/)).not.toBeInTheDocument();
  });

  it('keeps keyboard focus inside More and returns it to the trigger on close', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    const more = screen.getByRole('button', { name: 'More map tools' });
    await user.click(more);
    const pan = screen.getByRole('menuitemradio', { name: /Pan/ });
    const fit = screen.getByRole('menuitem', { name: /Fit page/ });
    expect(pan).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(fit).toHaveFocus();
    await user.keyboard('{Home}');
    expect(pan).toHaveFocus();
    await user.keyboard('{End}');
    expect(fit).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(more).toHaveFocus();
    expect(screen.queryByRole('menu', { name: 'More map tools' })).not.toBeInTheDocument();
  });

  it('keeps locked More commands discoverable without activating them', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    const map = screen.getByTestId('map-canvas');
    await user.click(screen.getByRole('switch', { name: 'Lock map area' }));
    await user.click(screen.getByRole('button', { name: 'More map tools' }));

    const pan = screen.getByRole('menuitemradio', { name: /Pan/ });
    const fit = screen.getByRole('menuitem', { name: /Fit page/ });
    expect(pan).toHaveAttribute('aria-disabled', 'true');
    expect(pan).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menu', { name: 'More map tools' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('{ArrowDown}');
    expect(fit).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(map).toHaveAttribute('data-fit-request', '0');
  });
});
