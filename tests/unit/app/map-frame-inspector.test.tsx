import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createProjectStore } from '../../../src/app/store';
import { ProjectStoreContext } from '../../../src/app/projectStoreContext';
import { StudioCompositionControls } from '../../../src/app/studio/StudioCompositionControls';
import { createInitialProjectDocument } from '../../../src/domain/project';
import { createSilhouetteApplication } from '../../../src/domain/studioSilhouette';
import type { AdministrativeArea } from '../../../src/domain/administrativeAreas';
import type { PreviewPngExporter } from '../../../src/export/previewPng';
import { studioProject } from '../../fixtures/studio';

const area: AdministrativeArea = {
  id: 'test-outline', name: 'Test country', level: 'country',
  countryCode: 'AT', source: 'test',
  geometry: { type: 'Polygon', coordinates: [[[15, 47], [17, 47], [17, 49], [15, 49], [15, 47]]] },
};
vi.mock('../../../src/app/components/AdministrativeAreaPicker', () => ({
  AdministrativeAreaPicker: ({ onAdd }: { onAdd: (value: AdministrativeArea) => void }) => <button type="button" onClick={() => onAdd(area)}>Apply test country</button>,
}));

beforeEach(() => localStorage.clear());

it.each([false, true])('Rectangle hides the real mask, retaining geometry, reference and lock with one undo step (locked: %s)', async (locked) => {
  const user = userEvent.setup();
  const document = studioProject();
  const originalMask = document.layers.find(({ id }) => id === document.studio.poster.silhouetteLayerId)!;
  originalMask.locked = locked;
  const store = createProjectStore(document);
  const before = store.getState().document;
  render(<ProjectStoreContext value={store}><StudioCompositionControls /></ProjectStoreContext>);
  await user.click(screen.getByRole('button', { name: 'Map frame' }));
  await user.click(screen.getByRole('button', { name: 'Rectangle' }));
  const changed = store.getState().document;
  expect(changed.layers.find(({ id }) => id === originalMask.id)).toEqual({ ...originalMask, visible: false });
  expect(changed.studio.poster).toBe(before.studio.poster);
  expect(store.getState().past).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Rectangle' })).toHaveAttribute('aria-pressed', 'true');
  act(() => store.getState().undo());
  expect(store.getState().document).toEqual(before);
  expect(screen.getByRole('button', { name: 'Country / region' })).toHaveAttribute('aria-pressed', 'true');
});

it('country fitting changes only the frame/reference/camera and stays in the Layout inspector', async () => {
  const user = userEvent.setup();
  const document = createInitialProjectDocument();
  document.studio.poster.enabled = true;
  document.studio.poster.title = { ...document.studio.poster.title, enabled: true, text: 'My own title' };
  document.studio.poster.backgroundColor = '#334455';
  document.studio.poster.marginsMm.left = 24;
  const store = createProjectStore(document);
  const exporter: PreviewPngExporter = Object.assign(vi.fn(), { captureRenderSnapshot: vi.fn(() => ({
    style: { version: 8 as const, layers: [], sources: {} }, layers: [], assets: {},
    camera: { ...document.camera, roll: 0 }, printCamera: document.camera,
    referenceLongitude: 0, frame: { x: 100, y: 50, width: 600, height: 400 }, viewport: { width: 800, height: 500 },
    footprint: { corners: [[15, 49], [17, 49], [17, 47], [15, 47]] as [[number, number], [number, number], [number, number], [number, number]], widthPx: 600, heightPx: 400, bearing: 0, pitch: 0 },
  })) });
  render(<ProjectStoreContext value={store}><StudioCompositionControls exporter={exporter} /></ProjectStoreContext>);
  await user.click(screen.getByRole('button', { name: 'Map frame' }));
  await user.click(screen.getByRole('button', { name: 'Country / region' }));
  await user.click(screen.getByRole('button', { name: 'Apply test country' }));
  const applied = store.getState().document;
  expect(applied.studio.poster).toEqual({ ...document.studio.poster, silhouetteLayerId: expect.any(String) });
  expect(applied.style).toEqual(document.style);
  expect(applied.page).toEqual(document.page);
  expect(applied.layers.filter(({ id }) => id !== applied.studio.poster.silhouetteLayerId)).toEqual(document.layers);
  expect(applied.layers.find(({ id }) => id === applied.studio.poster.silhouetteLayerId)?.appearance).toMatchObject({
    invert: true, fillColor: '#334455', strokeColor: '#334455', strokeWidth: 0.5,
  });
  expect(store.getState().selectedId).toBeNull();
  expect(store.getState().past).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Country / region' })).toHaveAttribute('aria-pressed', 'true');
});

it('preserving a plain layout does not enable hidden text, margins or a different design', () => {
  const document = createInitialProjectDocument();
  const application = createSilhouetteApplication(document, area, { x: 0, y: 0, width: 600, height: 400 }, { width: 600, height: 400, preserveLayout: true });
  expect(application.poster).toEqual({ ...document.studio.poster, silhouetteLayerId: application.silhouette.id });
  expect(application.poster.enabled).toBe(false);
  expect(application.style).toBeUndefined();
  expect(application.page).toBeUndefined();
});
