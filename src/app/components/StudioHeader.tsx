import { Download, FileUp, Info, Redo2, Undo2 } from 'lucide-react';
import { memo, useCallback, useRef, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
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
import { ShareControl } from '../../sharing/ShareControl';
import { IconTooltip } from './IconTooltip';

const LOGO_URL = publicAssetUrl('logo.png');
const OUTPUT_BLOCKED_HINT_ID = 'header-output-blocked-hint';
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
  // Visible, described reason why Share and Export are unavailable; undefined when they can run.
  outputBlockedReason?: string;
  importDisabled: boolean;
  importOpen: boolean;
  replacementRequest: LayerReplacementRequest | null;
  inert: boolean;
  isMobileViewport: boolean;
  onOpen: (document: ProjectDocument, intent?: ProjectOpeningIntent) => void;
  onNewFromTemplate?: () => void;
  onImport: (commit: MapDataImportCommit) => ProjectMutationResult;
  onImportOpenChange: (isOpen: boolean) => void;
  onExport: () => void;
  onRenameProject: () => void;
};

const IS_APPLE_PLATFORM = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
const UNDO_SHORTCUT = IS_APPLE_PLATFORM ? '⌘Z' : 'Ctrl+Z';
const REDO_SHORTCUT = IS_APPLE_PLATFORM ? '⇧⌘Z' : 'Ctrl+Shift+Z';

function HistoryMenuItems() {
  const { redo, undo } = useProjectActions();
  const canUndo = useProject((state) => state.canUndo);
  const canRedo = useProject((state) => state.canRedo);
  return (
    <>
      <DropdownMenuSeparator className="project-file-menu-separator" />
      <DropdownMenuItem className="project-file-menu-item" disabled={!canUndo} onClick={undo}>
        <Undo2 aria-hidden="true" size={15} /> Undo
      </DropdownMenuItem>
      <DropdownMenuItem className="project-file-menu-item" disabled={!canRedo} onClick={redo}>
        <Redo2 aria-hidden="true" size={15} /> Redo
      </DropdownMenuItem>
    </>
  );
}

// Each toolbar button subscribes to its own flag, so the first edit enables Undo without re-rendering Redo.
const UndoButton = memo(function UndoButton() {
  const { undo } = useProjectActions();
  const canUndo = useProject((state) => state.canUndo);
  return (
    <IconTooltip label="Undo" shortcut={UNDO_SHORTCUT}>
      <Button variant="ghost" size="icon" aria-label="Undo" disabled={!canUndo} onClick={undo}><Undo2 aria-hidden="true" size={16} strokeWidth={1.75} /></Button>
    </IconTooltip>
  );
});

const RedoButton = memo(function RedoButton() {
  const { redo } = useProjectActions();
  const canRedo = useProject((state) => state.canRedo);
  return (
    <IconTooltip label="Redo" shortcut={REDO_SHORTCUT}>
      <Button variant="ghost" size="icon" aria-label="Redo" disabled={!canRedo} onClick={redo}><Redo2 aria-hidden="true" size={16} strokeWidth={1.75} /></Button>
    </IconTooltip>
  );
});

function HistoryActions({ presentation = 'toolbar' }: { presentation?: 'toolbar' | 'menu' }) {
  if (presentation === 'menu') return <HistoryMenuItems />;
  return (
    <div className="history-actions" aria-label="History">
      <UndoButton />
      <RedoButton />
    </div>
  );
}

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
      <HistoryActions />
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

export const StudioHeader = memo(function StudioHeader({
  projectTitleRef,
  exportButtonRef,
  importButtonRef,
  importInputRef,
  openButtonRef,
  finishImportWork,
  isImportWorkActive,
  startImportWork,
  outputBlockedReason,
  importDisabled,
  importOpen,
  replacementRequest,
  inert,
  isMobileViewport,
  onOpen,
  onNewFromTemplate,
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
      <div className="document-actions">
        {outputBlockedReason && (
          <span id={OUTPUT_BLOCKED_HINT_ID} className="header-blocked-hint">
            <Info aria-hidden="true" size={14} strokeWidth={1.8} />
            <span className="header-blocked-hint-full">{outputBlockedReason}</span>
            <span className="header-blocked-hint-short" aria-hidden="true">Finish drawing to export</span>
          </span>
        )}
        <FileFeedbackGroup>
        <ProjectFileActions
          getDocument={getDocument}
          menuHeader={isMobileViewport ? <ProjectIdentityMenu onRename={onRenameProject} /> : undefined}
          openButtonRef={projectMenuRef}
          onOpen={onOpen}
          onNewFromTemplate={onNewFromTemplate}
        >
          <DropdownMenuSeparator className="project-file-menu-separator" />
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
        <ShareControl disabled={Boolean(outputBlockedReason) || importDisabled || isImportWorkActive} describedBy={outputBlockedReason ? OUTPUT_BLOCKED_HINT_ID : undefined} />
        <button ref={exportButtonRef} className="primary-button" type="button" disabled={Boolean(outputBlockedReason)} aria-describedby={outputBlockedReason ? OUTPUT_BLOCKED_HINT_ID : undefined} onClick={onExport}><Download size={14} strokeWidth={1.8} aria-hidden="true" /><span>Export</span></button>
      </div>
    </header>
  );
});
