import { Download, PenLine, Redo2, Share2, Undo2 } from 'lucide-react';
import type { RefObject } from 'react';
import type { ContentLayer, ProjectDocument } from '../../domain/project';
import type { ProjectState } from '../store';
import { GeoJsonImportButton } from './GeoJsonImportButton';
import { ProjectFileOpenButton, ProjectSaveButton } from './ProjectFileActions';

type StudioHeaderProps = {
  project: ProjectState;
  projectTitleRef: RefObject<HTMLButtonElement | null>;
  exportButtonRef: RefObject<HTMLButtonElement | null>;
  exportDisabled: boolean;
  inert: boolean;
  onOpen: (document: ProjectDocument) => void;
  onImport: (layers: readonly ContentLayer[], documentEpoch: number) => boolean;
  onExport: () => void;
};

export function StudioHeader({
  project,
  projectTitleRef,
  exportButtonRef,
  exportDisabled,
  inert,
  onOpen,
  onImport,
  onExport,
}: StudioHeaderProps) {
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
        <GeoJsonImportButton
          key={project.documentEpoch}
          documentEpoch={project.documentEpoch}
          existingLayerIds={project.document.layers.map((layer) => layer.id)}
          onImport={onImport}
        />
        <ProjectSaveButton document={project.document} />
        <button className="quiet-button" type="button"><Share2 size={14} /> Share</button>
        <button ref={exportButtonRef} className="primary-button" type="button" disabled={exportDisabled} title={exportDisabled ? 'Finish or cancel route drawing before export' : undefined} onClick={onExport}><Download size={14} /> Export</button>
      </div>
    </header>
  );
}
