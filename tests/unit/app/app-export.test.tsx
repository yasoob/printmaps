import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import type { PreviewPng } from '../../../src/export/previewPng';
import { exportMocks } from './exportMocks';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

const ONE_PIXEL_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
  (character) => character.codePointAt(0) ?? 0,
);

async function verifyLayeredSvgDownload() {
  const user = userEvent.setup();
  const source = document.createElement('canvas');
  source.width = 1;
  source.height = 1;
  exportMocks.exporter = vi.fn().mockResolvedValue({
    blob: new Blob([ONE_PIXEL_PNG], { type: 'image/png' }),
    width: 1,
    height: 1,
    surface: source,
    projectToFrame: ([longitude, latitude]: readonly [number, number]) => ({
      x: (longitude - 16.28) / 0.2,
      y: (48.26 - latitude) / 0.12,
    }),
  });
  let downloadedBlob: Blob | undefined;
  let downloadName = '';
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    if (!(blob instanceof Blob)) throw new TypeError('Expected a Blob download');
    downloadedBlob = blob;
    return 'blob:layered-svg';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function captureDownload(this: HTMLAnchorElement) {
    downloadName = this.download;
  });
  render(<App />);

  await user.click(screen.getByRole('button', { name: 'Export' }));
  const dialog = screen.getByRole('dialog', { name: 'Export map' });
  await user.click(within(dialog).getByRole('radio', { name: /Layered SVG/ }));
  await user.click(screen.getByRole('button', { name: 'Download layered SVG' }));

  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Download started for layered SVG'));
  expect(exportMocks.exporter).toHaveBeenCalledWith({
    content: 'basemap',
    signal: expect.any(AbortSignal),
  });
  expect(downloadName).toBe('vienna-field-guide.layered.svg');
  expect(downloadedBlob?.type).toBe('image/svg+xml');
  const svgText = await downloadedBlob?.text();
  expect(svgText).toContain('width="297mm" height="210mm"');
  expect(svgText).toContain('data-scene-role="raster-basemap"');
  expect(svgText).toContain('data-layer-name="Route 01"');
  expect(svgText).toContain('data-layer-name="Coffee stop"');
  expect(svgText).toContain('data-layer-name="City center"');
  expect(dialog).toHaveTextContent('raster basemap');
  expect(dialog).toHaveTextContent('vector overlays');
  expect(source).toMatchObject({ width: 0, height: 0 });
}

