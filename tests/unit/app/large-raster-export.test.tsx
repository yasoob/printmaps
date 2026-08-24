import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { exportMocks } from './exportMocks';

const largePngMocks = vi.hoisted(() => ({
  supported: true,
  create: vi.fn(),
  pick: vi.fn(),
}));

vi.mock('../../../src/export/largeRasterPng', () => ({
  canStreamLargeRasterPng: () => largePngMocks.supported,
  createLargeRasterPng: largePngMocks.create,
  createLargeRasterPngRegions: () => [{
    tile: { index: 0, column: 0, row: 0 },
    region: { x: 0, y: 0, width: 64, height: 64 },
    source: { x: 0, y: 0, width: 64, height: 64 },
    destination: { x: 0, y: 0, width: 64, height: 64 },
  }],
  pickLargeRasterPngFile: largePngMocks.pick,
}));
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
    largePngMocks.supported = true;
    largePngMocks.create.mockReset();
    largePngMocks.pick.mockReset();
  });

  afterEach(() => vi.restoreAllMocks());

  it('streams one oversized PNG to a user-picked file before renderer startup', async () => {
    const user = userEvent.setup();
    const events: string[] = [];
    const writable = { write: vi.fn(), close: vi.fn(), abort: vi.fn() };
    largePngMocks.pick.mockImplementation(async () => {
      events.push('picker');
      return writable;
    });
    largePngMocks.create.mockImplementation(async () => {
      events.push('stream-png');
      await writable.write(new Uint8Array([137, 80, 78, 71]));
      await writable.close();
      return { width: 15_709, height: 15_709, renderCount: 16, bytesWritten: 4 };
    });
    const renderPrintTile = vi.fn();
    exportMocks.exporter = Object.assign(vi.fn(), {
      createPrintTileRenderer: vi.fn(() => {
        events.push('renderer-factory');
        return renderPrintTile;
      }),
    });
    render(<App />);

    await setLargeSquare(user);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export map' });
    expect(within(dialog).queryByRole('radiogroup', { name: 'Raster output delivery' })).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent('one PNG file');
    expect(dialog).not.toHaveTextContent(/tile/i);
    await user.click(within(dialog).getByRole('button', { name: 'Download PNG' }));

    await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('Saved 15709 × 15709 PNG'));
    expect(events.indexOf('picker')).toBeLessThan(events.indexOf('renderer-factory'));
    expect(largePngMocks.create).toHaveBeenCalledOnce();
    expect(writable.close).toHaveBeenCalledOnce();
    expect(writable.abort).not.toHaveBeenCalled();
  });

  it('treats file-picker cancellation as cancellation without starting map rendering', async () => {
    const user = userEvent.setup();
    largePngMocks.pick.mockRejectedValue(new DOMException('Dismissed', 'AbortError'));
    const rendererFactory = vi.fn();
    exportMocks.exporter = Object.assign(vi.fn(), { createPrintTileRenderer: rendererFactory });
    render(<App />);

    await setLargeSquare(user);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: 'Download PNG' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Export cancelled'));
    expect(rendererFactory).not.toHaveBeenCalled();
  });

  it('aborts a picked file when native renderer planning fails before encoder ownership', async () => {
    const user = userEvent.setup();
    const failure = new Error('pitched multi-region export is unavailable');
    const writable = { write: vi.fn(), close: vi.fn(), abort: vi.fn() };
    largePngMocks.pick.mockResolvedValue(writable);
    exportMocks.exporter = Object.assign(vi.fn(), {
      createPrintTileRenderer: vi.fn(() => { throw failure; }),
    });
    render(<App />);

    await setLargeSquare(user);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: 'Download PNG' }));

    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Export map' })).getByRole('alert')).toHaveTextContent(failure.message));
    expect(writable.abort).toHaveBeenCalledWith(failure);
    expect(largePngMocks.create).not.toHaveBeenCalled();
  });

  it('gives unsupported browsers an actionable large-PNG fallback without rendering', async () => {
    const user = userEvent.setup();
    largePngMocks.supported = false;
    const rendererFactory = vi.fn();
    exportMocks.exporter = Object.assign(vi.fn(), { createPrintTileRenderer: rendererFactory });
    render(<App />);

    await setLargeSquare(user);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export map' });

    expect(within(dialog).getByRole('alert')).toHaveTextContent('Chrome or Edge');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('reduce the page size');
    expect(within(dialog).getByRole('button', { name: 'Download PNG' })).toBeDisabled();
    expect(rendererFactory).not.toHaveBeenCalled();
  });
});
