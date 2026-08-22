/* eslint-disable unicorn/prefer-add-event-listener -- IndexedDB requests expose one-shot handler slots used for deterministic transaction settlement. */
import type { ProjectDocument } from '../domain/project';
import { parseProjectFileText } from '../domain/projectFile';
import { IndexedDbConnection } from './IndexedDbConnection';

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

export class AutosaveConflictError extends Error {
  constructor(message = 'The local autosave changed in another tab.') {
    super(message);
    this.name = 'AutosaveConflictError';
  }
}

export class AutosaveRevisionExhaustedError extends Error {
  constructor(message = 'The local autosave change history is exhausted.') {
    super(message);
    this.name = 'AutosaveRevisionExhaustedError';
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
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.')));
  });
}

async function transactionRequest<T>(request: IDBRequest<T>, complete: Promise<void>) {
  try {
    return await requestResult(request);
  } catch (error) {
    await ignoreFailure(complete);
    throw error;
  }
}

async function ignoreFailure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch {
    // The caller is already reporting the primary request or conflict failure.
  }
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

function storedRevision(value: unknown) {
  if (value === undefined) return 0;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AutosaveCorruptionError();
  }
  const revision = (value as Record<string, unknown>).revision;
  if (revision === undefined) return 0;
  if (!Number.isSafeInteger(revision) || Number(revision) < 0) {
    throw new AutosaveCorruptionError('The local autosave has an invalid storage revision.');
  }
  return Number(revision);
}

function isDiscardedRecord(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.discarded !== true) return false;
  if (record.recordVersion !== AUTOSAVE_RECORD_VERSION || record.revision === undefined) {
    throw new AutosaveCorruptionError();
  }
  return true;
}

type StoredIdentity = {
  recordId: string | null;
  revision: number | null;
};

function newRecordId() {
  return crypto.randomUUID();
}

function storedIdentity(value: unknown): StoredIdentity {
  if (value === undefined) return { recordId: null, revision: 0 };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { recordId: null, revision: null };
  }
  const record = value as Record<string, unknown>;
  const recordId = typeof record.recordId === 'string' && record.recordId.length > 0
    ? record.recordId
    : null;
  let revision: number | null = null;
  try {
    revision = storedRevision(value);
  } catch {
    // A unique record ID still makes a malformed revision safe to compare and discard.
  }
  return { recordId, revision };
}

function isSameStoredIdentity(left: StoredIdentity, right: StoredIdentity) {
  return left.recordId === right.recordId && left.revision === right.revision;
}

function addRecordIdentity(value: unknown) {
  const recordId = newRecordId();
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>), recordId };
  }
  return {
    recordVersion: AUTOSAVE_RECORD_VERSION,
    recordId,
    revision: 'malformed',
    corruptedValue: value,
  };
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
  if (errorName === 'AutosaveConflictError' || reason instanceof AutosaveConflictError) {
    return 'Autosave paused because this draft changed in another tab. Reload to review the newer draft before continuing.';
  }
  if (
    errorName === 'AutosaveRevisionExhaustedError'
    || reason instanceof AutosaveRevisionExhaustedError
  ) {
    return 'Autosave paused because its local change history is exhausted. Use Save to download a project file, then clear this site’s local data.';
  }
  return 'Autosave is unavailable. Save a project file to keep a portable copy of your work.';
}

export function createIndexedDbAutosaveRepository({
  databaseName = DEFAULT_DATABASE_NAME,
}: { databaseName?: string } = {}): AutosaveRepository {
  const connection = new IndexedDbConnection(databaseName, AUTOSAVE_DATABASE_VERSION, AUTOSAVE_STORE);
  let knownIdentity: StoredIdentity | undefined;

  return {
    async load() {
      const db = await connection.get();
      const transaction = db.transaction(AUTOSAVE_STORE, 'readwrite');
      const complete = transactionComplete(transaction);
      const store = transaction.objectStore(AUTOSAVE_STORE);
      let value = await transactionRequest(store.get(CURRENT_DRAFT_KEY), complete);
      const identity = storedIdentity(value);
      if (value !== undefined && identity.recordId === null) {
        value = addRecordIdentity(value);
        store.put(value, CURRENT_DRAFT_KEY);
      }
      await complete;
      knownIdentity = storedIdentity(value);
      storedRevision(value);
      if (value === undefined || isDiscardedRecord(value)) return null;
      return validatedDraft(value);
    },
    async save(document, savedAt = new Date().toISOString()) {
      const record = validatedDraft({
        recordVersion: AUTOSAVE_RECORD_VERSION,
        savedAt,
        document,
      });
      const db = await connection.get();
      const transaction = db.transaction(AUTOSAVE_STORE, 'readwrite');
      const complete = transactionComplete(transaction);
      const store = transaction.objectStore(AUTOSAVE_STORE);
      const current = await transactionRequest(store.get(CURRENT_DRAFT_KEY), complete);
      const currentIdentity = storedIdentity(current);
      if (knownIdentity !== undefined && !isSameStoredIdentity(currentIdentity, knownIdentity)) {
        transaction.abort();
        await ignoreFailure(complete);
        throw new AutosaveConflictError();
      }
      const currentRevision = storedRevision(current);
      if (currentRevision === Number.MAX_SAFE_INTEGER) {
        transaction.abort();
        await ignoreFailure(complete);
        throw new AutosaveRevisionExhaustedError();
      }
      const nextRevision = currentRevision + 1;
      const recordId = newRecordId();
      store.put({ ...record, recordId, revision: nextRevision }, CURRENT_DRAFT_KEY);
      await complete;
      knownIdentity = { recordId, revision: nextRevision };
    },
    async discard() {
      const db = await connection.get();
      const transaction = db.transaction(AUTOSAVE_STORE, 'readwrite');
      const complete = transactionComplete(transaction);
      const store = transaction.objectStore(AUTOSAVE_STORE);
      const current = await transactionRequest(store.get(CURRENT_DRAFT_KEY), complete);
      const currentIdentity = storedIdentity(current);
      if (knownIdentity !== undefined && !isSameStoredIdentity(currentIdentity, knownIdentity)) {
        transaction.abort();
        await ignoreFailure(complete);
        throw new AutosaveConflictError();
      }
      let nextRevision: number;
      try {
        const currentRevision = storedRevision(current);
        if (currentRevision === Number.MAX_SAFE_INTEGER) {
          transaction.abort();
          await ignoreFailure(complete);
          throw new AutosaveRevisionExhaustedError();
        }
        nextRevision = currentRevision + 1;
      } catch (error) {
        if (!(error instanceof AutosaveCorruptionError)) throw error;
        nextRevision = 0;
      }
      const recordId = newRecordId();
      store.put({
        recordVersion: AUTOSAVE_RECORD_VERSION,
        recordId,
        revision: nextRevision,
        discarded: true,
      }, CURRENT_DRAFT_KEY);
      await complete;
      knownIdentity = { recordId, revision: nextRevision };
    },
    close() {
      connection.close();
    },
  };
}
