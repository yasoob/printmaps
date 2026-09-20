import { useEffect, useRef, useState } from 'react';
import type { ProjectDocument } from '../domain/project';
import { projectAttributionText } from '../domain/projectAttributions';
import { publicAssetUrl } from '../domain/publicAssetUrl';
import { ProjectStoreContext, useProject, useProjectStoreApi } from '../app/projectStoreContext';
import { createProjectStore } from '../app/store';
import { downloadProjectDocument } from '../app/components/projectDownload';
import { createShareUrl, type SharedViewOptions } from './urls';
import { SharedMapPreview } from './SharedMapPreview';
import './sharing.css';

export function SharedProjectApp({ document, options, payload, onRemix }: {
  document: ProjectDocument;
  options: SharedViewOptions;
  payload: string;
  onRemix: (document: ProjectDocument) => Promise<void>;
}) {
  const [store] = useState(() => createProjectStore(document));
  return <ProjectStoreContext value={store}>
    <SharedProjectView options={options} payload={payload} onRemix={onRemix} />
  </ProjectStoreContext>;
}

function SharedProjectView({ options, payload, onRemix }: {
  options: SharedViewOptions;
  payload: string;
  onRemix: (document: ProjectDocument) => Promise<void>;
}) {
  const document = useProject((state) => state.document);
  const store = useProjectStoreApi();
  const [error, setError] = useState<string | null>(null);
  const [remixing, setRemixing] = useState(false);
  const activeRemix = useRef(false);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);
  const download = () => {
    try {
      downloadProjectDocument(store.getState().document);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The shared project could not be downloaded.');
    }
  };
  const remix = async () => {
    if (activeRemix.current) return;
    activeRemix.current = true;
    setRemixing(true);
    try {
      await onRemix(store.getState().document);
    } catch (error) {
      if (!isMounted.current) return;
      activeRemix.current = false;
      setRemixing(false);
      setError(error instanceof Error ? error.message : 'Your local project could not be restored. It has not been replaced.');
    }
  };
  return <main className="shared-project" data-shared-mode={options.embedded ? 'embed' : 'view'}>
    <header className="shared-header">
      <div><h1>{document.title}</h1><p>Read-only shared map</p></div>
      <nav aria-label="Shared map actions">
        {options.embedded
          ? <a href={createShareUrl(payload, { embedded: false, navigation: true })} target="_blank" rel="noopener noreferrer">Open full map</a>
          : <>
            <button type="button" className="secondary-button" onClick={download}>Download project</button>
            <button type="button" className="primary-button" disabled={remixing} onClick={() => void remix()}>{remixing ? 'Restoring local project…' : 'Remix this map'}</button>
          </>}
      </nav>
    </header>
    {error && <p className="shared-notice" role="alert">{error}</p>}
    <SharedMapPreview document={document} canNavigate={options.navigation} />
    <footer className="shared-footer">
      <a href={publicAssetUrl('')} target={options.embedded ? '_blank' : undefined} rel="noopener noreferrer">Made with Print Map Studio</a>
      <span>{projectAttributionText(document)}</span>
      <span>{options.navigation ? 'Pan and zoom are preview-only.' : 'Fixed map preview.'} Your local project is untouched.</span>
    </footer>
  </main>;
}

export function SharedProjectError({ message }: { message: string }) {
  return <main className="startup-error" role="alert">
    <h1>This shared map could not be opened</h1>
    <p>{message}</p>
    <p>Your local project has not been changed.</p>
    <a href={publicAssetUrl('editor/')}>Open my local project</a>
  </main>;
}
