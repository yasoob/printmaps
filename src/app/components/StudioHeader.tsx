import { Download, PenLine, Redo2, Share2, Undo2 } from 'lucide-react';
import type { RefObject } from 'react';
import type { ProjectDocument } from '../../domain/project';
import type { ProjectState } from '../store';
import { ProjectFileOpenButton, ProjectSaveButton } from './ProjectFileActions';

type StudioHeaderProps = {
  project: ProjectState;
  projectTitleRef: RefObject<HTMLButtonElement | null>;
  exportButtonRef: RefObject<HTMLButtonElement | null>;
  inert: boolean;
  onOpen: (document: ProjectDocument) => void;
  onExport: () => void;
};

export function StudioHeader({ project, projectTitleRef, exportButtonRef, inert, onOpen, onExport }: StudioHeaderProps) {
  return (
    <header className="topbar" inert={inert}>
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true"><PenLine size={16} strokeWidth={2} /></div>
        <span className="brand-name">Print Map Studio</span><span className="top-divider" />
        <button ref={projectTitleRef} className="project-title" type="button">{project.document.title}</button>
      </div>
      <div className="history-actions" aria-label="History">
        <button className="icon-button" type="button" aria-label="Undo" title="Undo" disabled={!project.canUndo} onClick={project.undo}><Undo2 size={15} /></button>
        <button className="icon-button" type="button" aria-label="Redo" title="Redo" disabled={!project.canRedo} onClick={project.redo}><Redo2 size={15} /></button>
      </div>
      <div className="document-actions">
        <ProjectFileOpenButton onOpen={onOpen} />
        <ProjectSaveButton document={project.document} />
        <button className="quiet-button" type="button"><Share2 size={14} /> Share</button>
        <button ref={exportButtonRef} className="primary-button" type="button" onClick={onExport}><Download size={14} /> Export</button>
      </div>
    </header>
  );
}