async function verifyLayeredMapCaptureCancellation() {
  const user = userEvent.setup();
  let receivedSignal: AbortSignal | undefined;
  exportMocks.exporter = vi.fn((options) => new Promise<PreviewPng>((_resolve, reject) => {
    receivedSignal = (options as { signal?: AbortSignal } | undefined)?.signal;
    receivedSignal?.addEventListener('abort', () => reject(receivedSignal?.reason), { once: true });
  }));
  const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<App />);

  await user.click(screen.getByRole('button', { name: 'Export' }));
  await user.click(screen.getByRole('radio', { name: /Layered SVG/ }));
  await user.click(screen.getByRole('button', { name: 'Download layered SVG' }));

  expect(receivedSignal).toBeInstanceOf(AbortSignal);
  await user.click(screen.getByRole('button', { name: 'Cancel export' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Export cancelled'));
  expect(downloadClick).not.toHaveBeenCalled();
}

async function verifyPdfDownload() {
  const user = userEvent.setup();
  const source = document.createElement('canvas');
  source.width = 2;
  source.height = 1;
  const renderPrintTile = vi.fn(({ region }: { region: { width: number; height: number } }) => {
    const tile = document.createElement('canvas');
    tile.width = region.width;
    tile.height = region.height;
    return Promise.resolve(tile);
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4).fill(255),
      width,
      height,
    })),
  } as unknown as CanvasRenderingContext2D);
  const captureExport = vi.fn();
  captureExport.mockResolvedValue({
    blob: new Blob([Uint8Array.from([0xFF, 0xD8, 0xFF, 0xD9])], { type: 'image/jpeg' }),
    width: 2,
    height: 1,
    surface: source,
    projectToFrame: ([longitude, latitude]: readonly [number, number]) => ({
      x: (longitude - 16.28) / 0.2,
      y: (48.26 - latitude) / 0.12,
    }),
  });
  const exporter = Object.assign(captureExport, {
    createPrintTileRenderer: vi.fn(() => renderPrintTile),
  });
  exportMocks.exporter = exporter;
  let downloadedBlob: Blob | undefined;
  let downloadName = '';
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    if (!(blob instanceof Blob)) throw new TypeError('Expected a Blob download');
    downloadedBlob = blob;
    return 'blob:print-pdf';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function captureDownload(this: HTMLAnchorElement) {
    downloadName = this.download;
  });
  render(<App />);

  for (const name of ['Page width', 'Page height']) {
    const field = screen.getByRole('spinbutton', { name });
    await user.clear(field);
    await user.type(field, '25.4');
    await user.tab();
  }
  await user.click(screen.getByRole('button', { name: 'Export' }));
  const dialog = screen.getByRole('dialog', { name: 'Export map' });
  await user.click(within(dialog).getByRole('radio', { name: /PDF/ }));
  await user.click(screen.getByRole('button', { name: 'Download PDF' }));

  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Download started for PDF'));
  expect(exporter).toHaveBeenCalledWith({
    content: 'basemap',
    signal: expect.any(AbortSignal),
  });
  expect(exporter.createPrintTileRenderer).toHaveBeenCalledWith(expect.objectContaining({
    content: 'basemap',
    output: { width: 300, height: 300 },
  }));
  expect(renderPrintTile).toHaveBeenCalledOnce();
  expect(downloadName).toBe('vienna-field-guide.pdf');
  expect(downloadedBlob?.type).toBe('application/pdf');
  const pdfText = new TextDecoder('latin1').decode(await downloadedBlob?.arrayBuffer());
  expect(pdfText.startsWith('%PDF-1.7')).toBe(true);
  expect(pdfText).toContain('/MediaBox [0 0 72 72]');
  expect(pdfText).toContain('/Subtype /Image');
  expect(pdfText).toContain('/FlateDecode');
  expect(pdfText).toContain('/Predictor 15');
  expect(pdfText).not.toContain('/DCTDecode');
  expect(pdfText).toContain('Route 01');
  expect(pdfText).toContain('Coffee stop');
  expect(pdfText).toContain('City center');
  expect(pdfText).toContain('/Type /OCG');
  expect(pdfText).toContain(String.raw`(OpenFreeMap \267 OpenMapTiles \267 \251 OpenStreetMap contributors) Tj`);
  expect(dialog).toHaveTextContent('lossless basemap');
  expect(dialog).toHaveTextContent('vector overlays');
  expect(source).toMatchObject({ width: 0, height: 0 });
}

async function verifyPdfCancellation() {
  const user = userEvent.setup();
  let receivedSignal: AbortSignal | undefined;
  const source = document.createElement('canvas');
  source.width = 2;
  source.height = 1;
  const renderPrintTile = vi.fn(({ signal }: { signal?: AbortSignal }) => new Promise<HTMLCanvasElement>((_resolve, reject) => {
    receivedSignal = signal;
    signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
  }));
  exportMocks.exporter = Object.assign(vi.fn().mockResolvedValue({
    blob: new Blob(['png'], { type: 'image/png' }),
    width: 2,
    height: 1,
    surface: source,
    projectToFrame: () => ({ x: 0.5, y: 0.5 }),
  }), {
    createPrintTileRenderer: vi.fn(() => renderPrintTile),
  });
  const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<App />);

  await user.click(screen.getByRole('button', { name: 'Export' }));
  await user.click(screen.getByRole('radio', { name: /PDF/ }));
  await user.click(screen.getByRole('button', { name: 'Download PDF' }));
  const cancel = await screen.findByRole('button', { name: 'Cancel export' });
  await waitFor(() => expect(receivedSignal).toBeInstanceOf(AbortSignal));
  await user.click(cancel);

  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Export cancelled'));
  expect(downloadClick).not.toHaveBeenCalled();
  expect(source).toMatchObject({ width: 0, height: 0 });
}

