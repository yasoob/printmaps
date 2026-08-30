import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createInitialProjectDocument } from '../../../src/domain/project';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

it('keeps Area source choices concise without weakening their accessible names', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Area (S)' }));

  expect(screen.getByRole('tab', { name: 'Find administrative area' })).toHaveTextContent('Boundaries');
  expect(screen.getByRole('tab', { name: 'Draw custom area' })).toHaveTextContent('Draw');
  expect(screen.getByRole('tab', { name: 'Travel time' })).toHaveTextContent('Travel time');
});

it('uses roving arrow, Home, and End selection in the Shape tablist', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Area (S)' }));

  const administrative = screen.getByRole('tab', { name: 'Find administrative area' });
  const draw = screen.getByRole('tab', { name: 'Draw custom area' });
  expect(administrative).toHaveAttribute('tabindex', '0');
  expect(draw).toHaveAttribute('tabindex', '-1');
  administrative.focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Draw custom area' })).toHaveFocus();
  expect(screen.getByRole('tab', { name: 'Draw custom area' })).toHaveAttribute('aria-selected', 'true');
  await user.keyboard('{Home}');
  expect(screen.getByRole('tab', { name: 'Find administrative area' })).toHaveFocus();
  await user.keyboard('{End}');
  expect(screen.getByRole('tab', { name: 'Travel time' })).toHaveFocus();
});

describe('polygon authoring', () => {
  it('finishes three map clicks as one selected undoable shape', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
    const finish = screen.getByRole('button', { name: 'Finish area' });
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('0 vertices');
    expect(finish).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('2 vertices');
    expect(finish).toBeDisabled();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-layer-state', expect.stringContaining('shape-draft'));

    await user.click(screen.getByRole('button', { name: 'Map shape point 3' }));
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('3 vertices');
    expect(finish).toBeEnabled();

    await user.click(finish);
    expect(screen.getByRole('button', { name: 'Select Area 01' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { name: 'Area 01' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Area drawing status' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Select Area 01' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByRole('button', { name: 'Select Area 01' })).toBeInTheDocument();
  });

  it('cancels an unfinished shape without changing project history', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Cancel area' }));

    expect(screen.queryByRole('status', { name: 'Area drawing status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Area 01' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Select (V)' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
  });

  it('keeps Finish disabled until three map vertices are distinct', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    const repeatedPoint = screen.getByRole('button', { name: 'Map route point 1' });
    await user.click(repeatedPoint);
    await user.click(repeatedPoint);
    await user.click(repeatedPoint);

    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('3 vertices');
    expect(screen.getByRole('button', { name: 'Finish area' })).toBeDisabled();
    expect(screen.getByTestId('map-canvas')).not.toHaveAttribute('data-layer-state', expect.stringContaining('shape-draft:true'));
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  it('does not restore an abandoned shape draft after another project opens', async () => {
    const user = userEvent.setup();
    const { container } = render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('1 vertex');
    const opened = createInitialProjectDocument();
    opened.id = 'opened-project';
    opened.title = 'Opened project';
    const input = container.querySelector<HTMLInputElement>('input[accept^=".printmap.json"]');
    if (!input) throw new Error('Project open input unavailable');

    fireEvent.change(input, {
      target: { files: [new File([JSON.stringify(opened)], 'opened.printmap.json', { type: 'application/json' })] },
    });

    expect(await screen.findByRole('button', { name: 'Opened project' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Area drawing status' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('0 vertices');
  });
});
