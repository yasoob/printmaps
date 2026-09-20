import { createInitialProjectDocument } from '../../src/domain/project';
import { encodeSharedProject } from '../../src/sharing/codec';
import { createShareUrl } from '../../src/sharing/urls';
import { mountApp } from '../../src/mountApp';
import { createIndexedDbAutosaveRepository } from '../../src/storage/autosave';
import { SharedProjectApp, SharedProjectError } from '../../src/sharing/SharedProjectApp';
import { App } from '../../src/app/App';

const mocks = vi.hoisted(() => ({
  render: vi.fn(), load: vi.fn(), save: vi.fn(), close: vi.fn(), analytics: vi.fn(),
}));
vi.mock('react-dom/client', () => ({ default: { createRoot: () => ({ render: mocks.render }) } }));
vi.mock('../../src/storage/autosave', async (original) => ({
  ...await original<typeof import('../../src/storage/autosave')>(),
  createIndexedDbAutosaveRepository: vi.fn(() => ({ load: mocks.load, save: mocks.save, close: mocks.close })),
}));
vi.mock('../../src/analytics/editorAnalytics', () => ({ trackEditorAction: mocks.analytics }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('indexedDB', {});
  document.body.innerHTML = '<div id="root"></div>';
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

it.each(['#share=broken', '#embed=', '#SHARE=unknown', `#share=${'a'.repeat(65_537)}`])('invalid share startup never even opens autosave or analytics', async (hash) => {
  window.history.replaceState(null, '', `/editor/${hash}`);
  await mountApp();
  expect(mocks.render.mock.lastCall?.[0].type).toBe(SharedProjectError);
  expect(createIndexedDbAutosaveRepository).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.analytics).not.toHaveBeenCalled();
});

it('valid share and refresh remain read-only; only remix loads local state for confirmation', async () => {
  const shared = { ...createInitialProjectDocument(), title: 'Shared design' };
  const local = { ...createInitialProjectDocument(), title: 'Local design' };
  const url = createShareUrl(encodeSharedProject(shared), { embedded: false, navigation: true });
  window.history.replaceState(null, '', url);
  await mountApp();
  await mountApp();
  const rendered = mocks.render.mock.lastCall?.[0];
  expect(rendered.type).toBe(SharedProjectApp);
  expect(rendered.props.document).toEqual(shared);
  expect(createIndexedDbAutosaveRepository).not.toHaveBeenCalled();
  expect(mocks.analytics).not.toHaveBeenCalled();
  mocks.load.mockResolvedValue({ document: local, savedAt: new Date().toISOString(), recordVersion: 1 });
  await rendered.props.onRemix(shared);
  const editor = mocks.render.mock.lastCall?.[0];
  expect(editor.type).toBe(App);
  expect(editor.props.initialDocument).toEqual(local);
  expect(editor.props.remixDocument).toEqual(shared);
  expect(window.location.hash).toBe('');
  expect(mocks.save).not.toHaveBeenCalled();
});
