import { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoExportDialog, type VideoExportDialogProps } from '../../src/app/components/VideoExportDialog';
import { createInitialProjectDocument } from '../../src/domain/project';
import type { PreviewPngExporter } from '../../src/export/previewPng';
import type { MapRenderSnapshot } from '../../src/map/MapRenderSnapshot';
import { exportVideoDocument } from '../../src/video/exportVideoDocument';
import { getVideoCapability } from '../../src/video/capability';
import { downloadBlob } from '../../src/lib/downloadBlob';
import { chooseOption } from './select-support';

vi.mock('../../src/video/exportVideoDocument', () => ({ exportVideoDocument: vi.fn() }));
vi.mock('../../src/video/capability', () => ({ getVideoCapability: vi.fn(() => ({ supported: true, mimeType: 'video/mp4' })) }));
vi.mock('../../src/lib/downloadBlob', () => ({ downloadBlob: vi.fn() }));

function props(): VideoExportDialogProps {
  const document = createInitialProjectDocument();
  const exporter: PreviewPngExporter = Object.assign(vi.fn(), {
    captureRenderSnapshot: vi.fn(() => ({ style: { version: 8, sources: {}, layers: [] } }) as unknown as MapRenderSnapshot),
  });
  return { document, settings: document.studio.video, onSettingsChange: vi.fn(), exporter, filename: 'My map.printmap.json', onClose: vi.fn() };
}

