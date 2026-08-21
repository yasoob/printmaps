import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/app/App';

vi.mock('../../src/map/MapCanvas', () => ({
  MapCanvas: ({ onBackgroundClick }: { onBackgroundClick: () => void }) => (
    <button type="button" data-testid="map-canvas" onClick={onBackgroundClick}>Map canvas</button>
  ),
}));

describe('editor selection context', () => {
  it('shows project properties until a layer is selected, then returns on canvas click', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
    expect(screen.getByText('Layers')).toBeInTheDocument();
    expect(screen.getByText('Local draft')).toBeInTheDocument();
    expect(screen.queryByText('All changes saved locally')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
    expect(screen.getByRole('heading', { name: 'Route 01' })).toBeInTheDocument();
    expect(screen.getByLabelText('Layer opacity')).toBeInTheDocument();

    await user.click(screen.getByTestId('map-canvas'));
    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
  });
});