async function verifyNativeTileProgressCancellation() {
  const user = userEvent.setup();
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  const encode = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    callback(new Blob(['png'], { type: 'image/png' }));
  });
  const renderPrintTile = vi.fn(({ region }: { region: { width: number; height: number } }) => {
    const tile = document.createElement('canvas');
    tile.width = region.width;
    tile.height = region.height;
    return Promise.resolve(tile);
  });
  const exporter = Object.assign(vi.fn(), {
    createPrintTileRenderer: vi.fn(() => renderPrintTile),
  });
  exportMocks.exporter = exporter;
  const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<App />);

  const width = screen.getByRole('spinbutton', { name: 'Page width' });
  await user.clear(width);
  await user.type(width, '600');
  await user.tab();

  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  const dialog = screen.getByRole('dialog', { name: 'Export map' });
  expect(dialog).toHaveTextContent('7087 × 2480 px');

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }));
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
  });

  const cancel = screen.getByRole('button', { name: 'Cancel export' });
  expect(screen.getByRole('status')).toHaveTextContent('1/2 regions (50%)');
  expect(cancel).toHaveFocus();
  fireEvent.click(cancel);
  expect(screen.getByRole('status')).toHaveTextContent('Cancelling export');

  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });

  expect(screen.getByRole('status')).toHaveTextContent('Export cancelled');
  expect(renderPrintTile).toHaveBeenCalledOnce();
  expect(exporter).not.toHaveBeenCalled();
  expect(drawImage).toHaveBeenCalledOnce();
  expect(encode).not.toHaveBeenCalled();
  expect(downloadClick).not.toHaveBeenCalled();
}

async function verifyPngMetadataDisclosure() {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: 'Export' }));
  const dialog = screen.getByRole('dialog', { name: 'Export map' });
  await user.click(within(dialog).getByRole('button', { name: 'Technical details' }));

  expect(dialog).toHaveTextContent('PNG embeds 300 DPI physical-resolution metadata');
  expect(dialog).not.toHaveTextContent('physical-resolution metadata is not embedded');
}