function pendingExport() {
  vi.mocked(exportVideoDocument).mockImplementation(({ signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
}

beforeEach(() => {
  vi.mocked(getVideoCapability).mockReturnValue({ supported: true, mimeType: 'video/mp4' });
  vi.mocked(exportVideoDocument).mockReset();
  vi.mocked(downloadBlob).mockReset();
});
afterEach(cleanup);

describe('controlled video export dialog', () => {
  it('uses canonical controlled settings for every requested option without maintaining another document', async () => {
    const user = userEvent.setup();
    const input = props();
    render(<VideoExportDialog {...input} />);
    await chooseOption(user, 'Duration', '5 seconds');
    expect(input.onSettingsChange).toHaveBeenLastCalledWith({ ...input.settings, durationSeconds: 5 });
    expect(input.document.studio.video.durationSeconds).toBe(10);
    await chooseOption(user, 'Video aspect', '4:5 portrait');
    expect(input.onSettingsChange).toHaveBeenLastCalledWith({ ...input.settings, aspect: '4:5' });
    await user.click(screen.getByRole('combobox', { name: 'Duration' }));
    expect(await screen.findByRole('option', { name: '15 seconds' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('combobox', { name: 'Target frame rate' }));
    expect(await screen.findByRole('option', { name: '60 fps target' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByText(/best-effort, not fixed frame rate/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Video recording help' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('best-effort, not fixed frame rate');
  });

  it('blocks unsupported MP4, incomplete drawing, and missing snapshot capability', () => {
    const input = props();
    const view = render(<VideoExportDialog {...input} blockedReason="Finish the unfinished drawing before recording." />);
    expect(screen.getByRole('button', { name: 'Download MP4' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('unfinished drawing');
    view.rerender(<VideoExportDialog {...input} exporter={null} />);
    expect(screen.getByRole('button', { name: 'Download MP4' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('not ready');
    view.unmount();
    vi.mocked(getVideoCapability).mockReturnValue({ supported: false, reason: 'MP4 recording is unavailable in this browser.' });
    render(<VideoExportDialog {...input} />);
    expect(screen.getByRole('alert')).toHaveTextContent('MP4 recording is unavailable');
    expect(screen.getByRole('button', { name: 'Download MP4' })).toBeDisabled();
  });

  it('cancels a running job, returns keyboard focus, and never downloads the aborted result', async () => {
    pendingExport();
    const user = userEvent.setup();
    const input = props();
    render(<VideoExportDialog {...input} />);
    await user.click(screen.getByRole('button', { name: 'Download MP4' }));
    await waitFor(() => expect(exportVideoDocument).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Cancel recording' })).toHaveFocus();
    expect(screen.getByLabelText('Duration')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel recording' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('cancelled'));
    expect(screen.getByRole('button', { name: 'Download MP4' })).toHaveFocus();
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(input.onSettingsChange).not.toHaveBeenCalled();
  });

  it('downloads only a completed MP4 and displays honest measured frame metrics', async () => {
    const blob = new Blob(['mp4'], { type: 'video/mp4' });
    vi.mocked(exportVideoDocument).mockResolvedValue({
      blob, width: 1280, height: 720, requestedDurationSeconds: 10, recordingSeconds: 10,
      targetFps: 30, presentedFrames: 200, measuredPresentationFps: 20, missedFrameSlots: 100,
    });
    const user = userEvent.setup();
    const input = props();
    const originalCamera = input.document.camera;
    const originalLayers = input.document.layers;
    render(<VideoExportDialog {...input} />);
    await user.click(screen.getByRole('button', { name: 'Download MP4' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(blob, 'My map.mp4'));
    expect(screen.getByRole('status')).toHaveTextContent(
      'MP4 download started. 1280 × 720 px · 10.0 s · 200 frames presented at 20.0 fps · 100 target slots missed.',
    );
    expect(screen.getByRole('status')).not.toHaveTextContent('Encoder frame drops');
    expect(screen.queryByText(/Encoder frame drops/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Video recording help' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Frame counts and fps measure presented frames, not encoded frames.');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Encoder frame drops are not measurable with MediaRecorder.');
    const captured = vi.mocked(exportVideoDocument).mock.calls[0][0];
    expect(captured.document).not.toBe(input.document);
    expect(captured.document).toEqual(input.document);
    expect(input.document.camera).toBe(originalCamera);
    expect(input.document.layers).toBe(originalLayers);
    expect(input.onSettingsChange).not.toHaveBeenCalled();
  });

  it('surfaces stale snapshot errors without starting a renderer', async () => {
    const input = props();
    vi.mocked(input.exporter!.captureRenderSnapshot!).mockImplementation(() => { throw new Error('The map is not ready for an export snapshot.'); });
    render(<VideoExportDialog {...input} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download MP4' }));
    expect(screen.getByRole('alert')).toHaveTextContent('not ready');
    expect(exportVideoDocument).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('aborts on unmount and resets safely on project replacement', async () => {
    pendingExport();
    const user = userEvent.setup();
    const input = props();
    const view = render(<VideoExportDialog {...input} />);
    await user.click(screen.getByRole('button', { name: 'Download MP4' }));
    await waitFor(() => expect(exportVideoDocument).toHaveBeenCalledOnce());
    const signal = vi.mocked(exportVideoDocument).mock.calls[0][0].signal;
    view.rerender(<VideoExportDialog {...input} document={{ ...input.document, id: 'replacement' }} />);
    expect(signal.aborted).toBe(true);
    expect(screen.getByRole('button', { name: 'Download MP4' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Download MP4' }));
    await waitFor(() => expect(exportVideoDocument).toHaveBeenCalledTimes(2));
    const nextSignal = vi.mocked(exportVideoDocument).mock.calls[1][0].signal;
    view.unmount();
    expect(nextSignal.aborted).toBe(true);
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('Escape cancels and returns focus to the opening control', async () => {
    pendingExport();
    const input = props();
    function Harness() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Open video</button>{open ? <VideoExportDialog {...input} onClose={() => setOpen(false)} /> : null}</>;
    }
    render(<Harness />);
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Open video' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Download MP4' }));
    await waitFor(() => expect(exportVideoDocument).toHaveBeenCalledOnce());
    await user.keyboard('{Escape}');
    expect(vi.mocked(exportVideoDocument).mock.calls[0][0].signal.aborted).toBe(true);
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
