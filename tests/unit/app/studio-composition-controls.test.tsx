import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createProjectStore } from '../../../src/app/store';
import { ProjectStoreContext } from '../../../src/app/projectStoreContext';
import { StudioCompositionControls } from '../../../src/app/studio/StudioCompositionControls';
import { createInitialProjectDocument } from '../../../src/domain/project';
import { parseProjectFileText } from '../../../src/domain/projectFile';
import { portableProjectText } from '../../../src/domain/projectSerialization';

async function unavailableExporter(): Promise<never> { throw new Error('A test capture failure.'); }

it('applies the gallery in one undo step without removing geography, and survives save/open', async () => {
  const user = userEvent.setup(), store = createProjectStore(createInitialProjectDocument());
  const original = store.getState().document;
  render(<ProjectStoreContext value={store}><StudioCompositionControls exporter={null} /></ProjectStoreContext>);
  await user.click(screen.getByText('Templates & starter gallery'));
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
  await user.click(screen.getByText('Poster typography & paper'));
  await user.click(screen.getByRole('checkbox', { name: 'Enable poster composition' }));
  expect(store.getState().document.studio.poster.enabled).toBe(true);
  const photos = store.getState().document.studio.photos;
  await user.type(screen.getByRole('textbox', { name: 'Title text' }), 'My city');
  expect(store.getState().document.studio.poster.title.text).toBe('My city');
  expect(store.getState().document.studio.photos).toBe(photos);
  act(() => store.getState().setCameraPitch(30));
  await user.click(screen.getByText('Compass, scale, grid & QR'));
  expect(screen.getByRole('checkbox', { name: 'Show scale bar' })).toBeDisabled();
  expect(screen.getByText(/Scale requires pitch 0/)).toBeVisible();
});

it('reports unavailable wall capture instead of opening an empty success-shaped preview', async () => {
  const user = userEvent.setup(), store = createProjectStore(createInitialProjectDocument());
  render(<ProjectStoreContext value={store}><StudioCompositionControls exporter={null} /></ProjectStoreContext>);
  await user.click(screen.getByRole('button', { name: 'Preview on a wall' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Wait for the map');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('opening and closing the wall modal do not write a document or history entry', async () => {
  const user = userEvent.setup(), store = createProjectStore(createInitialProjectDocument());
  const initial = store.getState();
  render(<ProjectStoreContext value={store}><StudioCompositionControls exporter={unavailableExporter} /></ProjectStoreContext>);
  await user.click(screen.getByRole('button', { name: 'Preview on a wall' }));
  expect(await screen.findByRole('dialog')).toBeVisible();
  expect(store.getState()).toBe(initial);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(store.getState()).toBe(initial);
});
