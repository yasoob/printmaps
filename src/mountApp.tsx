import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import {
  createInitialProjectDocument,
  createNewProjectDocument,
} from './domain/project';
import {
  createIndexedDbAutosaveRepository,
  loadAutosavedProject,
} from './storage/autosave';

function createFallbackDocument() {
  return import.meta.env.VITE_TEST_INITIAL_PROJECT === 'true'
    ? createInitialProjectDocument()
    : createNewProjectDocument();
}

export async function mountApp() {
  const root = ReactDOM.createRoot(document.querySelector('#root')!);
  root.render(<main className="startup-loading" role="status">Loading local project…</main>);
  const repository = typeof indexedDB === 'undefined'
    ? null
    : createIndexedDbAutosaveRepository();
  const startup = await loadAutosavedProject(repository, createFallbackDocument);
  root.render(
    <App
      autosaveLoadError={startup.loadError}
      autosaveRepository={repository}
      initialDocument={startup.document}
    />,
  );
}
