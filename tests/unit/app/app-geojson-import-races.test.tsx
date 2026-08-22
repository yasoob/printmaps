import { act, fireEvent, render, screen } from '@testing-library/react';
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

describe('GeoJSON import document isolation', () => {
  it('does not finish a pending import into a document opened later', async () => {
    let finishImport: ((text: string) => void) | undefined;
    const slowText = new Promise<string>((resolve) => { finishImport = resolve; });
    const { container } = render(<App autosaveRepository={null} />);
    const { openInput, importInput } = fileInputs(container);

    fireEvent.change(importInput, {
      target: { files: [fileWithText('slow.geojson', slowText, 'application/geo+json')] },
    });
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();

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

    await act(async () => { finishImport?.(pointGeoJson); });

    expect(screen.queryByRole('button', { name: 'Select Slow café' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'GeoJSON import status' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('clears a completed import status when a document is opened later', async () => {
    const { container } = render(<App autosaveRepository={null} />);
    const { openInput, importInput } = fileInputs(container);

    fireEvent.change(importInput, {
      target: { files: [fileWithText('point.geojson', pointGeoJson, 'application/geo+json')] },
    });
    expect(await screen.findByRole('status', { name: 'GeoJSON import status' }))
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

    expect(screen.queryByRole('status', { name: 'GeoJSON import status' })).not.toBeInTheDocument();
  });
});
