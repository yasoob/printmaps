import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('project camera properties', () => {
  it('commits valid bearing and pitch drafts to the canonical map camera', async () => {
    const user = userEvent.setup();
    render(<App />);
    const bearing = screen.getByRole('textbox', { name: 'Bearing' });
    const pitch = screen.getByRole('textbox', { name: 'Pitch' });
    const map = screen.getByTestId('map-canvas');

    await user.clear(bearing);
    await user.type(bearing, '35');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(map).toHaveAttribute('data-camera', '16.3725,48.2084,11.2,0,0');
    await user.tab();

    expect(map).toHaveAttribute('data-camera', '16.3725,48.2084,11.2,35,0');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    await user.clear(pitch);
    await user.type(pitch, '40');
    await user.tab();
    expect(map).toHaveAttribute('data-camera', '16.3725,48.2084,11.2,35,40');
  });

  it('marks an out-of-range camera draft invalid and restores the canonical value on blur', async () => {
    const user = userEvent.setup();
    render(<App />);
    const pitch = screen.getByRole('textbox', { name: 'Pitch' });

    await user.clear(pitch);
    await user.type(pitch, '61');

    expect(pitch).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await user.tab();
    expect(pitch).toHaveValue('0');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-camera', '16.3725,48.2084,11.2,0,0');
  });
});
