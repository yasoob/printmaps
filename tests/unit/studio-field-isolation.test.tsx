import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useSettingActions } from '../../src/app/hooks/useSettingActions';
import { VideoExportSettings } from '../../src/app/components/VideoExportSettings';
import { StudioCompositionControls } from '../../src/app/studio/StudioCompositionControls';
import { ProjectStoreContext } from '../../src/app/projectStoreContext';
import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';
import type { ProjectMutationResult } from '../../src/domain/projectMutation';
import { createDefaultStudioSettings } from '../../src/domain/studio';

const KEYS = ['name', 'size'] as const;
type Settings = { name: string; size: number; enabled: boolean };
type HookProps = { value: Settings; commit: (value: Settings) => ProjectMutationResult };

it('keeps field actions stable while reading current settings and reporting the current commit result', () => {
  const initial = Object.freeze({ name: 'Before', size: 10, enabled: false });
  const commit = vi.fn(() => ({ ok: true as const }));
  const initialProps: HookProps = { value: initial, commit };
  const { result, rerender } = renderHook(({ value, commit }: HookProps) => useSettingActions(value, commit, KEYS), {
    initialProps,
  });
  const actions = result.current;
  const current = Object.freeze({ name: 'After', size: 20, enabled: true });
  const rejected = { ok: false as const, error: 'Locked project' };
  const nextCommit = vi.fn(() => rejected);
  rerender({ value: current, commit: nextCommit });
  expect(result.current).toBe(actions);
  expect(result.current.name).toBe(actions.name);
  expect(actions.name('Latest name')).toBe(rejected);
  expect(commit).not.toHaveBeenCalled();
  expect(nextCommit).toHaveBeenCalledWith({ name: 'Latest name', size: 20, enabled: true });
  expect(current.name).toBe('After');
  expect(initial).toEqual({ name: 'Before', size: 10, enabled: false });
});

it('preserves canonical validation, sibling values and history across repeated poster field edits and undo', () => {
  const store = createProjectStore(createInitialProjectDocument());
  render(<ProjectStoreContext value={store}><StudioCompositionControls exporter={null} /></ProjectStoreContext>);
  fireEvent.click(screen.getByRole('button', { name: 'Text' }));
  const before = store.getState().document.studio.poster;
  const title = screen.getByLabelText('Title text');
  fireEvent.change(title, { target: { value: 'A first title' } });
  const margin = screen.getByLabelText('Top margin');
  fireEvent.change(margin, { target: { value: '17' } });
  fireEvent.keyDown(margin, { key: 'Enter' });
  fireEvent.change(screen.getByLabelText('Subtitle text'), { target: { value: 'A subtitle' } });
  fireEvent.change(title, { target: { value: 'A second title' } });
  let poster = store.getState().document.studio.poster;
  expect(poster.title.text).toBe('A second title');
  expect(poster.subtitle.text).toBe('A subtitle');
  expect(poster.marginsMm.top).toBe(17);
  expect(before).toEqual(createInitialProjectDocument().studio.poster);
  expect(Object.isFrozen(poster.title)).toBe(true);
  act(() => store.getState().undo());
  expect(title).toHaveValue('A first title');
  fireEvent.change(screen.getByLabelText('Paper color'), { target: { value: '#123456' } });
  poster = store.getState().document.studio.poster;
  expect(poster.title.text).toBe('A first title');
  expect(poster.subtitle.text).toBe('A subtitle');
  expect(poster.marginsMm.top).toBe(17);
  const past = store.getState().past.length;
  fireEvent.change(margin, { target: { value: '-2' } });
  fireEvent.keyDown(margin, { key: 'Enter' });
  expect(store.getState().document.studio.poster.marginsMm.top).toBe(17);
  expect(store.getState().past).toHaveLength(past);
});

it('updates native busy availability without replacing video choices or using stale settings', () => {
  const settings = createDefaultStudioSettings().video;
  const commit = vi.fn();
  const { rerender } = render(<VideoExportSettings settings={settings} busy={false} onChange={commit} />);
  const duration = screen.getByLabelText('Duration');
  const motion = screen.getByLabelText('Motion');
  rerender(<VideoExportSettings settings={settings} busy onChange={commit} />);
  expect(screen.getByLabelText('Duration')).toBe(duration);
  expect(duration).toBeDisabled();
  expect(motion).toBeDisabled();
  const next = { ...settings, durationSeconds: 15 as const };
  rerender(<VideoExportSettings settings={next} busy={false} onChange={commit} />);
  expect(duration).toBeEnabled();
  expect(duration).toHaveValue('15');
  fireEvent.change(motion, { target: { value: 'sway' } });
  expect(commit).toHaveBeenLastCalledWith({ ...next, motion: 'sway' });
});
