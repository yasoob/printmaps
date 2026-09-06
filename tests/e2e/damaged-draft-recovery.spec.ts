import { buffer } from 'node:stream/consumers';
import { expect, test, type Download, type Page } from '@playwright/test';

const damagedRecord = {
  recordVersion: 99, recordId: 'ux-027-original', revision: 3,
  savedAt: '2026-09-04T12:00:00.000Z',
  document: { schemaVersion: 900, title: 'Potentially recoverable map', layers: [{ name: 'Keep my data' }] },
};

declare global {
  interface Window {
    recoveryInstrumentation: { puts: number };
  }
}

async function draftRecord(page: Page, replacement?: unknown) {
  return page.evaluate(async ({ replacement }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('print-map-studio', 1);
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const transaction = database.transaction('drafts', replacement === undefined ? 'readonly' : 'readwrite');
        const store = transaction.objectStore('drafts');
        const request = replacement === undefined ? store.get('current') : store.put(replacement, 'current');
        transaction.addEventListener('complete', () => resolve(request.result), { once: true });
        transaction.addEventListener('error', () => reject(transaction.error), { once: true });
        transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
      });
    } finally {
      database.close();
    }
  }, { replacement });
}

async function openRecovery(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeVisible();
  await draftRecord(page, damagedRecord);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Local draft unavailable' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue without autosave' })).toBeFocused();
}

async function downloadJson(download: Download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Download stream unavailable');
  const contents = await buffer(stream);
  return JSON.parse(contents.toString('utf8'));
}

async function recoveryDownload(page: Page) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download recovery data', exact: true }).click();
  return downloading;
}

async function trackWrites(page: Page, shouldFailDiscard: boolean) {
  await page.evaluate((shouldFailDiscard) => {
    const put = IDBObjectStore.prototype.put;
    let hasFailed = false;
    Object.assign(window, { recoveryInstrumentation: { puts: 0 } });
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.name === 'drafts') {
        window.recoveryInstrumentation.puts += 1;
        if (shouldFailDiscard && !hasFailed && typeof value === 'object' && value !== null && 'discarded' in value && value.discarded === true) {
          hasFailed = true;
          throw new DOMException('Controlled full storage failure', 'QuotaExceededError');
        }
      }
      return key === undefined ? put.call(this, value) : put.call(this, value, key);
    };
  }, shouldFailDiscard);
}

