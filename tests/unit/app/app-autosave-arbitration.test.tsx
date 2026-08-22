import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createInitialProjectDocument } from '../../../src/domain/project';
import type { AutosaveDraft, AutosaveRepository } from '../../../src/storage/autosave';
import { exportMocks } from './exportMocks';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

function stubMobileViewport() {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query === '(max-width: 760px)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

function createDelayedDraftRepository() {
  const recovered = createInitialProjectDocument();
  recovered.title = 'Delayed local work';
  let finishLoad: ((draft: AutosaveDraft | null) => void) | undefined;
  const repository: AutosaveRepository = {
    load: vi.fn(() => new Promise<AutosaveDraft | null>((resolve) => { finishLoad = resolve; })),
    save: vi.fn().mockResolvedValue(undefined),
    discard: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  };
  return {
    repository,
    resolveLoad: async () => {
      await act(async () => {
        finishLoad?.({
          recordVersion: 1,
          savedAt: '2026-08-22T10:00:00.000Z',
          document: recovered,
        });
      });
    },
  };
}

describe('autosave modal arbitration', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it('preempts Export for a delayed recovery decision and restores the Export trigger after recover', async () => {
    const user = userEvent.setup();
    const { repository, resolveLoad } = createDelayedDraftRepository();
    render(<App autosaveRepository={repository} />);

    const exportTrigger = screen.getByRole('button', { name: 'Export' });
    await user.click(exportTrigger);
    expect(screen.getByRole('dialog', { name: 'Export map' })).toBeInTheDocument();

    await resolveLoad();

    const recoveryDialog = await screen.findByRole('dialog', { name: 'Recover local draft' });
    const recover = screen.getByRole('button', { name: 'Recover draft' });
    const discard = screen.getByRole('button', { name: 'Discard draft' });
    expect(screen.getAllByRole('dialog')).toEqual([recoveryDialog]);
    expect(screen.queryByRole('dialog', { name: 'Export map' })).not.toBeInTheDocument();
    expect(recover).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(discard).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(recoveryDialog).toBeInTheDocument();
    expect(discard).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(recover).toHaveFocus();

    await user.click(recover);

    await waitFor(() => expect(recoveryDialog).not.toBeInTheDocument());
    await waitFor(() => expect(exportTrigger).toHaveFocus());
  });

  it('preempts the Layers drawer for a delayed recovery decision and restores its trigger after discard', async () => {
    stubMobileViewport();
    const user = userEvent.setup();
    const { repository, resolveLoad } = createDelayedDraftRepository();
    render(<App autosaveRepository={repository} />);

    const layersTrigger = screen.getByRole('button', { name: 'Open layers' });
    await user.click(layersTrigger);
    expect(screen.getByRole('dialog', { name: 'Layers sidebar' })).toBeInTheDocument();

    await resolveLoad();

    const recoveryDialog = await screen.findByRole('dialog', { name: 'Recover local draft' });
    expect(screen.getAllByRole('dialog')).toEqual([recoveryDialog]);
    expect(screen.queryByRole('dialog', { name: 'Layers sidebar' })).not.toBeInTheDocument();
    expect(layersTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Recover draft' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(recoveryDialog).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Discard draft' }));

    await waitFor(() => expect(recoveryDialog).not.toBeInTheDocument());
    await waitFor(() => expect(layersTrigger).toHaveFocus());
  });

  it('preempts the Properties drawer for a delayed recovery decision and restores its trigger after recover', async () => {
    stubMobileViewport();
    const user = userEvent.setup();
    const { repository, resolveLoad } = createDelayedDraftRepository();
    render(<App autosaveRepository={repository} />);

    const propertiesTrigger = screen.getByRole('button', { name: 'Open properties' });
    await user.click(propertiesTrigger);
    expect(screen.getByRole('dialog', { name: 'Properties sidebar' })).toBeInTheDocument();

    await resolveLoad();

    const recoveryDialog = await screen.findByRole('dialog', { name: 'Recover local draft' });
    expect(screen.getAllByRole('dialog')).toEqual([recoveryDialog]);
    expect(screen.queryByRole('dialog', { name: 'Properties sidebar' })).not.toBeInTheDocument();
    expect(propertiesTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Recover draft' })).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Discard draft' })).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(screen.getByRole('button', { name: 'Recover draft' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Recover draft' }));

    await waitFor(() => expect(recoveryDialog).not.toBeInTheDocument());
    await waitFor(() => expect(propertiesTrigger).toHaveFocus());
  });

});
