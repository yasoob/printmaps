import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('POI authoring', () => {
  it('places one map click as a selected undoable POI', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Pin (P)' }));
    expect(screen.getByRole('button', { name: 'Export' })).toHaveAttribute('title', 'Finish or cancel map authoring before export');
    expect(screen.getByRole('status', { name: 'POI placement status' })).toHaveTextContent('Click the map to place a POI');

    await user.click(screen.getByRole('button', { name: 'Map POI point' }));

    expect(screen.getByRole('button', { name: 'Select POI 01' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { name: 'POI 01' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'POI placement status' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Select POI 01' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByRole('button', { name: 'Select POI 01' })).toBeInTheDocument();
  });

  it('cancels placement without changing project history', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Pin (P)' }));
    await user.click(screen.getByRole('button', { name: 'Cancel POI' }));

    expect(screen.queryByRole('status', { name: 'POI placement status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select POI 01' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
  });
});
