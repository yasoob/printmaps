import type { ProjectDocument } from '../domain/project';
import { parseProjectFileText } from '../domain/projectFile';

export const AUTOSAVE_RECORD_VERSION = 1 as const;
const AUTOSAVE_DATABASE_VERSION = 1;
const AUTOSAVE_STORE = 'drafts';
const CURRENT_DRAFT_KEY = 'current';
const DEFAULT_DATABASE_NAME = 'print-map-studio';

export type AutosaveDraft = {
  recordVersion: typeof AUTOSAVE_RECORD_VERSION;
  savedAt: string;
  document: ProjectDocument;
};

export type AutosaveRepository = {
  load: () => Promise<AutosaveDraft | null>;
  save: (document: ProjectDocument, savedAt?: string) => Promise<void>;
  discard: () => Promise<void>;
  close: () => void;
};

export class AutosaveCorruptionError extends Error {
  constructor(message = 'The local autosave is damaged or uses an unsupported version.') {
    super(message);
    this.name = 'AutosaveCorruptionError';
  }
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
  });
}

function validatedDraft(value: unknown): AutosaveDraft {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AutosaveCorruptionError();
  }
  const record = value as Record<string, unknown>;
  if (record.recordVersion !== AUTOSAVE_RECORD_VERSION) {
    throw new AutosaveCorruptionError('The local autosave uses an unsupported storage version.');
  }
  if (typeof record.savedAt !== 'string' || !Number.isFinite(Date.parse(record.savedAt))) {
    throw new AutosaveCorruptionError('The local autosave has an invalid save time.');
  }
  try {
    return {
      recordVersion: AUTOSAVE_RECORD_VERSION,
      savedAt: record.savedAt,
      document: parseProjectFileText(JSON.stringify(record.document)),
    };
  } catch {
    throw new AutosaveCorruptionError();
  }
}

export function getAutosaveFailureMessage(reason: unknown) {
  const errorName = typeof reason === 'object' && reason !== null && 'name' in reason
    ? String(reason.name)
    : '';
  if (
    errorName === 'QuotaExceededError'
    || errorName === 'NS_ERROR_DOM_QUOTA_REACHED'
  ) {
    return 'Autosave paused because browser storage is full. Use Save to download a project file, then free browser storage.';
  }
  return 'Autosave is unavailable. Save a project file to keep a portable copy of your work.';
}

export function createIndexedDbAutosaveRepository({
  databaseName = DEFAULT_DATABASE_NAME,
}: { databaseName?: string } = {}): AutosaveRepository {
  let openDatabase: Promise<IDBDatabase> | null = null;

  const database = () => {
    if (!openDatabase) {
      openDatabase = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, AUTOSAVE_DATABASE_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(AUTOSAVE_STORE)) {
            request.result.createObjectStore(AUTOSAVE_STORE);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Could not open local project storage.'));
        request.onblocked = () => reject(new Error('Local project storage is blocked by another tab.'));
      });
    }
    return openDatabase;
  };

  return {
    async load() {
      const db = await database();
      const transaction = db.transaction(AUTOSAVE_STORE, 'readonly');
      const value = await requestResult(transaction.objectStore(AUTOSAVE_STORE).get(CURRENT_DRAFT_KEY));
      await transactionComplete(transaction);
      return value === undefined ? null : validatedDraft(value);
    },
    async save(document, savedAt = new Date().toISOString()) {
      const record = validatedDraft({
        recordVersion: AUTOSAVE_RECORD_VERSION,
        savedAt,
        document,
      });
      const db = await database();
      const transaction = db.transaction(AUTOSAVE_STORE, 'readwrite');
      transaction.objectStore(AUTOSAVE_STORE).put(record, CURRENT_DRAFT_KEY);
      await transactionComplete(transaction);
    },
    async discard() {
      const db = await database();
      const transaction = db.transaction(AUTOSAVE_STORE, 'readwrite');
      transaction.objectStore(AUTOSAVE_STORE).delete(CURRENT_DRAFT_KEY);
      await transactionComplete(transaction);
    },
    close() {
      if (openDatabase) void openDatabase.then((db) => db.close(), () => undefined);
      openDatabase = null;
    },
  };
}
