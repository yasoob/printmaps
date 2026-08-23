import { useRef, useState } from 'react';
import { Archive, FolderOpen, Save } from 'lucide-react';
import type { ProjectDocument } from '../../domain/project';
import { parseProjectArchive } from '../../domain/projectArchive';
import { MAX_PROJECT_FILE_BYTES, parseProjectFileText } from '../../domain/projectFile';
import { downloadProjectArchive, downloadProjectDocument } from './projectDownload';

type ProjectFileStatus = {
  kind: 'success' | 'error';
  message: string;
};

type ProjectFileOpenButtonProps = {
  onOpen: (document: ProjectDocument) => void;
};

export function ProjectFileOpenButton({ onOpen }: ProjectFileOpenButtonProps) {
  const [status, setStatus] = useState<ProjectFileStatus | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const lowerName = file.name.toLowerCase();
      const isJson = lowerName.endsWith('.printmap.json');
      const isZip = lowerName.endsWith('.printmap.zip');
      if (!isJson && !isZip) {
        throw new Error('Choose a portable project ending in .printmap.json or .printmap.zip.');
      }
      if (file.size > MAX_PROJECT_FILE_BYTES) {
        throw new Error('Project files must be 10 MB or smaller.');
      }
      const openedDocument = isZip
        ? parseProjectArchive(new Uint8Array(await file.arrayBuffer()))
        : parseProjectFileText(await file.text());
      onOpen(openedDocument);
      setStatus({ kind: 'success', message: `Opened ${openedDocument.title}. Edit history was reset.` });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'This project file could not be opened.',
      });
    } finally {
      input.value = '';
      window.setTimeout(() => buttonRef.current?.focus(), 0);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        hidden
        type="file"
        accept=".printmap.json,.printmap.zip,application/json,application/zip"
        onChange={handleChange}
      />
      <button ref={buttonRef} className="quiet-button" type="button" onClick={() => inputRef.current?.click()}>
        <FolderOpen size={14} /> Open
      </button>
      {status && (
        <div
          className={`project-file-status${status.kind === 'error' ? ' is-error' : ''}`}
          role={status.kind === 'error' ? 'alert' : 'status'}
          aria-label="Project file status"
        >
          {status.message}
        </div>
      )}
    </>
  );
}

export function ProjectSaveButton({ document }: { document: ProjectDocument }) {
  const [error, setError] = useState<string | null>(null);
  const runDownload = (download: (value: ProjectDocument) => void) => {
    try {
      download(document);
      setError(null);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'This project could not be downloaded.');
    }
  };
  return (
    <>
      <button className="quiet-button" type="button" onClick={() => runDownload(downloadProjectDocument)}>
        <Save size={14} /> Save
      </button>
      <button className="quiet-button" type="button" onClick={() => runDownload(downloadProjectArchive)}>
        <Archive size={14} /> Save ZIP
      </button>
      {error && (
        <div className="project-file-status is-error" role="alert" aria-label="Project save status">
          {error}
        </div>
      )}
    </>
  );
}
