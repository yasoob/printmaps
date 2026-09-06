import { Download, FileUp, Redo2, Undo2 } from 'lucide-react';
import { memo, useCallback, useRef, type RefObject } from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { ProjectDocument } from '../../domain/project';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { publicAssetUrl } from '../../domain/publicAssetUrl';
import type { LayerReplacementRequest, MapDataImportCommit } from '../hooks/useAppMapDataImport';
import { useProject, useProjectActions, useProjectStoreApi } from '../projectStoreContext';
import { GeoJsonImportButton } from './GeoJsonImportButton';
import { ProjectFileActions } from './ProjectFileActions';
import { ProjectTitleEditor } from './ProjectTitleEditor';
import { ProjectIdentityMenu } from './ProjectRenameDialog';
import { FileFeedbackGroup } from './FileFeedback';
import type { ProjectOpeningIntent } from '../hooks/useProjectOpening';

const LOGO_URL = publicAssetUrl('logo.png');
const HOME_URL = publicAssetUrl('');

type StudioHeaderProps = {
  projectTitleRef: RefObject<HTMLButtonElement | null>;
  exportButtonRef: RefObject<HTMLButtonElement | null>;
  importButtonRef: RefObject<HTMLButtonElement | null>;
  importInputRef: RefObject<HTMLInputElement | null>;
  openButtonRef?: RefObject<HTMLButtonElement | null>;
  finishImportWork: (workId: number) => void;
  isImportWorkActive: boolean;
  startImportWork: () => number | null;
  exportDisabled: boolean;
  importDisabled: boolean;
  importOpen: boolean;
  replacementRequest: LayerReplacementRequest | null;
  inert: boolean;
  isMobileViewport: boolean;
  onOpen: (document: ProjectDocument, intent?: ProjectOpeningIntent) => void;
  onImport: (commit: MapDataImportCommit) => ProjectMutationResult;
  onImportOpenChange: (isOpen: boolean) => void;
  onExport: () => void;
  onRenameProject: () => void;
};

const StudioBrand = memo(function StudioBrand({
  buttonRef,
  onChange,
  title,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  onChange: (title: string) => ProjectMutationResult;
  title: string;
}) {
  return (
    <div className="brand-block">
      <a className="studio-home-link" href={HOME_URL} aria-label="Print Map Studio home">
        <img className="brand-mark" alt="" height="32" src={LOGO_URL} width="48" />
        <span className="brand-name">Print Map Studio</span>
      </a>
      <ProjectTitleEditor buttonRef={buttonRef} title={title} onChange={onChange} />
    </div>
  );
});

const StudioProjectIdentity = memo(function StudioProjectIdentity({
  projectTitleRef,
}: {
  projectTitleRef: RefObject<HTMLButtonElement | null>;
}) {
  const { setProjectTitle } = useProjectActions();
  const title = useProject((state) => state.document.title);
  return (
    <StudioBrand
      buttonRef={projectTitleRef}
      title={title}
      onChange={setProjectTitle}
    />
  );
});

function HistoryActions({ presentation = 'toolbar' }: { presentation?: 'toolbar' | 'menu' }) {
  const { redo, undo } = useProjectActions();
  const canUndo = useProject((state) => state.canUndo);
  const canRedo = useProject((state) => state.canRedo);
  if (presentation === 'menu') {
    return (
      <>
        <DropdownMenuItem className="project-file-menu-item" disabled={!canUndo} onClick={undo}>
          <Undo2 aria-hidden="true" size={15} /> Undo
        </DropdownMenuItem>
        <DropdownMenuItem className="project-file-menu-item" disabled={!canRedo} onClick={redo}>
          <Redo2 aria-hidden="true" size={15} /> Redo
        </DropdownMenuItem>
      </>
    );
  }
  return (
    <div className="history-actions" aria-label="History">
      <button className="icon-button" type="button" aria-label="Undo" title="Undo" disabled={!canUndo} onClick={undo}><Undo2 size={15} /></button>
      <button className="icon-button" type="button" aria-label="Redo" title="Redo" disabled={!canRedo} onClick={redo}><Redo2 size={15} /></button>
    </div>
  );
}

export const StudioHeader = memo(function StudioHeader({
  projectTitleRef,
  exportButtonRef,
  importButtonRef,
  importInputRef,
  openButtonRef,
  finishImportWork,
  isImportWorkActive,
  startImportWork,
  exportDisabled,
  importDisabled,
  importOpen,
  replacementRequest,
  inert,
  isMobileViewport,
  onOpen,
  onImport,
  onImportOpenChange,
  onExport,
  onRenameProject,
}: StudioHeaderProps) {
  const store = useProjectStoreApi();
  const fallbackProjectRef = useRef<HTMLButtonElement>(null);
  const projectMenuRef = openButtonRef ?? fallbackProjectRef;
  // Read on demand so header renders stay independent of camera-rate document writes.
  const getDocument = useCallback(() => store.getState().document, [store]);

  return (
    <header className="topbar" inert={inert}>
      <StudioProjectIdentity projectTitleRef={projectTitleRef} />
      <HistoryActions />
      <div className="document-actions">
        <FileFeedbackGroup>
        <ProjectFileActions
          getDocument={getDocument}
          menuHeader={isMobileViewport ? <ProjectIdentityMenu onRename={onRenameProject} /> : undefined}
          openButtonRef={projectMenuRef}
          onOpen={onOpen}
        >
          <DropdownMenuItem
            className="project-file-menu-item"
            disabled={importDisabled || isImportWorkActive}
            onClick={() => importButtonRef.current?.click()}
          >
            <FileUp aria-hidden="true" size={15} /> Import map data
          </DropdownMenuItem>
          {isMobileViewport && <HistoryActions presentation="menu" />}
        </ProjectFileActions>
        <GeoJsonImportButton
          buttonRef={importButtonRef}
          inputRef={importInputRef}
          isDisabled={importDisabled}
          finishImportWork={finishImportWork}
          isOpen={importOpen}
          isWorkActive={isImportWorkActive}
          onImport={onImport}
          onOpenChange={onImportOpenChange}
          replacementRequest={replacementRequest}
          restoreFocusRef={projectMenuRef}
          startImportWork={startImportWork}
          presentation="headless"
        />
        </FileFeedbackGroup>
        <button ref={exportButtonRef} className="primary-button" type="button" disabled={exportDisabled} title={exportDisabled ? 'Finish or cancel map authoring before export' : undefined} onClick={onExport}><Download size={14} /><span>Export</span></button>
      </div>
    </header>
  );
});
