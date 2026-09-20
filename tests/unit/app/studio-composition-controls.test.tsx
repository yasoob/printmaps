import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createProjectStore } from '../../../src/app/store';
import { ProjectStoreContext } from '../../../src/app/projectStoreContext';
import { StudioCompositionControls } from '../../../src/app/studio/StudioCompositionControls';
import { createInitialProjectDocument } from '../../../src/domain/project';
import { parseProjectFileText } from '../../../src/domain/projectFile';
import { portableProjectText } from '../../../src/domain/projectSerialization';

it('applies the gallery in one undo step without removing geography, and survives save/open', async () => {
  const user = userEvent.setup(), store = createProjectStore(createInitialProjectDocument());
  const original = store.getState().document;
  render(<ProjectStoreContext value={store}><StudioCompositionControls exporter={null} /></ProjectStoreContext>);
  await user.click(screen.getByRole('button', { name: 'Change layout' }));
  await user.click(screen.getByRole('button', { name: /City edition/ }));
  const applied = store.getState().document;
  expect(applied.layers).toEqual(original.layers);
  expect(applied.camera).toEqual(original.camera);
  expect(applied.studio.poster.enabled).toBe(true);
  expect(store.getState().past).toHaveLength(1);
  const portable = portableProjectText(applied);
  expect(parseProjectFileText(portable)).toEqual(applied);
  act(() => store.getState().undo());
  expect(store.getState().document).toEqual(original);
  act(() => store.getState().redo());
  expect(store.getState().document).toEqual(applied);
});

it('updates only the canonical section and exposes rendering constraints on a pitched map', async () => {
  const user = userEvent.setup(), store = createProjectStore(createInitialProjectDocument());
  render(<ProjectStoreContext value={store}><StudioCompositionControls exporter={null} /></ProjectStoreContext>);
  await user.click(screen.getByRole('button', { name: 'Text' }));
  await user.click(screen.getByRole('checkbox', { name: 'Show title' }));
  expect(store.getState().document.studio.poster.enabled).toBe(true);
  const photos = store.getState().document.studio.photos;
  await user.type(screen.getByRole('textbox', { name: 'Title text' }), 'My city');
  expect(store.getState().document.studio.poster.title.text).toBe('My city');
  expect(store.getState().document.studio.photos).toBe(photos);
  act(() => store.getState().setCameraPitch(30));
  await user.click(screen.getByRole('button', { name: 'Map elements' }));
  expect(screen.getByRole('checkbox', { name: 'Show scale bar' })).toBeDisabled();
  expect(screen.getByText(/Scale requires pitch 0/)).toBeVisible();
});

it('keeps output actions out of the layout inspector', () => {
  const store = createProjectStore(createInitialProjectDocument());
  render(<ProjectStoreContext value={store}><StudioCompositionControls exporter={null} /></ProjectStoreContext>);
  expect(screen.queryByRole('button', { name: 'Preview on a wall' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Export/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
