import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { exportMocks } from './exportMocks';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

async function setLargeSquare(user: ReturnType<typeof userEvent.setup>) {
  for (const [name, value] of [['Page width', '1330'], ['Page height', '1330']] as const) {
    const field = screen.getByRole('textbox', { name });
    await user.clear(field);
    await user.type(field, value);
    await user.tab();
  }
}

describe('large raster export', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined });
  });

  afterEach(() => vi.restoreAllMocks());

  it('streams an oversized raster package to a user-picked file before renderer startup', async () => {
    const user = userEvent.setup();
    const events: string[] = [];
    const writable = {
      write: vi.fn(() => { events.push('write'); }),
      close: vi.fn(() => { events.push('close'); }),
      abort: vi.fn(),
    };
    const picker = vi.fn(() => {
      events.push('picker');
      return Promise.resolve({ createWritable: () => Promise.resolve(writable) });
    });
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: picker });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 80 })),
      set fillStyle(_value: string) {}, set font(_value: string) {},
      set globalAlpha(_value: number) {}, set textBaseline(_value: CanvasTextBaseline) {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
      callback(new Blob(['png'], { type: type ?? 'image/png' }));
    });
    const renderPrintTile = vi.fn(({ region }: { region: { width: number; height: number } }) => {
      events.push('render');
      const tile = document.createElement('canvas');
      tile.width = region.width;
      tile.height = region.height;
      return Promise.resolve(tile);
    });
    exportMocks.exporter = Object.assign(vi.fn(), {
      createPrintTileRenderer: vi.fn(() => {
        events.push('renderer-factory');
        return renderPrintTile;
      }),
    });
    render(<App />);

    await setLargeSquare(user);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: /Large-output tile package/ }));
    expect(screen.getByRole('dialog', { name: 'Export map' })).toHaveTextContent('not a single PNG');
    await user.click(screen.getByRole('button', { name: 'Save tile package' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved 15709 × 15709 tile package with 16 PNG tiles'));
    expect(events.indexOf('picker')).toBeLessThan(events.indexOf('renderer-factory'));
    expect(picker).toHaveBeenCalledOnce();
    expect(renderPrintTile).toHaveBeenCalledTimes(16);
    expect(writable.write).toHaveBeenCalled();
    expect(writable.close).toHaveBeenCalledOnce();
    expect(writable.abort).not.toHaveBeenCalled();
  });

  it('treats file-picker cancellation as cancellation without starting map rendering', async () => {
    const user = userEvent.setup();
    const picker = vi.fn().mockRejectedValue(new DOMException('Dismissed', 'AbortError'));
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: picker });
    const rendererFactory = vi.fn();
    exportMocks.exporter = Object.assign(vi.fn(), { createPrintTileRenderer: rendererFactory });
    render(<App />);

    await setLargeSquare(user);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('radio', { name: /Large-output tile package/ }));
    await user.click(screen.getByRole('button', { name: 'Save tile package' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Export cancelled'));
    expect(rendererFactory).not.toHaveBeenCalled();
  });

  it('gives unsupported browsers an actionable large-output fallback without rendering', async () => {
    const user = userEvent.setup();
    const rendererFactory = vi.fn();
    exportMocks.exporter = Object.assign(vi.fn(), { createPrintTileRenderer: rendererFactory });
    render(<App />);

    await setLargeSquare(user);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export map' });
    await user.click(within(dialog).getByRole('radio', { name: /Large-output tile package/ }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent('Chrome or Edge');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('reduce the page size');
    expect(within(dialog).getByRole('button', { name: 'Save tile package' })).toBeDisabled();
    expect(rendererFactory).not.toHaveBeenCalled();
  });
});
