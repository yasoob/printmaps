/* eslint-disable unicorn/prefer-add-event-listener -- IndexedDB open requests use one-shot handler slots and tests drive those exact browser callbacks. */
export class IndexedDbConnection {
  private opening: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly databaseName: string,
    private readonly databaseVersion: number,
    private readonly storeName: string,
  ) {}

  private async closeWhenOpen(opening: Promise<IDBDatabase>) {
    try {
      const database = await opening;
      database.close();
    } catch {
      // A failed or blocked open has no connection to close.
    }
  }

  private open() {
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, this.databaseVersion);
      let isSettled = false;
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(this.storeName)) request.result.createObjectStore(this.storeName);
      };
      request.onsuccess = () => {
        if (isSettled) {
          request.result.close();
          return;
        }
        isSettled = true;
        request.result.onversionchange = () => {
          request.result.close();
          if (this.opening === opening) this.opening = null;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        if (isSettled) return;
        isSettled = true;
        if (this.opening === opening) this.opening = null;
        reject(request.error ?? new Error('Could not open local project storage.'));
      };
      request.onblocked = () => {
        if (isSettled) return;
        isSettled = true;
        if (this.opening === opening) this.opening = null;
        reject(new Error('Local project storage is blocked by another tab.'));
      };
    });
    return opening;
  }

  get() {
    if (!this.opening) this.opening = this.open();
    return this.opening;
  }

  close() {
    const opening = this.opening;
    if (opening) void this.closeWhenOpen(opening);
    this.opening = null;
  }
}
