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

  it('validates and creates a pasted POI spreadsheet as one undoable batch', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Pin (P)' }));
    await user.click(screen.getByRole('button', { name: 'Paste POI list' }));

    const spreadsheet = screen.getByRole('textbox', { name: 'POI spreadsheet rows' });
    expect(spreadsheet).toHaveFocus();
    await user.type(spreadsheet, 'Broken row');
    await user.click(screen.getByRole('button', { name: 'Add POIs' }));
    expect(screen.getByText(/Spreadsheet row 1/iu)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

    await user.clear(spreadsheet);
    await user.paste('Name\tLongitude\tLatitude\nCafé Central\t16.3725\t48.2084\nMuseum Quarter\t16.3599\t48.2034');
    await user.click(screen.getByRole('button', { name: 'Add POIs' }));

    expect(screen.getByRole('button', { name: 'Select Café Central' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Select Museum Quarter' })).toBeInTheDocument();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-layer-geometry', expect.stringContaining('poi-02:[16.3599,48.2034]'));
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Select Café Central' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Museum Quarter' })).not.toBeInTheDocument();
  });

  it('returns from the spreadsheet to map placement without changing history', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Pin (P)' }));
    await user.click(screen.getByRole('button', { name: 'Paste POI list' }));
    await user.click(screen.getByRole('button', { name: 'Cancel list' }));

    expect(screen.getByRole('status', { name: 'POI placement status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paste POI list' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});
