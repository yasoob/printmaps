import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createInitialProjectDocument } from '../../../src/domain/project';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('straight route authoring', () => {
  it('authors an arc with a travel profile and printable mode marker', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Route line shape' }), 'arc');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Route travel profile' }), 'air');
    await user.click(screen.getByRole('checkbox', { name: 'Show travel-mode marker' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));

    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('Arc route · Air · 2 points');
    const draftGeometry = screen.getByTestId('map-canvas').dataset.layerGeometry ?? '';
    expect(draftGeometry.match(/route-draft:/)?.input).not.toContain('route-draft:[[16.31,48.19],[16.4,48.24]]');

    await user.click(screen.getByRole('button', { name: 'Finish route' }));

    expect(screen.getByRole('combobox', { name: 'Route travel profile' })).toHaveValue('air');
    expect(screen.getByRole('checkbox', { name: 'Show travel-mode marker' })).toBeChecked();
  });

  it('finishes two map clicks as one selected undoable route', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
    const finish = screen.getByRole('button', { name: 'Finish route' });
    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('0 points');
    expect(finish).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('1 point');
    expect(finish).toBeDisabled();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-layer-state', expect.stringContaining('route-draft-point-1:true'));
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('2 points');
    expect(finish).toBeEnabled();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-layer-state', expect.stringContaining('route-draft:true'));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

    await user.click(finish);
    expect(screen.getByRole('button', { name: 'Select Route 02' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { name: 'Route 02' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Route drawing status' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Select Route 02' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByRole('button', { name: 'Select Route 02' })).toBeInTheDocument();
  });

  it('cancels an unfinished route without changing project history', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Cancel route' }));

    expect(screen.queryByRole('status', { name: 'Route drawing status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Route 02' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
  });

  it('discards an unfinished route when another project is opened', async () => {
    const user = userEvent.setup();
    const { container } = render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('1 point');
    const opened = createInitialProjectDocument();
    opened.id = 'opened-project';
    opened.title = 'Opened project';
    const input = container.querySelector<HTMLInputElement>('input[accept^=".printmap.json"]');
    if (!input) throw new Error('Project open input unavailable');

    fireEvent.change(input, {
      target: { files: [new File([JSON.stringify(opened)], 'opened.printmap.json', { type: 'application/json' })] },
    });

    expect(await screen.findByRole('button', { name: 'Opened project' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Route drawing status' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('0 points');
  });

  it('discards route points when the user switches tools', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Pan (H)' }));
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));

    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('0 points');
    expect(screen.getByRole('button', { name: 'Finish route' })).toBeDisabled();
  });
});