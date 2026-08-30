/* eslint-disable unicorn/prefer-add-event-listener -- These fixtures exercise IndexedDB request handler semantics directly. */
import 'fake-indexeddb/auto';
import {
  AUTOSAVE_RECORD_VERSION,
  AutosaveConflictError,
  AutosaveCorruptionError,
  AutosaveRevisionExhaustedError,
  createIndexedDbAutosaveRepository,
  getAutosaveFailureMessage,
  loadAutosavedProject,
  type AutosaveRepository,
} from '../../src/storage/autosave';
import {
  createInitialProjectDocument,
  createNewProjectDocument,
} from '../../src/domain/project';

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
    transaction.addEventListener('abort', () => reject(transaction.error));
  });
}

async function readCurrentRecord(database: IDBDatabase) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const transaction = database.transaction('drafts', 'readonly');
    const request = transaction.objectStore('drafts').get('current');
    request.onsuccess = () => resolve(request.result as Record<string, unknown>);
    request.onerror = () => reject(request.error);
  });
}

async function openDatabase(name: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function openDatabaseVersion(name: string, version: number) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteDatabase(name: string) {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database deletion was blocked.'));
  });
}

function repositoryWith(load: AutosaveRepository['load']): AutosaveRepository {
  return {
    load,
    save: vi.fn().mockResolvedValue(undefined),
    discard: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  };
}

afterEach(async () => {
  const names = [...databaseNames];
  databaseNames.length = 0;
  await Promise.all(names.map((name) => new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  })));
});

