import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/app/App';
import { createProjectStore } from '../../src/app/store';
import { ProjectStoreContext } from '../../src/app/projectStoreContext';
import { createInitialProjectDocument } from '../../src/domain/project';
import { decodeSharedProject } from '../../src/sharing/codec';
import { parseSharedHash } from '../../src/sharing/urls';
import { ShareControl } from '../../src/sharing/ShareControl';
import { SharedProjectApp } from '../../src/sharing/SharedProjectApp';
import { downloadProjectDocument } from '../../src/app/components/projectDownload';
import type { AutosaveRepository } from '../../src/storage/autosave';

vi.mock('../../src/map/MapCanvas', async () => import('./app/MapCanvasMock'));
vi.mock('../../src/app/components/projectDownload', () => ({ downloadProjectDocument: vi.fn() }));

afterEach(cleanup);

describe('share snapshot UI', () => {
  it('captures on click, ignores later edits, handles embed validation and restores focus', async () => {
    const user = userEvent.setup();
    const store = createProjectStore(createInitialProjectDocument());
    render(<ProjectStoreContext value={store}><ShareControl disabled={false} /></ProjectStoreContext>);
    await user.click(screen.getByRole('button', { name: 'Share' }));
    const link = screen.getByLabelText<HTMLTextAreaElement>('Read-only link').value;
    act(() => { store.getState().setProjectTitle('Changed after sharing'); });
    expect(screen.getByLabelText('Read-only link')).toHaveValue(link);
    const payload = parseSharedHash(new URL(link).hash).payload;
    expect(decodeSharedProject(payload).title).not.toBe('Changed after sharing');
    const height = screen.getByLabelText('Embed height (pixels)');
    await user.clear(height);
    expect(screen.getByRole('alert')).toHaveTextContent('height');
    await user.type(height, '320');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Embed HTML').value).toContain('height="320"');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Share' })).toHaveFocus());
  });

  it('reports clipboard failure and ignores late clipboard completion after dismissal', async () => {
    const user = userEvent.setup();
    const clipboard = vi.spyOn(window.navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('Clipboard permission denied'));
    const store = createProjectStore(createInitialProjectDocument());
    render(<ProjectStoreContext value={store}><ShareControl disabled={false} /></ProjectStoreContext>);
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Clipboard permission denied');
    let finish: (() => void) | undefined;
    clipboard.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await act(async () => { finish?.(); });
    expect(screen.queryByText('Copied to clipboard.')).not.toBeInTheDocument();
    clipboard.mockRestore();
  });
});

describe('read-only and remix boundaries', () => {
  it('renders no editing/import surfaces; hotkeys and preview events cannot change the downloaded snapshot', async () => {
    const user = userEvent.setup();
    const document = createInitialProjectDocument();
    render(<SharedProjectApp document={document} options={{ embedded: false, navigation: true }} payload="test" onRemix={vi.fn()} />);
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-interaction-mode', 'readonly');
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
    await user.keyboard('{Delete}{Control>}z{/Control}');
    await user.click(screen.getByRole('button', { name: 'Map background' }));
    await user.click(screen.getByRole('button', { name: 'Download project' }));
    expect(downloadProjectDocument).toHaveBeenLastCalledWith(document);
    expect(screen.queryByRole('status', { name: 'Autosave status' })).not.toBeInTheDocument();
  });

  it('keeps local autosave until replacement is deliberate and downloads local work before replacing', async () => {
    const user = userEvent.setup();
    const local = { ...createInitialProjectDocument(), title: 'My unsaved local work' };
    const shared = { ...createInitialProjectDocument(), title: 'A shared snapshot' };
    const repository: AutosaveRepository = {
      load: vi.fn(), save: vi.fn().mockResolvedValue(undefined),
      discard: vi.fn(), close: vi.fn(),
    };
    render(<App initialDocument={local} remixDocument={shared} autosaveRepository={repository} />);
    expect(await screen.findByRole('dialog', { name: 'Replace current project?' })).toHaveTextContent(local.title);
    expect(repository.save).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Download current project' }));
    expect(downloadProjectDocument).toHaveBeenLastCalledWith(local);
    expect(repository.save).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Replace project' }));
    await waitFor(() => expect(repository.save).toHaveBeenCalledWith(shared));
  });

  it('can cancel remix without replacing or saving the shared design', async () => {
    const user = userEvent.setup();
    const local = { ...createInitialProjectDocument(), title: 'Local project' };
    const repository: AutosaveRepository = {
      load: vi.fn(), save: vi.fn(), discard: vi.fn(), close: vi.fn(),
    };
    render(<App initialDocument={local} remixDocument={{ ...local, title: 'Shared project' }} autosaveRepository={repository} />);
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(repository.save).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Local project/ })).toBeInTheDocument();
  });
});
