import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('truthful edit-tool workflows', () => {
  it('clears the previous selection and its handles when area creation starts', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    const area = screen.getByRole('button', { name: 'Select City center' });
    await user.click(area);
    expect(screen.getByRole('group', { name: 'Area editing' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Area (S)' }));

    expect(area).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('group', { name: 'Area editing' })).not.toBeInTheDocument();
  });

  it('undoes the latest route draft point without touching project history', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));

    const undoPoint = screen.getByRole('button', { name: 'Undo last route point' });
    expect(undoPoint).toBeEnabled();
    await user.click(undoPoint);

    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('1 point');
    expect(screen.getByRole('button', { name: 'Finish route' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('undoes the latest custom-area draft point', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));

    await user.click(screen.getByRole('button', { name: 'Undo last area point' }));

    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('1 vertex');
    expect(screen.getByRole('button', { name: 'Finish area' })).toBeDisabled();
  });

  it('activates advertised tool shortcuts without intercepting typing fields', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.keyboard('s');
    expect(screen.getByRole('tab', { name: 'Find administrative area' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel area' }));

    const search = screen.getByRole('combobox', { name: 'Search places and addresses' });
    await user.click(search);
    await user.keyboard('r');
    expect(screen.queryByRole('status', { name: 'Route drawing status' })).not.toBeInTheDocument();
    expect(search).toHaveValue('r');

    await user.click(screen.getByRole('button', { name: 'Select (V)' }));
    await user.keyboard('r');
    expect(screen.getByRole('status', { name: 'Route drawing status' })).toBeInTheDocument();
  });

  it('disables shape coordinate controls while the area is locked or hidden', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Select City center' }));
    const lock = screen.getByRole('switch', { name: 'Toggle layer lock' });
    const visibility = screen.getByRole('switch', { name: 'Toggle layer visibility' });

    await user.click(lock);
    expect(screen.getByRole('combobox', { name: 'Shape ring' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Shape vertex' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Shape vertex longitude' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Shape vertex latitude' })).toBeDisabled();

    await user.click(lock);
    await user.click(visibility);
    expect(screen.getByRole('combobox', { name: 'Shape ring' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Shape vertex longitude' })).toBeDisabled();
  });
});
