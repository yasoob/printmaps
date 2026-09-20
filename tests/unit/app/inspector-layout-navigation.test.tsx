import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createInitialProjectDocument, createNewProjectDocument } from '../../../src/domain/project';
import { POSTER_STARTERS } from '../../../src/domain/studioTemplates';
import { createTemplateProject, currentLayoutApplication } from '../../../src/app/studio/templateProjects';
import { createProjectStore } from '../../../src/app/store';

const { downloadProjectDocument } = vi.hoisted(() => ({ downloadProjectDocument: vi.fn() }));
vi.mock('../../../src/app/components/projectDownload', () => ({ downloadProjectDocument }));
vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

beforeEach(() => { localStorage.clear(); downloadProjectDocument.mockReset(); });

it('keeps tab, disclosure and field drafts through contextual properties without document/history writes or canvas replacement', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  const canvas = screen.getByTestId('map-canvas');
  expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByRole('button', { name: 'Page' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: 'Layout' }));
  const margin = screen.getByRole('spinbutton', { name: 'Top margin' });
  expect(margin).toHaveValue(0);
  fireEvent.change(margin, { target: { value: '' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Map' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Layout' }));
  expect(screen.getByRole('spinbutton', { name: 'Top margin' })).toBe(margin);
  expect(margin).toHaveValue(null);
  fireEvent.click(screen.getByRole('button', { name: 'Page' }));
  fireEvent.click(screen.getByRole('button', { name: 'Page' }));
  expect(margin).toHaveValue(null);
  await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
  await user.click(screen.getByRole('button', { name: 'Project settings' }));
  expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Project' })).toHaveFocus());
  expect(screen.getByRole('spinbutton', { name: 'Top margin' })).toBe(margin);
  expect(margin).toHaveValue(null);
  expect(screen.getByTestId('map-canvas')).toBe(canvas);
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

it('keeps layout drafts through the layout chooser and excludes new-location starters', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  await user.click(screen.getByRole('tab', { name: 'Layout' }));
  const margin = screen.getByRole('spinbutton', { name: 'Left margin' });
  fireEvent.change(margin, { target: { value: '' } });
  await user.click(screen.getByRole('button', { name: 'Change layout' }));
  expect(screen.queryByRole('button', { name: /Lisbon/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Start with a place/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Back to Layout' }));
  expect(screen.getByRole('spinbutton', { name: 'Left margin' })).toBe(margin);
  expect(margin).toHaveValue(null);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Change layout' })).toHaveFocus());
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

it('activates only the intentionally edited page/text settings using effective zero margins', async () => {
  const user = userEvent.setup();
  render(<App initialDocument={createNewProjectDocument()} autosaveRepository={null} />);
  await user.click(screen.getByRole('tab', { name: 'Layout' }));
  expect(screen.queryByRole('checkbox', { name: 'Enable poster composition' })).not.toBeInTheDocument();
  const top = screen.getByRole('spinbutton', { name: 'Top margin' });
  fireEvent.change(top, { target: { value: '12' } });
  fireEvent.keyDown(top, { key: 'Enter' });
  expect(screen.getByRole('spinbutton', { name: 'Right margin' })).toHaveValue(0);
  await user.click(screen.getByRole('button', { name: 'Text' }));
  await user.click(screen.getByRole('checkbox', { name: 'Show title' }));
  await user.type(screen.getByRole('textbox', { name: 'Title text' }), 'Only my title');
  expect(screen.getByRole('checkbox', { name: 'Show subtitle' })).not.toBeChecked();
  await user.click(screen.getByRole('button', { name: 'Project' }));
  await user.click(screen.getByRole('menuitem', { name: 'Download project' }));
  const saved = downloadProjectDocument.mock.calls.at(-1)?.[0];
  expect(saved.studio.poster).toMatchObject({
    enabled: true, marginsMm: { top: 12, right: 0, bottom: 0, left: 0 },
    title: { enabled: true, text: 'Only my title' }, subtitle: { enabled: false },
  });
});

it('creates a separate templated document through backup/cancel/confirm and only then opens Layout', async () => {
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  const canvas = screen.getByTestId('map-canvas');
  async function chooseStarter() {
    await user.click(screen.getByRole('button', { name: 'Project' }));
    await user.click(screen.getByRole('menuitem', { name: 'New from template' }));
    await user.click(screen.getByRole('button', { name: /Lisbon/ }));
    expect(screen.queryByRole('dialog', { name: 'New from template' })).not.toBeInTheDocument();
  }
  await chooseStarter();
  expect(screen.getByRole('dialog', { name: 'Start a new project?' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Download current project' }));
  expect(downloadProjectDocument).toHaveBeenCalledWith(expect.objectContaining({ title: 'Vienna field guide' }));
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('button', { name: 'Select Route 01' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Project' })).toHaveFocus());
  await chooseStarter();
  await user.click(screen.getByRole('button', { name: 'Start new project' }));
  expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('button', { name: 'Lisbon' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Select Route 01' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  expect(screen.getByTestId('map-canvas')).toBe(canvas);
});

it('applies designs without replacing text/content/camera and builds complete starter defaults', () => {
  const document = createInitialProjectDocument();
  document.studio.poster.enabled = true;
  document.studio.poster.title.text = 'My title';
  document.studio.poster.subtitle.text = 'My subtitle';
  document.studio.poster.caption.text = 'My caption';
  const store = createProjectStore(document);
  expect(store.getState().applyStudioTemplate(currentLayoutApplication(document, 'gallery')).ok).toBe(true);
  const applied = store.getState().document;
  expect(applied.camera).toEqual(document.camera);
  expect(applied.layers.filter(({ type }) => type !== 'basemap')).toEqual(document.layers.filter(({ type }) => type !== 'basemap'));
  expect(applied.layers.find(({ type }) => type === 'basemap')).toEqual({ ...document.layers.find(({ type }) => type === 'basemap'), name: 'Night Ink basemap' });
  expect(applied.studio.photos).toEqual(document.studio.photos);
  for (const field of ['title', 'subtitle', 'caption'] as const) expect(applied.studio.poster[field].text).toBe(document.studio.poster[field].text);
  expect(store.getState().past).toHaveLength(1);
  const starter = POSTER_STARTERS[0];
  const created = createTemplateProject(starter.templateId, starter);
  expect(created.title).toBe(starter.name);
  expect(created.studio.poster.title.text).toBe(starter.name);
  expect(created.studio.poster.subtitle.text).toBe(starter.subtitle);
  expect(created.camera.center).toEqual(starter.center);
  expect(created.camera.zoom).toBe(starter.zoom);
  expect(created.layers).toHaveLength(1);
});