describe('editor export', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens Export and reports when the live preview is unavailable', async () => {
    const user = userEvent.setup();
    render(<App />);

    const trigger = screen.getByRole('button', { name: 'Export' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Export map' });
    const download = screen.getByRole('button', { name: 'Download PNG' });
    expect(dialog).toBeInTheDocument();
    await waitFor(() => expect(download).toHaveFocus());
    expect(dialog).toHaveTextContent('3508 × 2480 px — 300 DPI pixel target');
    expect(dialog).toHaveTextContent('PNG embeds 300 DPI physical-resolution metadata');
    expect(dialog).toHaveTextContent('renders bounded map regions at their target pixel dimensions');
    expect(dialog).not.toHaveTextContent('resamples the current browser render');

    await user.click(download);
    expect(within(dialog).getByRole('alert')).toHaveTextContent('live map preview is not ready');
    await user.keyboard('{Escape}');
    expect(dialog).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('discloses embedded 300 DPI metadata for PNG output', verifyPngMetadataDisclosure);

  it('presents PNG as one file without exposing internal tile delivery choices', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: vi.fn() });
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Export' }));

    expect(screen.queryByRole('radiogroup', { name: 'Raster output delivery' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
    expect(screen.getByRole('dialog', { name: 'Export map' })).not.toHaveTextContent('tile package');
  });

  it('chooses one export format and progressively discloses technical details', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export map' });
    const formats = within(dialog).getByRole('radiogroup', { name: 'Export format' });

    expect(within(formats).getByRole('radio', { name: /PNG/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(formats).getByRole('radio', { name: /Layered SVG/ })).toHaveAttribute('aria-checked', 'false');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Download PNG' })).toHaveFocus());
    expect(within(dialog).getByText('PNG embeds 300 DPI physical-resolution metadata.')).not.toBeVisible();

    await user.click(within(formats).getByRole('radio', { name: /Layered SVG/ }));
    expect(within(formats).getByRole('radio', { name: /Layered SVG/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getByRole('button', { name: 'Download layered SVG' })).toBeEnabled();
    expect(dialog).toHaveTextContent('297 × 210 mm');

    const technicalDetails = within(dialog).getByRole('button', { name: 'Technical details' });
    expect(technicalDetails).toHaveAttribute('aria-expanded', 'false');
    await user.click(technicalDetails);
    expect(technicalDetails).toHaveAttribute('aria-expanded', 'true');
    expect(dialog).toHaveTextContent('raster basemap');
    expect(dialog).toHaveTextContent('named vector overlays');
  });

  it('downloads a layered SVG with an embedded raster basemap and named vector groups', verifyLayeredSvgDownload);

  it('propagates Cancel to an in-progress layered map capture', verifyLayeredMapCaptureCancellation);

  it('downloads an exact-page PDF with a raster basemap and named vector overlays', verifyPdfDownload);

  it('propagates Cancel while the native PDF basemap is rendering', verifyPdfCancellation);

  it('blocks an unusably small PNG before capture', async () => {
    const user = userEvent.setup();
    render(<App />);

    const width = screen.getByRole('spinbutton', { name: 'Page width' });
    await user.clear(width);
    await user.type(width, '1');
    await user.tab();
    const height = screen.getByRole('spinbutton', { name: 'Page height' });
    await user.clear(height);
    await user.type(height, '1');
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Export' }));

    const dialog = screen.getByRole('dialog', { name: 'Export map' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('too small');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Reduce the page dimensions before retrying');
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
  });

  it('focuses Cancel when unsafe preflight disables Download PNG', async () => {
    const user = userEvent.setup();
    render(<App />);

    const width = screen.getByRole('spinbutton', { name: 'Page width' });
    await user.clear(width);
    await user.type(width, '1');
    await user.tab();
    const height = screen.getByRole('spinbutton', { name: 'Page height' });
    await user.clear(height);
    await user.type(height, '1');
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Export' }));

    const dialog = screen.getByRole('dialog', { name: 'Export map' });
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('keeps focus contained and cancels an in-progress print-size export', async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    let finishExport: ((result: HTMLCanvasElement) => void) | undefined;
    const renderPrintTile = vi.fn(() => new Promise<HTMLCanvasElement>((resolve) => { finishExport = resolve; }));
    exportMocks.exporter = Object.assign(vi.fn(), {
      createPrintTileRenderer: vi.fn(() => renderPrintTile),
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export map' });
    await user.click(screen.getByRole('button', { name: 'Download PNG' }));

    const cancel = await screen.findByRole('button', { name: 'Cancel export' });
    expect(cancel).toHaveFocus();
    expect(document.querySelector('.export-dialog-backdrop')?.tagName).toBe('DIV');
    await user.keyboard('{Tab}');
    await waitFor(() => expect(cancel).toHaveFocus());
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await waitFor(() => expect(cancel).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
    expect(cancel).toHaveFocus();

    await user.click(cancel);
    expect(screen.getByRole('status')).toHaveTextContent('Cancelling export');
    const surface = document.createElement('canvas');
    surface.width = 3508;
    surface.height = 2480;
    finishExport?.(surface);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Export cancelled'));
    expect(downloadClick).not.toHaveBeenCalled();
  });

  it('releases the composed output when download initiation fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 80 })),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob([ONE_PIXEL_PNG], { type: 'image/png' }));
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('Download initiation failed.');
    });
    const created: HTMLCanvasElement[] = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (element instanceof HTMLCanvasElement) created.push(element);
      return element;
    });
    const renderPrintTile = vi.fn(({ region }: { region: { width: number; height: number } }) => {
      const tile = document.createElement('canvas');
      tile.width = region.width;
      tile.height = region.height;
      return Promise.resolve(tile);
    });
    exportMocks.exporter = Object.assign(vi.fn(), {
      createPrintTileRenderer: vi.fn(() => renderPrintTile),
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export map' });
    await user.click(screen.getByRole('button', { name: 'Download PNG' }));

    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Download initiation failed'));
    expect(screen.getByRole('status')).toHaveTextContent('Export failed');
    expect(created.length).toBeGreaterThan(0);
    expect(created.every(({ width, height }) => width === 0 && height === 0)).toBe(true);
  });

  it('paints tile progress and accepts Cancel between tile tasks', verifyNativeTileProgressCancellation);
});
