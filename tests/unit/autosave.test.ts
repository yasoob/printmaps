import 'fake-indexeddb/auto';
import {
  AUTOSAVE_RECORD_VERSION,
  AutosaveConflictError,
  AutosaveCorruptionError,
  createIndexedDbAutosaveRepository,
  getAutosaveFailureMessage,
} from '../../src/storage/autosave';
import { createInitialProjectDocument } from '../../src/domain/project';

const databaseNames: string[] = [];

function databaseName() {
  const name = `print-map-studio-test-${crypto.randomUUID()}`;
  databaseNames.push(name);
  return name;
}

async function replaceCurrentRecord(database: IDBDatabase, value: unknown) {
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('drafts', 'readwrite');
    transaction.objectStore('drafts').put(value, 'current');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function openDatabase(name: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  })));
});

describe('IndexedDB project autosave', () => {
  it('stores a versioned draft and reads a detached validated document', async () => {
    const repository = createIndexedDbAutosaveRepository({ databaseName: databaseName() });
    const document = createInitialProjectDocument();
    document.page = { preset: 'A3', widthMm: 420, heightMm: 297, orientation: 'landscape' };

    await repository.save(document, '2026-08-22T10:00:00.000Z');
    const draft = await repository.load();

    expect(draft).toEqual({
      recordVersion: AUTOSAVE_RECORD_VERSION,
      savedAt: '2026-08-22T10:00:00.000Z',
      document,
    });
    expect(draft?.document).not.toBe(document);

    document.page.widthMm = 1;
    expect(draft?.document.page.widthMm).toBe(420);
    repository.close();
  });

  it('rejects corrupt and unsupported records without treating them as projects', async () => {
    const name = databaseName();
    const repository = createIndexedDbAutosaveRepository({ databaseName: name });
    await repository.save(createInitialProjectDocument(), '2026-08-22T10:00:00.000Z');
    const database = await openDatabase(name);

    await replaceCurrentRecord(database, {
      recordVersion: 99,
      savedAt: 'not-a-date',
      document: { schemaVersion: 3 },
    });

    await expect(repository.load()).rejects.toBeInstanceOf(AutosaveCorruptionError);
    database.close();
    repository.close();
  });

  it('discards the current draft', async () => {
    const repository = createIndexedDbAutosaveRepository({ databaseName: databaseName() });
    await repository.save(createInitialProjectDocument(), '2026-08-22T10:00:00.000Z');

    await repository.discard();

    await expect(repository.load()).resolves.toBeNull();
    repository.close();
  });

  it('rejects a stale save instead of overwriting a newer tab', async () => {
    const name = databaseName();
    const firstTab = createIndexedDbAutosaveRepository({ databaseName: name });
    const secondTab = createIndexedDbAutosaveRepository({ databaseName: name });
    const verifier = createIndexedDbAutosaveRepository({ databaseName: name });
    const original = createInitialProjectDocument();
    const newer = { ...original, title: 'Newer tab edit' };
    const stale = { ...original, title: 'Stale tab edit' };

    await firstTab.save(original, '2026-08-22T10:00:00.000Z');
    await firstTab.load();
    await secondTab.load();
    await firstTab.save(newer, '2026-08-22T10:01:00.000Z');

    await expect(secondTab.save(stale, '2026-08-22T10:02:00.000Z'))
      .rejects.toBeInstanceOf(AutosaveConflictError);
    await expect(verifier.load()).resolves.toMatchObject({ document: { title: 'Newer tab edit' } });

    firstTab.close();
    secondTab.close();
    verifier.close();
  });

  it('rejects a stale discard instead of deleting a newer tab save', async () => {
    const name = databaseName();
    const firstTab = createIndexedDbAutosaveRepository({ databaseName: name });
    const secondTab = createIndexedDbAutosaveRepository({ databaseName: name });
    const verifier = createIndexedDbAutosaveRepository({ databaseName: name });
    const original = createInitialProjectDocument();
    const newer = { ...original, title: 'Do not discard me' };

    await firstTab.save(original, '2026-08-22T10:00:00.000Z');
    await firstTab.load();
    await secondTab.load();
    await firstTab.save(newer, '2026-08-22T10:01:00.000Z');

    await expect(secondTab.discard()).rejects.toBeInstanceOf(AutosaveConflictError);
    await expect(verifier.load()).resolves.toMatchObject({ document: { title: 'Do not discard me' } });

    firstTab.close();
    secondTab.close();
    verifier.close();
  });

  it('gives quota and generic storage failures actionable messages', () => {
    expect(getAutosaveFailureMessage(new DOMException('full', 'QuotaExceededError'))).toContain('storage is full');
    expect(getAutosaveFailureMessage({ name: 'QuotaExceededError' })).toContain('storage is full');
    expect(getAutosaveFailureMessage(new Error('offline'))).toContain('Save a project file');
    expect(getAutosaveFailureMessage(new AutosaveConflictError())).toContain('another tab');
  });
});
