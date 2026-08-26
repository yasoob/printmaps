import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createInitialProjectDocument } from '../../../src/domain/project';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

const pointGeoJson = JSON.stringify({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { name: 'Slow café' },
    geometry: { type: 'Point', coordinates: [16.37, 48.21] },
  }],
});

const routeGeoJson = JSON.stringify({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { name: 'Stale replacement' },
    geometry: { type: 'LineString', coordinates: [[16, 48], [16.1, 48.1]] },
  }],
});

function fileWithText(name: string, text: string | Promise<string>, type: string) {
  const file = new File([], name, { type });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(text) });
  return file;
}

function fileInputs(container: HTMLElement) {
  const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
  if (inputs.length !== 2) throw new Error(`Expected two file inputs, received ${inputs.length}.`);
  return { openInput: inputs[0], importInput: inputs[1] };
}

function reviewFiles() {
  return [
    fileWithText('first.geojson', pointGeoJson, 'application/geo+json'),
    fileWithText('second.geojson', pointGeoJson, 'application/geo+json'),
  ];
}

describe('GeoJSON import document isolation', () => {
  it('supports every import-review dismissal control without changing history', async () => {
    const user = userEvent.setup();
    const { container } = render(<App autosaveRepository={null} />);
    const { importInput } = fileInputs(container);

    const openReview = async () => {
      fireEvent.change(importInput, { target: { files: reviewFiles() } });
      return screen.findByRole('dialog', { name: 'Import map data' });
    };

    await openReview();
    await user.click(screen.getByRole('button', { name: 'Close map data import' }));
    expect(screen.queryByRole('dialog', { name: 'Import map data' })).not.toBeInTheDocument();

    await openReview();
    await user.click(screen.getByRole('button', { name: 'Cancel map data import' }));
    expect(screen.queryByRole('dialog', { name: 'Import map data' })).not.toBeInTheDocument();

    await openReview();
    await user.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(screen.queryByRole('dialog', { name: 'Import map data' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('contains an invalid multi-file batch until replacement succeeds', async () => {
    const user = userEvent.setup();
    const { container } = render(<App autosaveRepository={null} />);
    const { importInput } = fileInputs(container);
    fireEvent.change(importInput, {
      target: {
        files: [
          fileWithText('unsupported.txt', '{}', 'text/plain'),
          fileWithText('point.geojson', pointGeoJson, 'application/geo+json'),
        ],
      },
    });

    const dialog = await screen.findByRole('dialog', { name: 'Import map data' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('unsupported.txt');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    fireEvent.change(importInput, {
      target: { files: [fileWithText('point.geojson', pointGeoJson, 'application/geo+json')] },
    });
    await user.click(await screen.findByRole('button', { name: 'Import 1 files' }));

    expect(await screen.findByRole('button', { name: 'Select Slow café' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('keeps the concurrency guard active until a cancelled batch finishes reading', async () => {
    const user = userEvent.setup();
    let finishReads: ((text: string) => void) | undefined;
    const slowText = new Promise<string>((resolve) => { finishReads = resolve; });
    const { container } = render(<App autosaveRepository={null} />);
    const { importInput } = fileInputs(container);
    fireEvent.change(importInput, {
      target: {
        files: [
          fileWithText('first.geojson', slowText, 'application/geo+json'),
          fileWithText('second.geojson', slowText, 'application/geo+json'),
        ],
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Close map data import' }));
    expect(importInput).toBeDisabled();
    await act(async () => { finishReads?.(pointGeoJson); });
    expect(importInput).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('does not steal focus when the user moves to another control during a pending read', async () => {
    let finishImport: ((text: string) => void) | undefined;
    const slowText = new Promise<string>((resolve) => { finishImport = resolve; });
    const { container } = render(<App autosaveRepository={null} />);
    const { importInput } = fileInputs(container);
    fireEvent.change(importInput, {
      target: { files: [fileWithText('slow.geojson', slowText, 'application/geo+json')] },
    });
    const projectTitle = screen.getByRole('button', { name: 'Vienna field guide' });
    projectTitle.focus();

    await act(async () => { finishImport?.(pointGeoJson); });

    expect(projectTitle).toHaveFocus();
  });

  it('rejects a single-file result when the canonical document changed during its read', async () => {
    let finishImport: ((text: string) => void) | undefined;
    const slowText = new Promise<string>((resolve) => { finishImport = resolve; });
    const { container } = render(<App autosaveRepository={null} />);
    const { importInput } = fileInputs(container);
    fireEvent.change(importInput, {
      target: { files: [fileWithText('slow.geojson', slowText, 'application/geo+json')] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Portrait' }));
    await act(async () => { finishImport?.(pointGeoJson); });

    expect(screen.queryByRole('button', { name: 'Select Slow café' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });
});

describe('reviewed import replacement isolation', () => {
  it('keeps global review reselection in add mode after a replacement chooser is cancelled', async () => {
    const user = userEvent.setup();
    const { container } = render(<App autosaveRepository={null} />);
    const { importInput } = fileInputs(container);
    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
    await user.click(screen.getByRole('button', { name: 'Layer menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Replace layer data' }));

    fireEvent.drop(window, {
      dataTransfer: { files: reviewFiles(), types: ['Files'] },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Import map data' });
    await user.click(within(dialog).getByRole('button', { name: 'Replace files' }));
    fireEvent.change(importInput, {
      target: { files: [fileWithText('route.geojson', routeGeoJson, 'application/geo+json')] },
    });

    expect(await within(dialog).findByRole('button', { name: 'Import 1 files' })).toBeInTheDocument();
    expect(dialog).toHaveAccessibleName('Import map data');
    expect(screen.queryByRole('button', { name: 'Replace Route 01' })).not.toBeInTheDocument();
  });

  it('rejects reviewed replacement geometry after its source document changes', async () => {
    const user = userEvent.setup();
    const { container } = render(<App autosaveRepository={null} />);
    const { importInput } = fileInputs(container);
    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
    const layerName = screen.getByRole('textbox', { name: 'Layer name' });
    await user.click(screen.getByRole('button', { name: /Advanced/ }));
    const routeLongitude = screen.getByRole('textbox', { name: 'Route vertex longitude' });
    await user.click(screen.getByRole('button', { name: 'Layer menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Replace layer data' }));
    fireEvent.change(importInput, {
      target: { files: [fileWithText('replacement.geojson', routeGeoJson, 'application/geo+json')] },
    });
    const commit = await screen.findByRole('button', { name: 'Replace Route 01' });

    fireEvent.change(layerName, { target: { value: 'Route changed during review' } });
    fireEvent.blur(layerName);
    await user.click(commit);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The project changed before this data could be applied. Choose the replacement again.',
    );
    expect(layerName).toHaveValue('Route changed during review');
    expect(routeLongitude).toHaveValue('16.326');
    expect(screen.getByRole('dialog', { name: 'Replace Route 01 data' })).toBeInTheDocument();
  });
});

describe('GeoJSON import document isolation', () => {
  it('does not finish a pending import into a document opened later', async () => {
    let finishImport: ((text: string) => void) | undefined;
    const slowText = new Promise<string>((resolve) => { finishImport = resolve; });
    const { container } = render(<App autosaveRepository={null} />);
    const { openInput, importInput } = fileInputs(container);

    fireEvent.change(importInput, {
      target: { files: [fileWithText('slow.geojson', slowText, 'application/geo+json')] },
    });
    expect(importInput).toBeDisabled();

    const opened = createInitialProjectDocument();
    opened.id = 'opened-project';
    opened.title = 'Opened while importing';
    fireEvent.change(openInput, {
      target: {
        files: [fileWithText(
          'opened.printmap.json',
          JSON.stringify(opened),
          'application/json',
        )],
      },
    });
    expect(await screen.findByRole('button', { name: 'Opened while importing' })).toBeInTheDocument();
    expect(importInput).toBeDisabled();

    await act(async () => { finishImport?.(pointGeoJson); });

    expect(screen.queryByRole('button', { name: 'Select Slow café' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Map data import status' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(importInput).toBeEnabled();
  });

  it('clears a completed import status when a document is opened later', async () => {
    const { container } = render(<App autosaveRepository={null} />);
    const { openInput, importInput } = fileInputs(container);

    fireEvent.change(importInput, {
      target: { files: [fileWithText('point.geojson', pointGeoJson, 'application/geo+json')] },
    });
    expect(await screen.findByRole('status', { name: 'Map data import status' }))
      .toHaveTextContent('Imported 1 GeoJSON layer');

    const opened = createInitialProjectDocument();
    opened.title = 'Opened after import';
    fireEvent.change(openInput, {
      target: {
        files: [fileWithText(
          'opened.printmap.json',
          JSON.stringify(opened),
          'application/json',
        )],
      },
    });
    expect(await screen.findByRole('button', { name: 'Opened after import' })).toBeInTheDocument();

    expect(screen.queryByRole('status', { name: 'Map data import status' })).not.toBeInTheDocument();
  });
});
