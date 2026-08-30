import { Download, PenLine, Redo2, Undo2 } from 'lucide-react';
import { memo, useCallback, type RefObject } from 'react';
import type { ProjectDocument } from '../../domain/project';
import type { LayerReplacementRequest, MapDataImportCommit } from '../hooks/useAppMapDataImport';
import { useProject, useProjectActions, useProjectStoreApi } from '../projectStoreContext';
import { GeoJsonImportButton } from './GeoJsonImportButton';
import { ProjectFileActions } from './ProjectFileActions';
import { ProjectTitleEditor } from './ProjectTitleEditor';

type StudioHeaderProps = {
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

export const StudioHeader = memo(function StudioHeader({
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
  const store = useProjectStoreApi();
  const { redo, setProjectTitle, undo } = useProjectActions();
  const title = useProject((state) => state.document.title);
  const canUndo = useProject((state) => state.canUndo);
  const canRedo = useProject((state) => state.canRedo);
  // Read on demand so header renders stay independent of camera-rate document writes.
  const getDocument = useCallback(() => store.getState().document, [store]);

  return (
    <header className="topbar" inert={inert}>
      <StudioBrand buttonRef={projectTitleRef} title={title} onChange={setProjectTitle} />
      <div className="history-actions" aria-label="History">
        <button className="icon-button" type="button" aria-label="Undo" title="Undo" disabled={!canUndo} onClick={undo}><Undo2 size={15} /></button>
        <button className="icon-button" type="button" aria-label="Redo" title="Redo" disabled={!canRedo} onClick={redo}><Redo2 size={15} /></button>
      </div>
      <div className="document-actions">
        <ProjectFileActions getDocument={getDocument} openButtonRef={openButtonRef} onOpen={onOpen}>
          {(menuContainer) => <GeoJsonImportButton
            buttonRef={importButtonRef}
            isDisabled={importDisabled}
            finishImportWork={finishImportWork}
            isOpen={importOpen}
            isWorkActive={isImportWorkActive}
            onImport={onImport}
            onOpenChange={onImportOpenChange}
            replacementRequest={replacementRequest}
            restoreFocusRef={openButtonRef}
            startImportWork={startImportWork}
            presentation="menuitem"
            triggerContainer={menuContainer}
          />}
        </ProjectFileActions>
        <button ref={exportButtonRef} className="primary-button" type="button" disabled={exportDisabled} title={exportDisabled ? 'Finish or cancel map authoring before export' : undefined} onClick={onExport}><Download size={14} /><span>Export</span></button>
      </div>
    </header>
  );
});
