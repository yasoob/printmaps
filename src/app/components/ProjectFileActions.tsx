import { Download, FolderOpen } from 'lucide-react';
import { useRef, useState, type RefObject } from 'react';
import type { ProjectDocument } from '../../domain/project';
import { parseProjectArchive } from '../../domain/projectArchive';
import { MAX_PROJECT_FILE_BYTES, parseProjectFileText } from '../../domain/projectFile';
import { downloadProjectDocument } from './projectDownload';

type ProjectFileStatus = {
  label: 'Project file status' | 'Project save status';
  message: string;
};

type ProjectFileActionsProps = {
  document: ProjectDocument;
  openButtonRef?: RefObject<HTMLButtonElement | null>;
  onOpen: (document: ProjectDocument) => void;
};

async function parseOpenedProject(file: File) {
  const lowerName = file.name.toLowerCase();
  const isJson = lowerName.endsWith('.printmap.json');
  const isZip = lowerName.endsWith('.printmap.zip');
  if (!isJson && !isZip) {
    throw new Error('Choose a portable project ending in .printmap.json or .printmap.zip.');
  }
  if (file.size > MAX_PROJECT_FILE_BYTES) throw new Error('Project files must be 10 MB or smaller.');
  return isZip
    ? parseProjectArchive(new Uint8Array(await file.arrayBuffer()))
    : parseProjectFileText(await file.text());
}

export function ProjectFileActions({ document: projectDocument, openButtonRef, onOpen }: ProjectFileActionsProps) {
  const [status, setStatus] = useState<ProjectFileStatus | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fallbackOpenButtonRef = useRef<HTMLButtonElement>(null);
  const resolvedOpenButtonRef = openButtonRef ?? fallbackOpenButtonRef;
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const openedDocument = await parseOpenedProject(file);
      onOpen(openedDocument);
      setStatus(null);
    } catch (error) {
      setStatus({
        label: 'Project file status',
        message: error instanceof Error ? error.message : 'This project file could not be opened.',
      });
    } finally {
      input.value = '';
      window.setTimeout(() => resolvedOpenButtonRef.current?.focus(), 0);
    }
  };

  const saveProject = () => {
    try {
      downloadProjectDocument(projectDocument);
      setStatus(null);
    } catch (error) {
      setStatus({
        label: 'Project save status',
        message: error instanceof Error ? error.message : 'This project could not be downloaded.',
      });
    } finally {
      queueMicrotask(() => saveButtonRef.current?.focus());
    }
  };

  return (
    <div className="project-file-actions">
      <input
        ref={inputRef}
        hidden
        type="file"
        accept=".printmap.json,.printmap.zip,application/json,application/zip"
        onChange={handleChange}
      />
      <button ref={resolvedOpenButtonRef} className="quiet-button" type="button" onClick={() => inputRef.current?.click()}>
        <FolderOpen aria-hidden="true" size={14} strokeWidth={1.8} /> Open
      </button>
      <button ref={saveButtonRef} className="quiet-button" type="button" onClick={saveProject}>
        <Download aria-hidden="true" size={14} strokeWidth={1.8} /> Save
      </button>
      {status && (
        <div className="project-file-status is-error" role="alert" aria-label={status.label}>
          {status.message}
        </div>
      )}
    </div>
  );
}
