import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import type { PreviewPng } from '../../../src/export/previewPng';
import { exportMocks } from './exportMocks';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

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
    expect(download).toHaveFocus();
    expect(dialog).toHaveTextContent('3508 × 2480 px — 300 DPI pixel target');
    expect(dialog).toHaveTextContent('PNG physical-resolution metadata is not embedded');
    expect(dialog).toHaveTextContent('resamples the current browser render');

    await user.click(download);
    expect(screen.getByRole('alert')).toHaveTextContent('live map preview is not ready');
    await user.keyboard('{Escape}');
    expect(dialog).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('blocks an unsafe print-size allocation before capture', async () => {
    const user = userEvent.setup();
    render(<App />);

    const width = screen.getByRole('textbox', { name: 'Page width' });
    await user.clear(width);
    await user.type(width, '1330');
    await user.tab();
    const height = screen.getByRole('textbox', { name: 'Page height' });
    await user.clear(height);
    await user.type(height, '1330');
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Export' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Estimated peak memory');
    expect(screen.getByRole('alert')).toHaveTextContent('Reduce the page dimensions before retrying');
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
  });

  it('focuses Cancel when unsafe preflight disables Download PNG', async () => {
    const user = userEvent.setup();
    render(<App />);

    const width = screen.getByRole('textbox', { name: 'Page width' });
    await user.clear(width);
    await user.type(width, '1330');
    await user.tab();
    const height = screen.getByRole('textbox', { name: 'Page height' });
    await user.clear(height);
    await user.type(height, '1330');
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Export' }));

    const dialog = screen.getByRole('dialog', { name: 'Export map' });
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('keeps focus contained and cancels an in-progress print-size export', async () => {
    const user = userEvent.setup();
    let finishExport: ((result: PreviewPng) => void) | undefined;
    exportMocks.exporter = vi.fn(() => new Promise<PreviewPng>((resolve) => { finishExport = resolve; }));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export map' });
    await user.click(screen.getByRole('button', { name: 'Download PNG' }));

    const cancel = await screen.findByRole('button', { name: 'Cancel export' });
    expect(cancel).toHaveFocus();
    expect(document.querySelector('.export-backdrop')?.tagName).toBe('DIV');
    await user.keyboard('{Tab}');
    expect(cancel).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(cancel).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
    expect(cancel).toHaveFocus();

    await user.click(cancel);
    expect(screen.getByRole('status')).toHaveTextContent('Cancelling export');
    const surface = document.createElement('canvas');
    surface.width = 100;
    surface.height = 80;
    finishExport?.({ blob: new Blob(['png']), width: 100, height: 80, surface });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Export cancelled'));
    expect(downloadClick).not.toHaveBeenCalled();
  });

  it('releases the composed output when download initiation fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['png'], { type: 'image/png' }));
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('Download initiation failed.');
    });
    const source = document.createElement('canvas');
    source.width = 100;
    source.height = 80;
    exportMocks.exporter = vi.fn().mockResolvedValue({
      blob: new Blob(['source'], { type: 'image/png' }),
      width: 100,
      height: 80,
      surface: source,
    });
    const created: HTMLCanvasElement[] = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (element instanceof HTMLCanvasElement) created.push(element);
      return element;
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: 'Download PNG' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Download initiation failed'));
    expect(screen.getByRole('status')).toHaveTextContent('Export failed');
    expect(created.length).toBeGreaterThan(0);
    expect(created.every(({ width, height }) => width === 0 && height === 0)).toBe(true);
    expect(source).toMatchObject({ width: 0, height: 0 });
  });

  it('paints tile progress and accepts Cancel between tile tasks', async () => {
    const user = userEvent.setup();
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    const encode = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['png'], { type: 'image/png' }));
    });
    const source = document.createElement('canvas');
    source.width = 100;
    source.height = 80;
    exportMocks.exporter = vi.fn().mockResolvedValue({
      blob: new Blob(['source'], { type: 'image/png' }),
      width: 100,
      height: 80,
      surface: source,
    });
    const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<App />);

    const width = screen.getByRole('textbox', { name: 'Page width' });
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
    expect(screen.getByRole('status')).toHaveTextContent('1/2 tiles (50%)');
    expect(cancel).toHaveFocus();
    fireEvent.click(cancel);
    expect(screen.getByRole('status')).toHaveTextContent('Cancelling export');

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(screen.getByRole('status')).toHaveTextContent('Export cancelled');
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(encode).not.toHaveBeenCalled();
    expect(downloadClick).not.toHaveBeenCalled();
  });
});