describe('autosave startup', () => {
  it('loads a valid local document without creating fallback state', async () => {
    const document = createInitialProjectDocument();
    document.title = 'Local project';
    const repository = repositoryWith(vi.fn().mockResolvedValue({
      recordVersion: AUTOSAVE_RECORD_VERSION,
      savedAt: '2026-08-22T10:00:00.000Z',
      document,
    }));
    const createFallback = vi.fn(createNewProjectDocument);

    const startup = await loadAutosavedProject(repository, createFallback);

    expect(startup).toEqual({ document, loadError: null });
    expect(createFallback).not.toHaveBeenCalled();
  });

  it('creates a new project only when no local document exists', async () => {
    const repository = repositoryWith(vi.fn().mockResolvedValue(null));

    const startup = await loadAutosavedProject(repository, createNewProjectDocument);

    expect(startup.loadError).toBeNull();
    expect(startup.document).toMatchObject({
      id: 'untitled-map',
      title: 'Untitled map',
      layers: [{ id: 'basemap', type: 'basemap' }],
    });
  });

  it('preserves a load failure so autosave remains disabled', async () => {
    const loadError = new Error('storage blocked');
    const repository = repositoryWith(vi.fn().mockRejectedValue(loadError));

    const startup = await loadAutosavedProject(repository, createNewProjectDocument);

    expect(startup.loadError).toBe(loadError);
    expect(startup.document.title).toBe('Untitled map');
  });
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

  it('restores a schema-21 autosave that used the legacy Letter preset ID', async () => {
    const name = databaseName();
    const repository = createIndexedDbAutosaveRepository({ databaseName: name });
    await repository.save(createInitialProjectDocument(), '2026-08-22T10:00:00.000Z');
    const database = await openDatabase(name);
    const record = await readCurrentRecord(database);
    const document = record.document as { page: { preset: string; widthMm: number; heightMm: number; orientation: string } };
    document.page = { preset: 'Letter', widthMm: 279.4, heightMm: 215.9, orientation: 'landscape' };
    await replaceCurrentRecord(database, record);
    database.close();

    await expect(repository.load()).resolves.toMatchObject({
      document: { page: { preset: 'US Letter', widthMm: 279.4, heightMm: 215.9 } },
    });
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

  it('discards the exact malformed-revision record after load reports corruption', async () => {
    const name = databaseName();
    const seed = createIndexedDbAutosaveRepository({ databaseName: name });
    await seed.save(createInitialProjectDocument(), '2026-08-22T10:00:00.000Z');
    seed.close();
    const database = await openDatabase(name);
    const seededRecord = await readCurrentRecord(database);
    await replaceCurrentRecord(database, { ...seededRecord, revision: 'malformed' });
    database.close();
    const repository = createIndexedDbAutosaveRepository({ databaseName: name });

    await expect(repository.load()).rejects.toBeInstanceOf(AutosaveCorruptionError);
    await expect(repository.discard()).resolves.toBeUndefined();
    await expect(repository.load()).resolves.toBeNull();

    repository.close();
  });

  it('rejects a stale corruption discard after another instance replaces the malformed record', async () => {
    const name = databaseName();
    const seed = createIndexedDbAutosaveRepository({ databaseName: name });
    await seed.save(createInitialProjectDocument(), '2026-08-22T10:00:00.000Z');
    seed.close();
    const database = await openDatabase(name);
    const seededRecord = await readCurrentRecord(database);
    await replaceCurrentRecord(database, { ...seededRecord, revision: 'malformed' });
    database.close();
    const stale = createIndexedDbAutosaveRepository({ databaseName: name });
    const replacement = createIndexedDbAutosaveRepository({ databaseName: name });
    const verifier = createIndexedDbAutosaveRepository({ databaseName: name });

    await expect(stale.load()).rejects.toBeInstanceOf(AutosaveCorruptionError);
    await expect(replacement.load()).rejects.toBeInstanceOf(AutosaveCorruptionError);
    await replacement.discard();
    await replacement.save(
      { ...createInitialProjectDocument(), title: 'Replacement after corruption' },
      '2026-08-22T10:01:00.000Z',
    );

    await expect(stale.discard()).rejects.toBeInstanceOf(AutosaveConflictError);
    await expect(verifier.load()).resolves.toMatchObject({
      document: { title: 'Replacement after corruption' },
    });

    stale.close();
    replacement.close();
    verifier.close();
  });

});

describe('IndexedDB project autosave revision integrity', () => {
  it('uses record identity to reject a stale operation after a tombstone revision ABA', async () => {
    const name = databaseName();
    const seed = createIndexedDbAutosaveRepository({ databaseName: name });
    await seed.save(createInitialProjectDocument(), '2026-08-22T10:00:00.000Z');
    seed.close();
    const stale = createIndexedDbAutosaveRepository({ databaseName: name });
    await stale.load();
    const database = await openDatabase(name);
    const seededRecord = await readCurrentRecord(database);
    await replaceCurrentRecord(database, { ...seededRecord, revision: 'malformed' });
    database.close();
    const replacement = createIndexedDbAutosaveRepository({ databaseName: name });
    const verifier = createIndexedDbAutosaveRepository({ databaseName: name });

    await expect(replacement.load()).rejects.toBeInstanceOf(AutosaveCorruptionError);
    await replacement.discard();
    await replacement.save(
      { ...createInitialProjectDocument(), title: 'Same revision, different epoch' },
      '2026-08-22T10:01:00.000Z',
    );

    const currentDatabase = await openDatabase(name);
    const currentRecord = await readCurrentRecord(currentDatabase);
    expect(currentRecord.revision).toBe(1);
    currentDatabase.close();
    await expect(stale.discard()).rejects.toBeInstanceOf(AutosaveConflictError);
    await expect(verifier.load()).resolves.toMatchObject({
      document: { title: 'Same revision, different epoch' },
    });

    stale.close();
    replacement.close();
    verifier.close();
  });

  it('allows the final safe save revision and rejects exhaustion without changing the record', async () => {
    const name = databaseName();
    const seed = createIndexedDbAutosaveRepository({ databaseName: name });
    await seed.save(createInitialProjectDocument(), '2026-08-22T10:00:00.000Z');
    seed.close();
    const database = await openDatabase(name);
    const seededRecord = await readCurrentRecord(database);
    await replaceCurrentRecord(database, {
      ...seededRecord,
      revision: Number.MAX_SAFE_INTEGER - 1,
    });
    database.close();
    const repository = createIndexedDbAutosaveRepository({ databaseName: name });
    await repository.load();

    await repository.save(
      { ...createInitialProjectDocument(), title: 'Final safe revision' },
      '2026-08-22T10:01:00.000Z',
    );
    const verifier = await openDatabase(name);
    const finalSafeRecord = await readCurrentRecord(verifier);
    expect(finalSafeRecord.revision).toBe(Number.MAX_SAFE_INTEGER);

    await expect(repository.save(
      { ...createInitialProjectDocument(), title: 'Unsafe revision' },
      '2026-08-22T10:02:00.000Z',
    )).rejects.toBeInstanceOf(AutosaveRevisionExhaustedError);
    expect(await readCurrentRecord(verifier)).toEqual(finalSafeRecord);

    verifier.close();
    repository.close();
  });

  it('allows the final safe discard revision and rejects exhaustion without changing the record', async () => {
    const name = databaseName();
    const seed = createIndexedDbAutosaveRepository({ databaseName: name });
    await seed.save(createInitialProjectDocument(), '2026-08-22T10:00:00.000Z');
    seed.close();
    const database = await openDatabase(name);
    const seededRecord = await readCurrentRecord(database);
    await replaceCurrentRecord(database, {
      ...seededRecord,
      revision: Number.MAX_SAFE_INTEGER - 1,
    });
    database.close();
    const repository = createIndexedDbAutosaveRepository({ databaseName: name });
    await repository.load();

    await repository.discard();
    const verifier = await openDatabase(name);
    const finalSafeRecord = await readCurrentRecord(verifier);
    expect(finalSafeRecord).toMatchObject({
      discarded: true,
      revision: Number.MAX_SAFE_INTEGER,
    });

    await expect(repository.discard()).rejects.toBeInstanceOf(AutosaveRevisionExhaustedError);
    expect(await readCurrentRecord(verifier)).toEqual(finalSafeRecord);

    verifier.close();
    repository.close();
  });

  it('clears a failed open so a later operation can retry', async () => {
    const name = databaseName();
    const request = {
      result: null,
      error: new DOMException('temporary failure', 'UnknownError'),
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      onblocked: null,
    } as unknown as IDBOpenDBRequest;
    const openSpy = vi.spyOn(indexedDB, 'open').mockReturnValueOnce(request);
    const repository = createIndexedDbAutosaveRepository({ databaseName: name });

    const loading = repository.load();
    request.onerror?.(new Event('error'));
    await expect(loading).rejects.toThrow('temporary failure');

    openSpy.mockRestore();
    await expect(repository.load()).resolves.toBeNull();
    repository.close();
  });

  it('closes a late successful connection after a blocked open and retries cleanly', async () => {
    const name = databaseName();
    const lateDatabase = { close: vi.fn() } as unknown as IDBDatabase;
    const request = {
      result: lateDatabase,
      error: null,
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      onblocked: null,
    } as unknown as IDBOpenDBRequest;
    const openSpy = vi.spyOn(indexedDB, 'open').mockReturnValueOnce(request);
    const repository = createIndexedDbAutosaveRepository({ databaseName: name });

    const loading = repository.load();
    request.onblocked?.(new Event('blocked') as IDBVersionChangeEvent);
    await expect(loading).rejects.toThrow('blocked by another tab');
    request.onsuccess?.(new Event('success'));

    expect(lateDatabase.close).toHaveBeenCalledTimes(1);
    openSpy.mockRestore();
    await expect(repository.load()).resolves.toBeNull();
    repository.close();
  });

  it('drops a versionchanged connection so a later open cannot reuse the closed handle', async () => {
    const name = databaseName();
    const repository = createIndexedDbAutosaveRepository({ databaseName: name });
    await repository.load();

    const upgradedDatabase = await openDatabaseVersion(name, 2);
    upgradedDatabase.close();
    await deleteDatabase(name);

    await expect(repository.load()).resolves.toBeNull();
    repository.close();
  });

  it('gives quota and generic storage failures actionable messages', () => {
    expect(getAutosaveFailureMessage(new DOMException('full', 'QuotaExceededError'))).toContain('storage is full');
    expect(getAutosaveFailureMessage({ name: 'QuotaExceededError' })).toContain('storage is full');
    expect(getAutosaveFailureMessage(new Error('offline'))).toContain('Save a project file');
    expect(getAutosaveFailureMessage(new AutosaveConflictError())).toContain('another tab');
    expect(getAutosaveFailureMessage(new AutosaveRevisionExhaustedError())).toContain('change history is exhausted');
  });
});
