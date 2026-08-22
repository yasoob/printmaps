import { useRef, useState } from 'react';
import { FolderOpen, Save } from 'lucide-react';
import type { ProjectDocument } from '../../domain/project';
import { MAX_PROJECT_FILE_BYTES, parseProjectFileText } from '../../domain/projectFile';
import { downloadProjectDocument } from './projectDownload';

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
      if (!file.name.toLowerCase().endsWith('.printmap.json')) {
        throw new Error('Choose a portable project with the .printmap.json filename suffix.');
      }
      if (file.size > MAX_PROJECT_FILE_BYTES) {
        throw new Error('Project files must be 10 MB or smaller.');
      }
      const openedDocument = parseProjectFileText(await file.text());
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
        accept=".printmap.json,application/json"
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
  return (
    <button className="quiet-button" type="button" onClick={() => downloadProjectDocument(document)}>
      <Save size={14} /> Save
    </button>
  );
}
