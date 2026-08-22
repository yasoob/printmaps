import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { exportMocks } from './exportMocks';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('editor export', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
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

    await user.click(download);
    expect(screen.getByRole('alert')).toHaveTextContent('live map preview is not ready');
    await user.keyboard('{Escape}');
    expect(dialog).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps focus contained in the dialog while export is busy', async () => {
    const user = userEvent.setup();
    let finishExport: ((result: { blob: Blob; width: number; height: number }) => void) | undefined;
    exportMocks.exporter = vi.fn(() => new Promise<{ blob: Blob; width: number; height: number }>((resolve) => { finishExport = resolve; }));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export map' });
    await user.click(screen.getByRole('button', { name: 'Download PNG' }));

    await waitFor(() => expect(dialog).toHaveFocus());
    expect(document.querySelector('.export-backdrop')?.tagName).toBe('DIV');
    await user.keyboard('{Tab}');
    expect(dialog).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(dialog).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveFocus();

    finishExport?.({ blob: new Blob(['png']), width: 100, height: 80 });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Download started'));
  });
});
