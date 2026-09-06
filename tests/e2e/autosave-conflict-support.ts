import { buffer } from 'node:stream/consumers';
import { expect, type Download, type Page } from '@playwright/test';
import type { AutosaveDraft } from '../../src/storage/autosave';
import type { ProjectDocument } from '../../src/domain/project';

declare global {
  interface Window {
    conflictInstrumentation: { puts: number; readHeld: boolean; releaseRead?: () => void };
  }
}

export async function storedDraft(page: Page): Promise<AutosaveDraft & { recordId: string; revision: number }> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('print-map-studio', 1);
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    try {
      return await new Promise((resolve, reject) => {
        const request = database.transaction('drafts').objectStore('drafts').get('current');
        request.addEventListener('success', () => resolve(request.result), { once: true });
        request.addEventListener('error', () => reject(request.error), { once: true });
      });
    } finally {
      database.close();
    }
  }) as Promise<AutosaveDraft & { recordId: string; revision: number }>;
}

export async function downloadDocument(download: Download): Promise<ProjectDocument> {
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Download stream unavailable');
  const contents = await buffer(stream);
  return JSON.parse(contents.toString('utf8'));
}

export async function trackWrites(page: Page) {
  await page.evaluate(() => {
    Object.assign(window, { conflictInstrumentation: { puts: 0, readHeld: false } });
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.name === 'drafts') window.conflictInstrumentation.puts += 1;
      return key === undefined ? put.call(this, value) : put.call(this, value, key);
    };
  });
}

export async function openConflict(loser: Page) {
  await loser.goto('./');
  await loser.getByRole('button', { name: 'Portrait', exact: true }).click();
  await expect(loser.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  const winner = await loser.context().newPage();
  await winner.goto('./');
  await expect(winner.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave ready');
  await winner.getByRole('combobox', { name: 'Page preset' }).selectOption('A3');
  await expect(winner.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  const saved = await storedDraft(winner);
  expect(saved.document.page.preset).toBe('A3');
  await trackWrites(loser);
  await loser.getByRole('combobox', { name: 'Page preset' }).selectOption('A5');
  await expect(loser.getByRole('status', { name: 'Autosave conflict notice' })).toBeVisible();
  await expect(loser.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave paused');
  return { winner, saved };
}

export async function reviewConflict(page: Page) {
  const notice = page.locator('.conflict-autosave-notice');
  if (await notice.getAttribute('open') === null) await notice.locator('summary').click();
  await page.getByRole('button', { name: 'Review autosave conflict' }).click();
  const dialog = page.getByRole('dialog', { name: 'Keep this tab’s version?' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  return dialog;
}

export async function holdNextRead(page: Page) {
  await page.evaluate(() => {
    const prototype = IDBTransaction.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'oncomplete');
    if (!descriptor?.set) throw new Error('IndexedDB completion setter unavailable');
    Object.defineProperty(prototype, 'oncomplete', {
      ...descriptor,
      set(this: IDBTransaction, callback: (event: Event) => void) {
        if (!this.objectStoreNames.contains('drafts')) {
          descriptor.set!.call(this, callback);
          return;
        }
        Object.defineProperty(prototype, 'oncomplete', descriptor);
        descriptor.set!.call(this, (event: Event) => {
          window.conflictInstrumentation.readHeld = true;
          window.conflictInstrumentation.releaseRead = () => {
            window.conflictInstrumentation.readHeld = false;
            callback.call(this, event);
          };
        });
      },
    });
  });
}

export async function dismissReload(page: Page) {
  const prompting = page.waitForEvent('dialog');
  const reloading = page.evaluate(() => window.location.reload());
  const prompt = await prompting;
  expect(prompt.type()).toBe('beforeunload');
  await prompt.dismiss();
  await reloading;
}
