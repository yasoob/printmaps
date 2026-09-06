import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createInitialProjectDocument } from '../../../src/domain/project';
import { stubMobileViewport } from './mobileViewport';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));
afterEach(() => vi.unstubAllGlobals());

async function enterAreaPoint(user: ReturnType<typeof userEvent.setup>, longitude: string, latitude: string) {
  const longitudeInput = screen.getByRole('textbox', { name: 'New area point longitude' });
  await user.clear(longitudeInput);
  await user.keyboard(longitude);
  await user.tab();
  expect(screen.getByRole('textbox', { name: 'New area point latitude' })).toHaveFocus();
  await user.keyboard('{Control>}a{/Control}');
  await user.keyboard(latitude);
  await user.keyboard('{Enter}');
  expect(longitudeInput).toHaveFocus();
}

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
  it('retains the same outline across area sources without committing it', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
    await user.click(screen.getByRole('button', { name: 'Map shape point 3' }));
    const map = screen.getByTestId('map-canvas');
    const geometry = map.dataset.layerGeometry;

    for (const source of ['Find administrative area', 'Travel time']) {
      await user.click(screen.getByRole('tab', { name: source }));
      expect(map).not.toHaveAttribute('data-layer-state', expect.stringContaining('shape-draft'));
      await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
      expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('3 vertices');
      expect(map).toHaveAttribute('data-layer-geometry', geometry);
    }
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Finish area' }));
    expect(screen.getByRole('button', { name: 'Select Area 01' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('0 vertices');
  });

  it('suspends the outline when changing tools or closing its menu', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
    const map = screen.getByTestId('map-canvas');
    const geometry = map.dataset.layerGeometry;

    for (const tool of ['Select (V)', 'Place (P)', 'Route (R)', 'Close Area menu']) {
      await user.click(screen.getByRole('button', { name: tool }));
      expect(map).not.toHaveAttribute('data-layer-state', expect.stringContaining('shape-draft'));
      await user.click(screen.getByRole('button', { name: 'Area (S)' }));
      expect(screen.getByRole('tab', { name: 'Draw custom area' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('2 vertices');
      expect(map).toHaveAttribute('data-layer-geometry', geometry);
    }
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('2 vertices');
    expect(map).toHaveAttribute('data-layer-geometry', geometry);
    await user.click(screen.getByRole('button', { name: 'Undo last area point' }));
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('1 vertex');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('does not discard a suspended outline when closing another area source', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('tab', { name: 'Find administrative area' }));
    await user.click(screen.getByRole('button', { name: 'Cancel area' }));
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('1 vertex');
  });

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
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('0 vertices');
  });

  it('rejects duplicate map vertices without enabling Finish', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);

    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    const repeatedPoint = screen.getByRole('button', { name: 'Map route point 1' });
    await user.click(repeatedPoint);
    await user.click(repeatedPoint);
    await user.click(repeatedPoint);

    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('1 vertex');
    expect(screen.getByRole('alert')).toHaveTextContent('That area point is already present.');
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
    await user.clear(screen.getByRole('textbox', { name: 'New area point longitude' }));
    await user.keyboard('18.765432');
    await user.click(screen.getByRole('button', { name: 'Select (V)' }));
    const opened = createInitialProjectDocument();
    opened.id = 'opened-project';
    opened.title = 'Opened project';
    const input = container.querySelector<HTMLInputElement>('input[accept^=".printmap.json"]');
    if (!input) throw new Error('Project open input unavailable');

    fireEvent.change(input, {
      target: { files: [new File([JSON.stringify(opened)], 'opened.printmap.json', { type: 'application/json' })] },
    });
    await user.click(await screen.findByRole('button', { name: 'Discard unfinished work and open' }));

    expect(await screen.findByRole('button', { name: 'Opened project' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Area drawing status' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Place (P)' }));
    await user.click(screen.getByRole('button', { name: 'Select (V)' }));
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('0 vertices');
    expect(screen.getByRole('textbox', { name: 'New area point longitude' })).toHaveValue(String(opened.camera.center[0]));
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('1 vertex');
  });

});