test('downloads the captured data and continues without overwriting it; new work has a native exit warning', async ({ page }, testInfo) => {
  await openRecovery(page);
  await trackWrites(page, false);
  const backup = await recoveryDownload(page);
  expect(backup.suggestedFilename()).toBe('local-draft-recovery.json');
  await backup.saveAs(testInfo.outputPath('ux-fix-027-recovery-data.json'));
  expect(await downloadJson(backup)).toEqual(damagedRecord);
  await expect(page.getByRole('dialog')).toContainText('not a portable project');
  expect(await draftRecord(page)).toEqual(damagedRecord);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-027-recovery-choice.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Continue without autosave' }).click();
  await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeFocused();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave off');
  const offlineNotice = page.getByRole('status', { name: 'Offline autosave notice' });
  await expect(offlineNotice).toBeVisible();
  await offlineNotice.click();
  await expect(page.getByText(/New work is not saved locally/)).toBeVisible();
  await offlineNotice.click();
  const search = page.getByRole('combobox', { name: 'Search places and addresses' });
  await search.click();
  await expect(search).toBeFocused();
  await page.getByRole('button', { name: 'Portrait', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Download project', exact: true }).click();
  const current = await downloadJson(await downloading);
  expect(current.page.orientation).toBe('portrait');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  expect(await draftRecord(page)).toEqual(damagedRecord);
  expect(await page.evaluate(() => window.recoveryInstrumentation.puts)).toBe(0);
  const prompting = page.waitForEvent('dialog');
  const reloading = page.evaluate(() => window.location.reload());
  const warning = await prompting;
  expect(warning.type()).toBe('beforeunload');
  await warning.dismiss();
  await reloading;
  await expect(page.getByRole('button', { name: 'Portrait', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: testInfo.outputPath('ux-fix-027-offline-work.png'), animations: 'disabled' });
  const acceptedPrompt = page.waitForEvent('dialog');
  const acceptedReload = page.reload();
  const acceptedWarning = await acceptedPrompt;
  await acceptedWarning.accept();
  await acceptedReload;
  await expect(page.getByRole('dialog', { name: 'Local draft unavailable' })).toBeVisible();
  expect(await draftRecord(page)).toEqual(damagedRecord);
});

test('failed discard offers reachable recovery actions and a subsequent retry resumes autosave', async ({ page }, testInfo) => {
  await openRecovery(page);
  await trackWrites(page, true);
  await page.getByRole('button', { name: 'Discard damaged draft' }).click();
  await expect(page.getByRole('alert', { name: 'Autosave status' })).toContainText('Browser storage is full');
  await expect(page.getByRole('button', { name: 'Continue without autosave' })).toBeFocused();
  expect(await draftRecord(page)).toEqual(damagedRecord);
  expect(await downloadJson(await recoveryDownload(page))).toEqual(damagedRecord);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-027-discard-failed.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Discard damaged draft' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave ready');
  await page.getByRole('button', { name: 'Portrait', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  expect(await draftRecord(page)).toMatchObject({ recordVersion: 1, document: { page: { orientation: 'portrait' } } });
});

test('a recovery download failure still permits continuation after a failed discard', async ({ page }) => {
  await openRecovery(page);
  await trackWrites(page, true);
  await page.getByRole('button', { name: 'Discard damaged draft' }).click();
  await expect(page.getByRole('alert', { name: 'Autosave status' })).toContainText('Browser storage is full');
  await page.evaluate(() => {
    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob) => {
      if (blob instanceof File && blob.name === 'local-draft-recovery.json') {
        URL.createObjectURL = createObjectURL;
        throw new Error('Controlled recovery download failure');
      }
      return createObjectURL(blob);
    };
  });
  await page.getByRole('button', { name: 'Download recovery data' }).click();
  await expect(page.getByRole('alert', { name: 'Recovery download status' })).toHaveText('Controlled recovery download failure');
  await page.getByRole('button', { name: 'Continue without autosave' }).click();
  await page.getByRole('button', { name: 'Portrait', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  expect(await draftRecord(page)).toEqual(damagedRecord);
  expect(await page.evaluate(() => window.recoveryInstrumentation.puts)).toBe(1);
});

test('recovery download stays tied to its captured record and cannot discard a later record', async ({ page }) => {
  await openRecovery(page);
  const newer = { ...damagedRecord, recordId: 'newer-tab', revision: 4, document: { title: 'Newer version' } };
  await draftRecord(page, newer);
  expect(await downloadJson(await recoveryDownload(page))).toEqual(damagedRecord);
  await page.getByRole('button', { name: 'Discard damaged draft' }).click();
  await expect(page.getByRole('alert', { name: 'Autosave status' })).toContainText('changed in another tab');
  expect(await draftRecord(page)).toEqual(newer);
  await page.getByRole('button', { name: 'Continue without autosave' }).click();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave off');
});

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`recovery choices and keyboard focus remain usable at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await openRecovery(page);
    const dialog = page.getByRole('dialog', { name: 'Local draft unavailable' });
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Download recovery data' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    const details = page.getByRole('region', { name: 'Local draft recovery details' });
    await expect(details).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Discard damaged draft' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(details).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Download recovery data' })).toBeFocused();
    const buttons = await dialog.getByRole('button').all();
    for (const button of buttons) {
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    await trackWrites(page, true);
    await page.getByRole('button', { name: 'Discard damaged draft' }).click();
    await expect(page.getByRole('button', { name: 'Continue without autosave' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(details).toBeFocused();
    await details.press('End');
    await expect.poll(() => details.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(page.getByRole('alert', { name: 'Autosave status' })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('ux-fix-027-recovery-responsive.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Continue without autosave' }).click();
    await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeFocused();
    await expect(page.getByRole('status', { name: 'Offline autosave notice' })).toBeVisible();
    const search = page.getByRole('combobox', { name: 'Search places and addresses' });
    await search.click();
    await expect(search).toBeFocused();
  });
}
