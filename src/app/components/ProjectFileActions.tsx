import { ChevronDown, Download, FolderKanban, FolderOpen } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { ProjectDocument } from '../../domain/project';
import { parseProjectArchive } from '../../domain/projectArchive';
import { MAX_PROJECT_FILE_BYTES, parseProjectFileText } from '../../domain/projectFile';
import { downloadProjectDocument } from './projectDownload';
import { focusFirstMenuItem, navigateMenu } from './menuKeyboard';

type ProjectFileStatus = {
  label: 'Project file status' | 'Project save status';
  message: string;
};

type ProjectFileActionsProps = {
  children?: ReactNode | ((menuContainer: HTMLElement | null) => ReactNode);
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
  const actionsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuContainer, setMenuContainer] = useState<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fallbackTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerRef = openButtonRef ?? fallbackTriggerRef;
  const closeMenu = useCallback(() => {
    setIsOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }, [triggerRef]);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const handleMenuClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const menuItem = event.target.closest('[role^="menuitem"]');
      if (menuItem && menuItem.getAttribute('aria-disabled') !== 'true') closeMenu();
    };
    menu.addEventListener('click', handleMenuClick, { capture: true });
    return () => menu.removeEventListener('click', handleMenuClick, { capture: true });
  }, [closeMenu]);

  useEffect(() => {
    if (!isOpen) return;
    focusFirstMenuItem(menuRef.current);
    const handlePointerDown = (event: PointerEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }
      navigateMenu(event, menuRef.current);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, triggerRef]);

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
    <div ref={actionsRef} className="project-file-actions">
      <input
        ref={inputRef}
        hidden
        type="file"
        accept=".printmap.json,.printmap.zip,application/json,application/zip"
        onChange={handleChange}
      />
      <button ref={triggerRef} className="quiet-button" type="button" aria-expanded={isOpen} aria-haspopup="menu" onClick={() => setIsOpen((current) => !current)}>
        <FolderKanban aria-hidden="true" size={14} strokeWidth={1.8} /> Project <ChevronDown aria-hidden="true" size={12} />
      </button>
      <div ref={menuRef} className="project-file-menu" role="menu" aria-label="Project actions" hidden={!isOpen}>
        <button type="button" role="menuitem" onClick={() => inputRef.current?.click()}><FolderOpen aria-hidden="true" size={15} /> Open project</button>
        <button type="button" role="menuitem" onClick={saveProject}><Download aria-hidden="true" size={15} /> Download project</button>
        <div ref={setMenuContainer} className="project-file-import-slot">{typeof children === 'function' ? null : children}</div>
      </div>
      {typeof children === 'function' ? children(menuContainer) : null}
      {status && (
        <div className="project-file-status is-error" role="alert" aria-label={status.label}>
          {status.message}
        </div>
      )}
    </div>
  );
}
