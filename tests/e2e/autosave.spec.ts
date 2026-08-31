/* eslint-disable unicorn/prefer-add-event-listener, unicorn/no-global-object-property-assignment, unicorn/no-optional-chaining-on-undeclared-variable -- Browser-realm IndexedDB instrumentation must patch native handlers and a page-local release hook. */
import { expect, test } from '@playwright/test';

test('autosaves to IndexedDB and restores the local project automatically', async ({ page }) => {
  await page.goto('./');
  const autosaveStatus = page.getByRole('status', { name: 'Autosave status' });
  await expect(autosaveStatus).toHaveText('Autosave ready');
  await page.getByRole('radio', { name: /^Night Ink:/ }).click();
  await page.getByRole('spinbutton', { name: 'Bearing' }).fill('-20');
  await page.getByRole('spinbutton', { name: 'Pitch' }).fill('35');
  await page.getByRole('spinbutton', { name: 'Pitch' }).press('Tab');
  await page.getByRole('spinbutton', { name: 'Text scale' }).fill('135');
  await page.getByRole('spinbutton', { name: 'Text scale' }).press('Tab');
  await page.getByRole('checkbox', { name: 'Show labels' }).uncheck();
  await page.getByRole('checkbox', { name: 'Show land detail' }).uncheck();
  await page.getByRole('combobox', { name: 'Map language' }).selectOption('de');
  await page.getByRole('button', { name: 'Portrait' }).click();
  const mapCanvas = page.getByTestId('map-canvas');
  await expect(mapCanvas).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const centerBeforePan = await mapCanvas.getAttribute('data-map-center');
  const canvasBox = await page.locator('.maplibregl-canvas').boundingBox();
  expect(centerBeforePan).toBeTruthy();
  expect(canvasBox).not.toBeNull();
  await page.mouse.move(canvasBox!.x + 30, canvasBox!.y + 30);
  await page.mouse.down();
  await page.mouse.move(canvasBox!.x + 110, canvasBox!.y + 70, { steps: 6 });
  await page.mouse.up();
  await expect(mapCanvas).not.toHaveAttribute('data-map-center', centerBeforePan!);
  const pannedCenter = await mapCanvas.getAttribute('data-map-center');
  await expect(autosaveStatus).toHaveText('All changes saved locally');

  await page.reload();

  await expect(page.getByRole('dialog', { name: 'Recover local draft' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('spinbutton', { name: 'Bearing' })).toHaveValue('-20');
  await expect(page.getByRole('spinbutton', { name: 'Pitch' })).toHaveValue('35');
  await expect(page.getByRole('radio', { name: /^Night Ink:/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('combobox', { name: 'Map language' })).toHaveValue('de');
  await expect(page.getByRole('spinbutton', { name: 'Text scale' })).toHaveValue('135');
  await expect(page.getByRole('checkbox', { name: 'Show labels' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Show land detail' })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-center', pannedCenter!);

  const context = page.context();
  await page.close();
  const verificationPage = await context.newPage();
  await verificationPage.goto('./');
  await expect(verificationPage.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave ready');
  await expect(verificationPage.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
  await expect(verificationPage.getByRole('dialog', { name: 'Recover local draft' })).toHaveCount(0);
});

test('contains a corrupt IndexedDB draft until the user discards it', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave ready');
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('print-map-studio', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('drafts', 'readwrite');
      transaction.objectStore('drafts').put({ recordVersion: 99, savedAt: 'bad', document: {} }, 'current');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  await page.reload();

  const dialog = page.getByRole('dialog', { name: 'Local draft unavailable' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#root')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#root')).toHaveAttribute('data-base-ui-inert');
  await expect(page.getByRole('button', { name: 'Discard damaged draft' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Discard damaged draft' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave ready');
});

test('does not render fallback project state while the local project is loading', async ({ page }) => {
  await page.goto('./');
  const autosaveStatus = page.getByRole('status', { name: 'Autosave status' });
  await expect(autosaveStatus).toHaveText('Autosave ready');
  await page.getByRole('button', { name: 'Portrait' }).click();
  await expect(autosaveStatus).toHaveText('All changes saved locally');

  const context = page.context();
  await context.addInitScript(() => {
    const originalTransaction = IDBDatabase.prototype.transaction;
    let isDelayed = false;
    IDBDatabase.prototype.transaction = function delayedInitialDraftTransaction(
      this: IDBDatabase,
      storeNames: string | string[],
      mode?: IDBTransactionMode,
      options?: IDBTransactionOptions,
    ) {
      const transaction = originalTransaction.call(this, storeNames, mode, options);
      const names = typeof storeNames === 'string' ? [storeNames] : storeNames;
      if (isDelayed || !names.includes('drafts')) return transaction;
      isDelayed = true;

      let completeHandler: ((this: IDBTransaction, event: Event) => unknown) | null = null;
      Object.defineProperty(transaction, 'oncomplete', {
        configurable: true,
        get: () => completeHandler,
        set: (handler) => { completeHandler = handler; },
      });
      transaction.addEventListener('complete', (event) => {
        (window as typeof window & { __releaseAutosaveLoad?: () => void }).__releaseAutosaveLoad = () => {
          delete (window as typeof window & { __releaseAutosaveLoad?: () => void }).__releaseAutosaveLoad;
          completeHandler?.call(transaction, event);
        };
      }, { once: true });
      return transaction;
    };
  });

  await page.close();
  const delayedPage = await context.newPage();
  await delayedPage.goto('./');
  await delayedPage.waitForFunction(() => (
    typeof (window as typeof window & { __releaseAutosaveLoad?: () => void }).__releaseAutosaveLoad === 'function'
  ));

  await expect(delayedPage.getByRole('status')).toHaveText('Loading local project…');
  await expect(delayedPage.getByRole('button', { name: 'Export' })).toHaveCount(0);
  await delayedPage.evaluate(() => {
    (window as typeof window & { __releaseAutosaveLoad?: () => void }).__releaseAutosaveLoad?.();
  });

  await expect(delayedPage.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
  await expect(delayedPage.getByRole('dialog', { name: 'Recover local draft' })).toHaveCount(0);
});
