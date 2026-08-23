import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('Felt-inspired inspector cohesion', () => {
  it('uses one checkbox, switch, and Lucide menu language across project and layer properties', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    expect(screen.queryByRole('button', { name: 'Project menu' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Show roads' })).toHaveClass('studio-checkbox-native');
    expect(screen.getByRole('switch', { name: 'Lock map area' })).toHaveClass('studio-switch-native');

    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
    expect(screen.queryByText('Layer properties')).not.toBeInTheDocument();
    const layerMenu = screen.getByRole('button', { name: 'Layer menu' });
    expect(layerMenu.textContent).toBe('');
    expect(layerMenu.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('switch', { name: 'Toggle layer visibility' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Toggle layer lock' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Show travel-mode marker' })).toHaveClass('studio-checkbox-native');

    await user.click(screen.getByRole('button', { name: 'Select City center' }));
    expect(screen.getByRole('switch', { name: 'Invert shape fill' })).toHaveClass('studio-switch-native');
  });
});
