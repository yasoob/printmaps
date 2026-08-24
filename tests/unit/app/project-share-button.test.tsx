import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInitialProjectDocument } from '../../../src/domain/project';
import { ProjectShareButton } from '../../../src/app/components/ProjectShareButton';

describe('portable project sharing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shares the current portable project file and reports completion', async () => {
    const user = userEvent.setup();
    let finishShare!: () => void;
    const payloads: ShareData[] = [];
    const share = vi.fn((data: ShareData) => {
      payloads.push(data);
      return new Promise<void>((resolve) => { finishShare = resolve; });
    });
    Object.defineProperties(globalThis.navigator, {
      canShare: { configurable: true, value: vi.fn(() => true) },
      share: { configurable: true, value: share },
    });
    const document = createInitialProjectDocument();

    render(<ProjectShareButton document={document} />);
    const button = screen.getByRole('button', { name: 'Share' });
    await user.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleName('Sharing project…');
    expect(share).toHaveBeenCalledTimes(1);
    const payload = payloads[0]!;
    expect(payload.files).toHaveLength(1);
    expect(payload.files![0]).toMatchObject({
      name: 'vienna-field-guide.printmap.json',
      type: 'application/json',
    });

    finishShare();
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).toHaveFocus();
    expect(screen.getByRole('status', { name: 'Project share status' })).toHaveTextContent('Project shared');
  });

  it('downloads a portable handoff when native file sharing is unavailable', async () => {
    const user = userEvent.setup();
    const fallbackDownload = vi.fn();
    Object.defineProperties(globalThis.navigator, {
      canShare: { configurable: true, value: undefined },
      share: { configurable: true, value: undefined },
    });
    const document = createInitialProjectDocument();

    render(<ProjectShareButton document={document} fallbackDownload={fallbackDownload} />);
    const button = screen.getByRole('button', { name: 'Share' });
    await user.click(button);

    expect(fallbackDownload).toHaveBeenCalledWith(document);
    expect(button).toHaveFocus();
    expect(screen.getByRole('status', { name: 'Project share status' })).toHaveTextContent(
      'Project file downloaded. Send it to share this editable map.',
    );
  });

  it('treats dismissal of the native share sheet as cancellation rather than an error', async () => {
    const user = userEvent.setup();
    Object.defineProperties(globalThis.navigator, {
      canShare: { configurable: true, value: vi.fn(() => true) },
      share: {
        configurable: true,
        value: vi.fn(() => Promise.reject(new DOMException('Share dismissed', 'AbortError'))),
      },
    });

    render(<ProjectShareButton document={createInitialProjectDocument()} />);
    const button = screen.getByRole('button', { name: 'Share' });
    await user.click(button);

    expect(await screen.findByRole('status', { name: 'Project share status' })).toHaveTextContent('Sharing cancelled');
    expect(screen.queryByRole('alert', { name: 'Project share status' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('reports a native share failure and restores the trigger', async () => {
    const user = userEvent.setup();
    Object.defineProperties(globalThis.navigator, {
      canShare: { configurable: true, value: vi.fn(() => true) },
      share: { configurable: true, value: vi.fn(() => Promise.reject(new Error('Sharing was blocked.'))) },
    });

    render(<ProjectShareButton document={createInitialProjectDocument()} />);
    const button = screen.getByRole('button', { name: 'Share' });
    await user.click(button);

    expect(await screen.findByRole('alert', { name: 'Project share status' })).toHaveTextContent('Sharing was blocked.');
    expect(button).toHaveFocus();
  });

  it('does not steal focus moved elsewhere while native sharing is pending', async () => {
    const user = userEvent.setup();
    let finishShare!: () => void;
    Object.defineProperties(globalThis.navigator, {
      canShare: { configurable: true, value: vi.fn(() => true) },
      share: {
        configurable: true,
        value: vi.fn(() => new Promise<void>((resolve) => { finishShare = resolve; })),
      },
    });

    render(
      <>
        <ProjectShareButton document={createInitialProjectDocument()} />
        <button type="button">Other action</button>
      </>,
    );
    const share = screen.getByRole('button', { name: 'Share' });
    const otherAction = screen.getByRole('button', { name: 'Other action' });
    await user.click(share);
    otherAction.focus();

    finishShare();
    await waitFor(() => expect(share).toBeEnabled());
    expect(otherAction).toHaveFocus();
  });
});
