import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { exportMocks } from './exportMocks';

const layeredPsdMocks = vi.hoisted(() => ({
  create: vi.fn(),
  download: vi.fn(),
}));

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));
vi.mock('../../../src/export/layeredPsd', () => ({
  createLayeredPsd: layeredPsdMocks.create,
  startLayeredPsdDownload: layeredPsdMocks.download,
}));

const ONE_PIXEL_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
  (character) => character.codePointAt(0) ?? 0,
);

describe('editor layered PSD export', () => {
  beforeEach(() => {
    layeredPsdMocks.create.mockReset();
    layeredPsdMocks.create.mockResolvedValue(new Blob(['psd'], { type: 'image/vnd.adobe.photoshop' }));
    layeredPsdMocks.download.mockReset();
  });

  afterEach(() => {
    exportMocks.exporter = null;
    vi.restoreAllMocks();
  });

  it('downloads native basemap regions and named SVG Smart Objects', async () => {
    const user = userEvent.setup();
    const source = document.createElement('canvas');
    source.width = 1;
    source.height = 1;
    const renderPrintTile = vi.fn();
    const exporter = Object.assign(vi.fn().mockResolvedValue({
      blob: new Blob([ONE_PIXEL_PNG], { type: 'image/png' }),
      width: 1,
      height: 1,
      surface: source,
      projectToFrame: () => ({ x: 0.5, y: 0.5 }),
    }), {
      createPrintTileRenderer: vi.fn(() => renderPrintTile),
    });
    exportMocks.exporter = exporter;
    render(<App />);

    for (const name of ['Page width', 'Page height']) {
      const field = screen.getByRole('spinbutton', { name });
      await user.clear(field);
      await user.type(field, '25.4');
      await user.tab();
    }
    await user.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export map' });
    await user.click(within(dialog).getByRole('radio', { name: /Layered PSD/ }));
    expect(dialog).toHaveTextContent('300 × 300 px — 300 DPI');
    await user.click(within(dialog).getByRole('button', { name: 'Download layered PSD' }));

    await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('Download started for layered PSD'));
    expect(exporter).toHaveBeenCalledWith({
      content: 'basemap',
      signal: expect.any(AbortSignal),
    });
    expect(exporter.createPrintTileRenderer).toHaveBeenCalledWith(expect.objectContaining({
      content: 'basemap',
      output: { width: 300, height: 300 },
    }));
    expect(layeredPsdMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Vienna field guide' }),
      expect.objectContaining({ surface: source }),
      expect.objectContaining({ effectiveDpi: 300, preflight: expect.objectContaining({ format: 'psd' }) }),
    );
    expect(layeredPsdMocks.download).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringContaining('vienna-field-guide'),
    );
    expect(source).toMatchObject({ width: 0, height: 0 });
  });

  it('disables cancellation during synchronous final PSD serialization', async () => {
    const user = userEvent.setup();
    const source = document.createElement('canvas');
    source.width = 1;
    source.height = 1;
    exportMocks.exporter = Object.assign(vi.fn().mockResolvedValue({
      blob: new Blob([ONE_PIXEL_PNG], { type: 'image/png' }),
      width: 1,
      height: 1,
      surface: source,
      projectToFrame: () => ({ x: 0.5, y: 0.5 }),
    }), {
      createPrintTileRenderer: vi.fn(() => vi.fn()),
    });
    let finishPackaging: ((blob: Blob) => void) | undefined;
    layeredPsdMocks.create.mockImplementation((
      _document: unknown,
      _capture: unknown,
      options: { onStage?: (stage: 'packaging') => void },
    ) => {
      options.onStage?.('packaging');
      return new Promise<Blob>((resolve) => {
        finishPackaging = resolve;
      });
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export map' });
    await user.click(within(dialog).getByRole('radio', { name: /Layered PSD/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Download layered PSD' }));

    const finishing = await within(dialog).findByRole('button', { name: 'Finishing export…' });
    expect(finishing).toBeDisabled();
    expect(dialog).toHaveFocus();
    expect(within(dialog).getByRole('status')).toHaveTextContent('Packaging Photoshop layers');

    await act(async () => {
      finishPackaging?.(new Blob(['psd'], { type: 'image/vnd.adobe.photoshop' }));
    });
    await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('Download started for layered PSD'));
  });
});
