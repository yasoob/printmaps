import ReactDOM from 'react-dom/client';
import { trackEditorAction } from './analytics/editorAnalytics';
import { App } from './app/App';
import {
  createInitialProjectDocument,
  createNewProjectDocument,
  type ProjectDocument,
} from './domain/project';
import {
  createIndexedDbAutosaveRepository,
  loadAutosavedProject,
} from './storage/autosave';
import { decodeSharedProject } from './sharing/codec';
import { isSharedProjectHash, parseSharedHash } from './sharing/urls';
import { SharedProjectApp, SharedProjectError } from './sharing/SharedProjectApp';

function createFallbackDocument() {
  return import.meta.env.VITE_TEST_INITIAL_PROJECT === 'true'
    ? createInitialProjectDocument()
    : createNewProjectDocument();
}

export async function mountApp() {
  const root = ReactDOM.createRoot(document.querySelector('#root')!);
  const initialHash = window.location.hash;
  window.addEventListener('hashchange', () => {
    if (isSharedProjectHash(initialHash) || isSharedProjectHash(window.location.hash)) window.location.reload();
  });
  const openEditor = async (remixDocument?: ProjectDocument) => {
    const repository = typeof indexedDB === 'undefined' ? null : createIndexedDbAutosaveRepository();
    const startup = await loadAutosavedProject(repository, createFallbackDocument);
    if (window.location.hash !== initialHash) {
      repository?.close();
      return;
    }
    if (remixDocument) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    root.render(<App autosaveLoadError={startup.loadError} autosaveRepository={repository}
      initialDocument={startup.document} remixDocument={remixDocument} />);
    if (!remixDocument) trackEditorAction('editorOpened');
  };
  if (isSharedProjectHash(initialHash)) {
    try {
      const { options, payload } = parseSharedHash(initialHash);
      const document = decodeSharedProject(payload);
      root.render(<SharedProjectApp document={document} options={options} payload={payload} onRemix={openEditor} />);
    } catch (error) {
      root.render(<SharedProjectError message={error instanceof Error ? error.message : 'The shared map is invalid.'} />);
    }
    return;
  }
  root.render(<main className="startup-loading" role="status">Loading local project…</main>);
  await openEditor();
}