describe('keyboard polygon authoring', () => {
  it('creates one undoable polygon from keyboard-entered coordinate pairs', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    screen.getByRole('button', { name: 'Area (S)' }).focus();
    await user.keyboard('{Enter}');
    screen.getByRole('tab', { name: 'Find administrative area' }).focus();
    await user.keyboard('{ArrowRight}');
    await enterAreaPoint(user, '16.35', '48.2');
    await enterAreaPoint(user, '16.38', '48.2');
    expect(screen.getByRole('button', { name: 'Finish area' })).toBeDisabled();
    await enterAreaPoint(user, '16.38', '48.22');
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('3 vertices');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    screen.getByRole('button', { name: 'Finish area' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Select Area 01' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('map-canvas').dataset.layerGeometry).toContain('[[[16.35,48.2],[16.38,48.2],[16.38,48.22],[16.35,48.2]]]');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Select Area 01' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByRole('button', { name: 'Select Area 01' })).toBeInTheDocument();
  });

  it('keeps invalid coordinate text editable and supports duplicate correction, undo and explicit discard', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    const longitude = screen.getByRole('textbox', { name: 'New area point longitude' });
    const latitude = screen.getByRole('textbox', { name: 'New area point latitude' });
    await user.clear(longitude);
    await user.keyboard('{Enter}');
    expect(longitude).toHaveValue('');
    expect(longitude).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Longitude must be between -180 and 180.');
    await enterAreaPoint(user, '181', '48.2');
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('0 vertices');
    await user.clear(longitude);
    await user.keyboard('16.35');
    await user.clear(latitude);
    await user.keyboard('86{Enter}');
    expect(latitude).toHaveFocus();
    expect(latitude).toHaveValue('86');
    expect(latitude).toHaveAttribute('aria-invalid', 'true');
    await enterAreaPoint(user, '16.35', '48.2');
    await enterAreaPoint(user, '16.35', '48.2');
    expect(screen.getByRole('alert')).toHaveTextContent('That area point is already present.');
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('1 vertex');
    await enterAreaPoint(user, '16.38', '48.2');
    await user.click(screen.getByRole('button', { name: 'Undo last area point' }));
    expect(longitude).toHaveValue('16.38');
    expect(latitude).toHaveValue('48.2');
    await enterAreaPoint(user, '16.38', '48.21');
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('2 vertices');
    await user.click(screen.getByRole('button', { name: 'Cancel area' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('0 vertices');
  });

  it('keeps coordinate entry expanded on small screens and retains typed values across settings and sources', async () => {
    stubMobileViewport();
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    screen.getByRole('tab', { name: 'Find administrative area' }).focus();
    await user.keyboard('{ArrowRight}');
    const panel = screen.getByRole('button', { name: 'Finish area' }).closest('.shape-authoring-panel');
    expect(panel).toHaveAttribute('data-settings-expanded', 'true');
    await enterAreaPoint(user, '16.35', '48.2');
    await enterAreaPoint(user, '16.38', '48.2');
    expect(panel).toHaveAttribute('data-settings-expanded', 'true');
    await user.clear(screen.getByRole('textbox', { name: 'New area point longitude' }));
    await user.keyboard('16.37999');
    await user.click(screen.getByRole('button', { name: 'Hide area settings' }));
    expect(screen.getByRole('button', { name: 'Show area settings' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('textbox', { name: 'New area point longitude' })).toHaveValue('16.37999');
    await user.click(screen.getByRole('tab', { name: 'Travel time' }));
    screen.getByRole('tab', { name: 'Travel time' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('textbox', { name: 'New area point longitude' })).toHaveValue('16.37999');
    await user.click(screen.getByRole('button', { name: 'Map shape point 3' }));
    expect(panel).toHaveAttribute('data-settings-expanded', 'false');
    expect(screen.getByRole('status', { name: 'Area drawing status' })).toHaveTextContent('3 vertices');
  });
});
