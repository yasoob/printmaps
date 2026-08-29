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

  it('uses Select for feature work and map navigation while keeping Fit page direct', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    const map = screen.getByTestId('map-canvas');
    expect(screen.queryByRole('button', { name: 'More map tools' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pan/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('h');
    expect(map).toHaveAttribute('data-interaction-mode', 'select');

    const fit = screen.getByRole('button', { name: 'Fit page' });
    await user.click(fit);
    expect(map).toHaveAttribute('data-fit-request', '1');

    await user.click(screen.getByRole('switch', { name: 'Lock map area' }));
    expect(fit).toBeDisabled();
  });
});
