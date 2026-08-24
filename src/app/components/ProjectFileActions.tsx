import { Archive, ChevronDown, Download, FolderOpen } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ProjectDocument } from '../../domain/project';
import { parseProjectArchive } from '../../domain/projectArchive';
import { MAX_PROJECT_FILE_BYTES, parseProjectFileText } from '../../domain/projectFile';
import { downloadProjectArchive, downloadProjectDocument } from './projectDownload';

type ProjectFileStatus = {
  kind: 'success' | 'error';
  label: 'Project file status' | 'Project save status';
  message: string;
};

type ProjectFileMenuProps = {
  document: ProjectDocument;
  onOpen: (document: ProjectDocument) => void;
  title: string;
  triggerRef?: RefObject<HTMLButtonElement | null>;
};

async function parseOpenedProject(file: File) {
  const lowerName = file.name.toLowerCase();
  const isJson = lowerName.endsWith('.printmap.json');
  const isZip = lowerName.endsWith('.printmap.zip');
  if (!isJson && !isZip) {
    throw new Error('Choose a portable project ending in .printmap.json or .printmap.zip.');
  }
  if (file.size > MAX_PROJECT_FILE_BYTES) {
    throw new Error('Project files must be 10 MB or smaller.');
  }
  return isZip
    ? parseProjectArchive(new Uint8Array(await file.arrayBuffer()))
    : parseProjectFileText(await file.text());
}

function useOutsidePointerDismiss(
  isOpen: boolean,
  menuRef: RefObject<HTMLDivElement | null>,
  triggerRef: RefObject<HTMLButtonElement | null>,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) onDismiss();
    };
    globalThis.document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => globalThis.document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [isOpen, menuRef, onDismiss, triggerRef]);
}

function handleProjectMenuKeyDown(
  event: React.KeyboardEvent<HTMLDivElement>,
  menu: HTMLDivElement | null,
  onEscape: () => void,
) {
  if (event.key === 'Escape') {
    event.preventDefault();
    onEscape();
    return;
  }
  const items = [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
    return;
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  const currentIndex = items.indexOf(globalThis.document.activeElement as HTMLElement);
  const direction = event.key === 'ArrowDown' ? 1 : -1;
  items[(currentIndex + direction + items.length) % items.length]?.focus();
}

type ProjectFileMenuListProps = {
  menuRef: RefObject<HTMLDivElement | null>;
  onDownload: (download: (value: ProjectDocument) => void) => void;
  onEscape: () => void;
  onOpen: () => void;
};

function ProjectFileMenuList({ menuRef, onDownload, onEscape, onOpen }: ProjectFileMenuListProps) {
  return (
    <div ref={menuRef} className="project-file-menu" role="menu" aria-label="Project file menu" onKeyDown={(event) => handleProjectMenuKeyDown(event, menuRef.current, onEscape)}>
      <button type="button" role="menuitem" onClick={onOpen}><FolderOpen aria-hidden="true" size={16} strokeWidth={1.75} /> Open project</button>
      <button type="button" role="menuitem" onClick={() => onDownload(downloadProjectDocument)}><Download aria-hidden="true" size={16} strokeWidth={1.75} /> Download project</button>
      <button type="button" role="menuitem" onClick={() => onDownload(downloadProjectArchive)}><Archive aria-hidden="true" size={16} strokeWidth={1.75} /> Download project archive</button>
    </div>
  );
}

export function ProjectFileMenu({ document: projectDocument, onOpen, title, triggerRef }: ProjectFileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ProjectFileStatus | null>(null);
  const localTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resolvedTriggerRef = triggerRef ?? localTriggerRef;

  const focusTrigger = () => queueMicrotask(() => resolvedTriggerRef.current?.focus());
  const focusMenuItem = (position: 'first' | 'last' = 'first') => {
    queueMicrotask(() => {
      const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
      items?.[position === 'first' ? 0 : items.length - 1]?.focus();
    });
  };
  const openMenu = (position: 'first' | 'last' = 'first') => {
    setIsOpen(true);
    focusMenuItem(position);
  };
  const closeMenu = (shouldRestoreFocus = true) => {
    setIsOpen(false);
    if (shouldRestoreFocus) focusTrigger();
  };
  useOutsidePointerDismiss(isOpen, menuRef, resolvedTriggerRef, () => setIsOpen(false));

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const openedDocument = await parseOpenedProject(file);
      onOpen(openedDocument);
      setStatus({ kind: 'success', label: 'Project file status', message: `Opened ${openedDocument.title}. Edit history was reset.` });
    } catch (error) {
      setStatus({
        kind: 'error',
        label: 'Project file status',
        message: error instanceof Error ? error.message : 'This project file could not be opened.',
      });
    } finally {
      input.value = '';
      window.setTimeout(() => resolvedTriggerRef.current?.focus(), 0);
    }
  };

  const chooseProjectFile = () => {
    setIsOpen(false);
    inputRef.current?.click();
    window.setTimeout(() => resolvedTriggerRef.current?.focus(), 0);
  };

  const runDownload = (download: (value: ProjectDocument) => void) => {
    try {
      download(projectDocument);
      setStatus(null);
    } catch (downloadError) {
      setStatus({
        kind: 'error',
        label: 'Project save status',
        message: downloadError instanceof Error ? downloadError.message : 'This project could not be downloaded.',
      });
    } finally {
      closeMenu();
    }
  };

  return (
    <div className="project-file-menu-wrap">
      <input
        ref={inputRef}
        hidden
        type="file"
        accept=".printmap.json,.printmap.zip,application/json,application/zip"
        onChange={handleChange}
      />
      <button
        ref={resolvedTriggerRef}
        className="project-title"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => (isOpen ? closeMenu(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          openMenu(event.key === 'ArrowUp' ? 'last' : 'first');
        }}
      >
        <span>{title}</span><ChevronDown aria-hidden="true" size={14} strokeWidth={1.75} />
      </button>
      {isOpen && <ProjectFileMenuList menuRef={menuRef} onDownload={runDownload} onEscape={closeMenu} onOpen={chooseProjectFile} />}
      {status && (
        <div
          className={`project-file-status${status.kind === 'error' ? ' is-error' : ''}`}
          role={status.kind === 'error' ? 'alert' : 'status'}
          aria-label={status.label}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
