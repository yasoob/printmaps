import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInitialProjectDocument } from '../../src/domain/project';
import { createProjectStore } from '../../src/app/store';
import { ProjectStoreContext } from '../../src/app/projectStoreContext';
import { StudioTerrainControls } from '../../src/app/studio/StudioTerrainControls';

it('routes terrain controls through the canonical undoable project document', async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const store = createProjectStore(createInitialProjectDocument());
  const originalStudio = store.getState().document.studio;
  render(<ProjectStoreContext value={store}><StudioTerrainControls /></ProjectStoreContext>);
  await user.click(screen.getByRole('button', { name: 'Terrain' }));
  await user.click(screen.getByRole('switch', { name: 'Show 3D terrain' }));
  expect(store.getState().document.studio.terrain.enabled).toBe(true);
  expect(store.getState().document.studio.photos).toBe(originalStudio.photos);
  expect(originalStudio.terrain.enabled).toBe(false);
  act(() => store.getState().undo());
  expect(screen.getByRole('switch', { name: 'Show 3D terrain' })).not.toBeChecked();
  expect(store.getState().document.studio.terrain.enabled).toBe(false);
});

it('keeps the terrain inspector content-only without creating feature state through navigation', async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const store = createProjectStore(createInitialProjectDocument());
  render(<ProjectStoreContext value={store}><StudioTerrainControls /></ProjectStoreContext>);
  await user.click(screen.getByRole('button', { name: 'Terrain' }));
  expect(screen.queryByRole('button', { name: /Export/ })).not.toBeInTheDocument();
  expect(store.getState().past).toHaveLength(0);
});
