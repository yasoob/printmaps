import type { StoreApi } from 'zustand';
import type { ProjectState } from '../app/store';
import type { ProjectDocument } from '../domain/project';
import type { AutosaveRepository } from './autosave';

type SaveIntent = { document: ProjectDocument; revision: number; isLifecycle: boolean };

type AutosavePersistenceOptions = {
  repository: AutosaveRepository;
  store: StoreApi<ProjectState>;
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
    this.unsubscribe();
    window.removeEventListener('pagehide', this.handlePagehide);
    this.flushDebouncedSave(false);
    this.closeIfIdle();
  }

  start() {
    const { store } = this.options;
    window.addEventListener('pagehide', this.handlePagehide);
    this.unsubscribe = store.subscribe((state, previousState) => {
      if (state.document === previousState.document) return;
      this.scheduleSave(state.document);
    });
    return () => this.stop();
  }
}
