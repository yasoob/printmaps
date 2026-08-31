import { ChevronDown, Download, FolderKanban, FolderOpen } from 'lucide-react';
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ProjectDocument } from '../../domain/project';
import { parseProjectArchive } from '../../domain/projectArchive';
import { MAX_PROJECT_FILE_BYTES, parseProjectFileText } from '../../domain/projectFile';
import { downloadProjectDocument } from './projectDownload';

type ProjectFileStatus = {
  label: 'Project file status' | 'Project save status';
  message: string;
};

type ProjectFileActionsProps = {
  children?: ReactNode;
  getDocument: () => ProjectDocument;
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

export function ProjectFileActions({ children, getDocument, openButtonRef, onOpen }: ProjectFileActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ProjectFileStatus | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fallbackTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerRef = openButtonRef ?? fallbackTriggerRef;

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
      setIsOpen(false);
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    }
  };

  const saveProject = () => {
    try {
      downloadProjectDocument(getDocument());
      setStatus(null);
    } catch (error) {
      setStatus({
        label: 'Project save status',
        message: error instanceof Error ? error.message : 'This project could not be downloaded.',
      });
    } finally {
      setIsOpen(false);
      queueMicrotask(() => triggerRef.current?.focus());
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
      <DropdownMenu
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) queueMicrotask(() => triggerRef.current?.focus());
        }}
        onOpenChangeComplete={(open) => {
          if (open) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])')?.focus();
        }}
      >
        <DropdownMenuTrigger
          render={(
            <button
              ref={triggerRef}
              className="quiet-button"
              type="button"
              onMouseDown={() => { if (!isOpen) setIsOpen(true); }}
            >
              <FolderKanban aria-hidden="true" size={14} strokeWidth={1.8} /> Project <ChevronDown aria-hidden="true" size={12} />
            </button>
          )}
        />
        <DropdownMenuContent ref={menuRef} className="project-file-menu" align="end" aria-label="Project actions" aria-labelledby="">
          <DropdownMenuItem className="project-file-menu-item" onClick={() => inputRef.current?.click()}>
            <FolderOpen aria-hidden="true" size={15} /> Open project
          </DropdownMenuItem>
          <DropdownMenuItem className="project-file-menu-item" onClick={saveProject}>
            <Download aria-hidden="true" size={15} /> Download project
          </DropdownMenuItem>
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
      {status && (
        <div className="project-file-status is-error" role="alert" aria-label={status.label}>
          {status.message}
        </div>
      )}
    </div>
  );
}
