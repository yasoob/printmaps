import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createInitialProjectDocument } from '../../../src/domain/project';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('polygon authoring', () => {
  it('adds a bundled administrative area as a selected undoable shape', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Shape (S)' }));
    const areaSelect = screen.getByRole('combobox', { name: 'Administrative area' });
    await user.selectOptions(areaSelect, 'AUT');
    await user.click(screen.getByRole('button', { name: 'Add administrative area' }));

    expect(screen.getByRole('button', { name: 'Select Austria' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { name: 'Austria' })).toBeInTheDocument();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-layer-geometry', expect.stringContaining('admin-aut'));
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-fit-layer-id', 'admin-aut');
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Select Austria' })).not.toBeInTheDocument();
  });

  it('merges two selected regions into one fitted undoable shape', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Shape (S)' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
    await user.click(screen.getByRole('checkbox', { name: 'Lower Austria' }));
    await user.click(screen.getByRole('checkbox', { name: 'Vienna' }));
    await user.click(screen.getByRole('button', { name: 'Merge 2 selected areas' }));

    const merged = screen.getByRole('button', { name: 'Select Lower Austria + Vienna' });
    expect(merged).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-fit-layer-id', 'admin-at-3-at-9');
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(merged).not.toBeInTheDocument();
  });

  it('adds disconnected Tyrol without flattening its parts into editable rings', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Shape (S)' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
    await user.click(screen.getByRole('checkbox', { name: 'Tyrol' }));
    await user.click(screen.getByRole('button', { name: 'Add selected area' }));

    expect(screen.getByRole('button', { name: 'Select Tyrol' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('status', { name: 'Multi-part geometry status' })).toHaveTextContent(
      '2 disconnected parts',
    );
    expect(screen.queryByRole('heading', { name: 'Vertices' })).not.toBeInTheDocument();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-fit-layer-id', 'admin-at-7');
  });

  it('keeps an incompatible region selection open and explains how to recover', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Shape (S)' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Administrative level' }), 'region');
    await user.click(screen.getByRole('checkbox', { name: 'Burgenland' }));
    await user.click(screen.getByRole('checkbox', { name: 'Vorarlberg' }));
    await user.click(screen.getByRole('button', { name: 'Merge 2 selected areas' }));

    expect(screen.getByRole('alert', { name: 'Administrative area status' })).toHaveTextContent(
      'Choose connected single-part regions, or add Tyrol separately.',
    );
    expect(screen.getByRole('button', { name: 'Cancel shape' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Burgenland + Vorarlberg' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'Vorarlberg' }));
    await user.click(screen.getByRole('checkbox', { name: 'Styria' }));
    await user.click(screen.getByRole('button', { name: 'Merge 2 selected areas' }));
    expect(screen.getByRole('button', { name: 'Select Burgenland + Styria' })).toHaveAttribute('aria-current', 'true');
  });

  it('finishes three map clicks as one selected undoable shape', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Shape (S)' }));
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
    const finish = screen.getByRole('button', { name: 'Finish shape' });
    expect(screen.getByRole('status', { name: 'Shape drawing status' })).toHaveTextContent('0 vertices');
    expect(finish).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
    expect(screen.getByRole('status', { name: 'Shape drawing status' })).toHaveTextContent('2 vertices');
    expect(finish).toBeDisabled();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-layer-state', expect.stringContaining('shape-draft'));

    await user.click(screen.getByRole('button', { name: 'Map shape point 3' }));
    expect(screen.getByRole('status', { name: 'Shape drawing status' })).toHaveTextContent('3 vertices');
    expect(finish).toBeEnabled();

    await user.click(finish);
    expect(screen.getByRole('button', { name: 'Select Shape 01' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { name: 'Shape 01' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Shape drawing status' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Select Shape 01' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByRole('button', { name: 'Select Shape 01' })).toBeInTheDocument();
  });

  it('cancels an unfinished shape without changing project history', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Shape (S)' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Cancel shape' }));

    expect(screen.queryByRole('status', { name: 'Shape drawing status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Shape 01' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
  });

  it('keeps Finish disabled until three map vertices are distinct', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Shape (S)' }));
    const repeatedPoint = screen.getByRole('button', { name: 'Map route point 1' });
    await user.click(repeatedPoint);
    await user.click(repeatedPoint);
    await user.click(repeatedPoint);

    expect(screen.getByRole('status', { name: 'Shape drawing status' })).toHaveTextContent('3 vertices');
    expect(screen.getByRole('button', { name: 'Finish shape' })).toBeDisabled();
    expect(screen.getByTestId('map-canvas')).not.toHaveAttribute('data-layer-state', expect.stringContaining('shape-draft:true'));
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  it('does not restore an abandoned shape draft after another project opens', async () => {
    const user = userEvent.setup();
    const { container } = render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Shape (S)' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    expect(screen.getByRole('status', { name: 'Shape drawing status' })).toHaveTextContent('1 vertex');
    const opened = createInitialProjectDocument();
    opened.id = 'opened-project';
    opened.title = 'Opened project';
    const input = container.querySelector<HTMLInputElement>('input[accept^=".printmap.json"]');
    if (!input) throw new Error('Project open input unavailable');

    fireEvent.change(input, {
      target: { files: [new File([JSON.stringify(opened)], 'opened.printmap.json', { type: 'application/json' })] },
    });

    expect(await screen.findByRole('button', { name: 'Opened project' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Shape drawing status' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Shape (S)' }));
    expect(screen.getByRole('status', { name: 'Shape drawing status' })).toHaveTextContent('0 vertices');
  });
});
