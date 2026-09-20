import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInitialProjectDocument } from '../../src/domain/project';
import { createProjectStore } from '../../src/app/store';
import { ProjectStoreContext } from '../../src/app/projectStoreContext';
import { StudioVideoControls } from '../../src/app/studio/StudioVideoControls';
import type { VideoExportDialogProps } from '../../src/app/components/VideoExportDialog';

vi.mock('../../src/app/components/VideoExportDialog', () => ({
  VideoExportDialog: ({ settings, onSettingsChange, onClose, blockedReason }: VideoExportDialogProps) => <div role="dialog" aria-label="Test video">
    <span>{settings.durationSeconds} seconds</span>
    <button onClick={() => onSettingsChange({ ...settings, durationSeconds: 15 })}>Set 15 seconds</button>
    <button onClick={onClose}>Close video</button>
    {blockedReason && <p role="alert">{blockedReason}</p>}
  </div>,
}));

it('opens video without mutating project state and persists preferences through the central store', async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const store = createProjectStore(createInitialProjectDocument());
  const original = store.getState();
  render(<ProjectStoreContext value={store}><StudioVideoControls exporter={null} /></ProjectStoreContext>);
  await user.click(screen.getByRole('button', { name: 'Map video' }));
  await user.click(screen.getByRole('button', { name: 'Export map video' }));
  await screen.findByRole('dialog', { name: 'Test video' });
  expect(store.getState()).toBe(original);
  await user.click(screen.getByRole('button', { name: 'Set 15 seconds' }));
  expect(store.getState().document.studio.video.durationSeconds).toBe(15);
  expect(store.getState().past).toHaveLength(1);
  act(() => store.getState().undo());
  expect(screen.getByText('10 seconds')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Close video' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('closes the video surface when its canonical project epoch is replaced', async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const store = createProjectStore(createInitialProjectDocument());
  render(<ProjectStoreContext value={store}><StudioVideoControls exporter={null} /></ProjectStoreContext>);
  await user.click(screen.getByRole('button', { name: 'Map video' }));
  await user.click(screen.getByRole('button', { name: 'Export map video' }));
  await screen.findByRole('dialog', { name: 'Test video' });
  act(() => { store.getState().openDocument(createInitialProjectDocument()); });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
