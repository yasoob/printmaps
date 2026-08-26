import { Download, PenLine, Redo2, Undo2 } from 'lucide-react';
import { memo, type RefObject } from 'react';
import type { ProjectDocument } from '../../domain/project';
import type { ProjectState } from '../store';
import type { LayerReplacementRequest, MapDataImportCommit } from '../hooks/useAppMapDataImport';
import { GeoJsonImportButton } from './GeoJsonImportButton';
import { ProjectFileActions } from './ProjectFileActions';
import { ProjectTitleEditor } from './ProjectTitleEditor';

type StudioHeaderProps = {
  project: ProjectState;
  projectTitleRef: RefObject<HTMLButtonElement | null>;
  exportButtonRef: RefObject<HTMLButtonElement | null>;
  importButtonRef: RefObject<HTMLButtonElement | null>;
  openButtonRef?: RefObject<HTMLButtonElement | null>;
  finishImportWork: (workId: number) => void;
  isImportWorkActive: boolean;
  startImportWork: () => number | null;
  exportDisabled: boolean;
  importDisabled: boolean;
  importOpen: boolean;
  replacementRequest: LayerReplacementRequest | null;
  inert: boolean;
  onOpen: (document: ProjectDocument) => void;
  onImport: (commit: MapDataImportCommit) => boolean;
  onImportOpenChange: (isOpen: boolean) => void;
  onExport: () => void;
};

const StudioBrand = memo(function StudioBrand({
  buttonRef,
  onChange,
  title,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  onChange: (title: string) => void;
  title: string;
}) {
  return (
    <div className="brand-block">
      <div className="brand-mark" aria-hidden="true"><PenLine size={16} strokeWidth={2} /></div>
      <span className="brand-name">Print Map Studio</span><span className="top-divider" />
      <ProjectTitleEditor buttonRef={buttonRef} title={title} onChange={onChange} />
    </div>
  );
});

function sameHeaderProps(previous: StudioHeaderProps, next: StudioHeaderProps) {
  const isProjectEqual = previous.project.document === next.project.document
    && previous.project.documentEpoch === next.project.documentEpoch
    && previous.project.canUndo === next.project.canUndo
    && previous.project.canRedo === next.project.canRedo
    && previous.project.setProjectTitle === next.project.setProjectTitle
    && previous.project.undo === next.project.undo
    && previous.project.redo === next.project.redo;
  if (!isProjectEqual) return false;
  return (Object.keys(previous) as (keyof StudioHeaderProps)[])
    .every((key) => key === 'project' || Object.is(previous[key], next[key]));
}

export const StudioHeader = memo(function StudioHeader({
  project,
  projectTitleRef,
  exportButtonRef,
  importButtonRef,
  openButtonRef,
  finishImportWork,
  isImportWorkActive,
  startImportWork,
  exportDisabled,
  importDisabled,
  importOpen,
  replacementRequest,
  inert,
  onOpen,
  onImport,
  onImportOpenChange,
  onExport,
}: StudioHeaderProps) {
  return (
    <header className="topbar" inert={inert}>
      <StudioBrand buttonRef={projectTitleRef} title={project.document.title} onChange={project.setProjectTitle} />
      <div className="history-actions" aria-label="History">
        <button className="icon-button" type="button" aria-label="Undo" title="Undo" disabled={!project.canUndo} onClick={project.undo}><Undo2 size={15} /></button>
        <button className="icon-button" type="button" aria-label="Redo" title="Redo" disabled={!project.canRedo} onClick={project.redo}><Redo2 size={15} /></button>
      </div>
      <div className="document-actions">
        <ProjectFileActions document={project.document} openButtonRef={openButtonRef} onOpen={onOpen} />
        <GeoJsonImportButton
          buttonRef={importButtonRef}
          isDisabled={importDisabled}
          documentEpoch={project.documentEpoch}
          finishImportWork={finishImportWork}
          isOpen={importOpen}
          isWorkActive={isImportWorkActive}
          onImport={onImport}
          onOpenChange={onImportOpenChange}
          replacementRequest={replacementRequest}
          sourceDocument={project.document}
          startImportWork={startImportWork}
        />
        <button ref={exportButtonRef} className="primary-button" type="button" disabled={exportDisabled} title={exportDisabled ? 'Finish or cancel map authoring before export' : undefined} onClick={onExport}><Download size={14} /> Export</button>
      </div>
    </header>
  );
}, sameHeaderProps);
