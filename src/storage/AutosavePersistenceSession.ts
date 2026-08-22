import type { StoreApi } from 'zustand';
import type { ProjectState } from '../app/store';
import { AutosaveCorruptionError, getAutosaveFailureMessage, type AutosaveDraft, type AutosaveRepository } from './autosave';

type ProjectDocument = ProjectState['document'];
type AutosavePhase = 'loading' | 'recovery' | 'ready' | 'disabled';
type RefValue<T> = { current: T };
type SaveIntent = { document: ProjectDocument; revision: number; isLifecycle: boolean };

type AutosavePersistenceOptions = {
  repository: AutosaveRepository;
  store: StoreApi<ProjectState>;
  generation: object;
  phaseRef: RefValue<AutosavePhase>;
  mountedRef: RefValue<boolean>;
  pendingDocumentRef: RefValue<ProjectDocument | null>;
  scheduleSaveRef: RefValue<((document: ProjectDocument) => void) | null>;
  decisionPendingRef: RefValue<boolean>;
  onLoaded: (generation: object, draft: AutosaveDraft | null) => void;
  onLoadFailed: (generation: object, error: unknown, isCorrupted: boolean) => void;
  onSaveStarted: () => void;
  onSaveSucceeded: () => void;
  onSaveFailed: (error: unknown) => void;
};

export class AutosavePersistenceSession {
  private isActive = true;
  private isClosing = false;
  private isClosed = false;
  private saveTimer: number | null = null;
  private saveRevision = 0;
  private isSaveInFlight = false;
  private debouncedDocument: ProjectDocument | null = null;
  private pendingSaveIntent: SaveIntent | null = null;
  private unsubscribe = () => {};
  private readonly handlePagehide = () => this.flushDebouncedSave(true);
  private readonly scheduleSave = (document: ProjectDocument) => {
    this.options.pendingDocumentRef.current = null;
    this.debouncedDocument = document;
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    const revision = ++this.saveRevision;
    this.options.onSaveStarted();
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.debouncedDocument = null;
      this.queueSave(document, revision);
    }, 300);
  };

  constructor(private readonly options: AutosavePersistenceOptions) {}

  private async loadDraft() {
    const { generation, onLoaded, onLoadFailed, pendingDocumentRef, phaseRef, repository } = this.options;
    try {
      const draft = await repository.load();
      if (!this.isActive) return;
      phaseRef.current = draft ? 'recovery' : 'ready';
      onLoaded(generation, draft);
      if (!draft && pendingDocumentRef.current) this.scheduleSave(pendingDocumentRef.current);
    } catch (error) {
      if (!this.isActive) return;
      const isCorrupted = error instanceof AutosaveCorruptionError;
      phaseRef.current = isCorrupted ? 'recovery' : 'disabled';
      onLoadFailed(generation, error, isCorrupted);
    }
  }

  private queueSave(document: ProjectDocument, revision: number, isLifecycle = false) {
    this.pendingSaveIntent = { document, revision, isLifecycle };
    this.startNextSave();
  }

  private startNextSave() {
    if (this.isSaveInFlight) return;
    const intent = this.pendingSaveIntent;
    if (!intent || (!this.isActive && !intent.isLifecycle)) return;
    this.pendingSaveIntent = null;
    this.isSaveInFlight = true;
    void this.performSave(intent);
  }

  private async performSave(intent: SaveIntent) {
    try {
      await this.options.repository.save(intent.document);
      if (this.isActive && intent.revision === this.saveRevision) this.options.onSaveSucceeded();
    } catch (error) {
      if (this.isActive && intent.revision === this.saveRevision) this.options.onSaveFailed(error);
    } finally {
      this.isSaveInFlight = false;
      if (this.isActive || this.pendingSaveIntent?.isLifecycle) this.startNextSave();
      else this.pendingSaveIntent = null;
      this.closeIfIdle();
    }
  }

  private flushDebouncedSave(shouldPromotePending: boolean) {
    if (this.saveTimer !== null && this.debouncedDocument) {
      const document = this.debouncedDocument;
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
      this.debouncedDocument = null;
      this.queueSave(document, this.saveRevision, true);
      return;
    }
    if (shouldPromotePending && this.pendingSaveIntent) {
      this.pendingSaveIntent = { ...this.pendingSaveIntent, isLifecycle: true };
      this.startNextSave();
    }
  }

  private closeIfIdle() {
    if (!(this.isClosing && !this.isClosed && !this.isSaveInFlight && this.pendingSaveIntent === null)) return;
    this.isClosed = true;
    this.options.repository.close();
  }

  private stop() {
    this.isActive = false;
    this.isClosing = true;
    this.options.mountedRef.current = false;
    this.unsubscribe();
    this.options.scheduleSaveRef.current = null;
    window.removeEventListener('pagehide', this.handlePagehide);
    const handoffDocument = this.debouncedDocument ?? this.pendingSaveIntent?.document;
    if (handoffDocument) this.options.pendingDocumentRef.current = handoffDocument;
    this.flushDebouncedSave(false);
    this.closeIfIdle();
  }

  start() {
    const { decisionPendingRef, mountedRef, phaseRef, scheduleSaveRef, store } = this.options;
    mountedRef.current = true;
    phaseRef.current = 'loading';
    decisionPendingRef.current = false;
    scheduleSaveRef.current = this.scheduleSave;
    window.addEventListener('pagehide', this.handlePagehide);
    void this.loadDraft();
    this.unsubscribe = store.subscribe((state, previousState) => {
      if (state.document === previousState.document) return;
      if (phaseRef.current === 'loading' || phaseRef.current === 'recovery') {
        this.options.pendingDocumentRef.current = state.document;
        return;
      }
      if (phaseRef.current === 'ready') this.scheduleSave(state.document);
    });
    return () => this.stop();
  }
}

export function autosaveLoadFailureMessage(error: unknown, isCorrupted: boolean) {
  return isCorrupted
    ? 'The local autosave is damaged or unsupported. Discard it before autosave can continue.'
    : getAutosaveFailureMessage(error);
}
