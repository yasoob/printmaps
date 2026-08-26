/* eslint-disable unicorn/prefer-add-event-listener, unicorn/no-global-object-property-assignment, unicorn/no-optional-chaining-on-undeclared-variable -- Browser-realm IndexedDB instrumentation must patch native handlers and a page-local release hook. */
import { expect, test } from '@playwright/test';

test('autosaves to IndexedDB and requires explicit recover or discard choices', async ({ page }) => {
  await page.goto('/');
  const autosaveStatus = page.getByRole('status', { name: 'Autosave status' });
  await expect(autosaveStatus).toHaveText('Autosave ready');
  await page.getByRole('radio', { name: /^Night Ink:/ }).click();
  await page.getByRole('textbox', { name: 'Bearing' }).fill('-20');
  await page.getByRole('textbox', { name: 'Pitch' }).fill('35');
  await page.getByRole('textbox', { name: 'Pitch' }).press('Tab');
  await page.getByRole('textbox', { name: 'Text scale' }).fill('135');
  await page.getByRole('textbox', { name: 'Text scale' }).press('Tab');
  await page.getByRole('checkbox', { name: 'Show labels' }).uncheck();
  await page.getByRole('checkbox', { name: 'Show land detail' }).uncheck();
  await page.getByRole('combobox', { name: 'Map language' }).selectOption('de');
  await page.getByRole('button', { name: 'Portrait' }).click();
  await expect(autosaveStatus).toHaveText('All changes saved locally');

  await page.reload();
  const dialog = page.getByRole('dialog', { name: 'Recover local draft' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.studio-shell')).toHaveAttribute('inert');
  await expect(page.getByRole('button', { name: 'Recover draft' })).toBeFocused();
  const dialogBox = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(dialogBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(dialogBox!.width).toBeLessThanOrEqual(448);
  expect(Math.abs(dialogBox!.x + dialogBox!.width / 2 - viewport!.width / 2)).toBeLessThan(2);
  expect(Math.abs(dialogBox!.y + dialogBox!.height / 2 - viewport!.height / 2)).toBeLessThan(2);
  await page.getByRole('button', { name: 'Recover draft' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Bearing' })).toHaveValue('-20');
  await expect(page.getByRole('textbox', { name: 'Pitch' })).toHaveValue('35');
  await expect(page.getByRole('radio', { name: /^Night Ink:/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('combobox', { name: 'Map language' })).toHaveValue('de');
  await expect(page.getByRole('textbox', { name: 'Text scale' })).toHaveValue('135');
  await expect(page.getByRole('checkbox', { name: 'Show labels' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Show land detail' })).not.toBeChecked();
  const mapCanvas = page.getByTestId('map-canvas');
  await expect(mapCanvas).toHaveAttribute('data-style-preset', 'night-ink');
  await expect(mapCanvas).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await expect(mapCanvas).toHaveAttribute('data-map-text-scale', '135');
  await expect(mapCanvas).toHaveAttribute(
    'data-map-feature-visibility',
    'roads:true,buildings:true,labels:false,water:true,parks:true,landuse:false,transit:true',
  );
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(dialog).toBeVisible();
  await page.evaluate(() => {
    const root = document.documentElement.style;
    root.setProperty('--studio-safe-top', '20px');
    root.setProperty('--studio-safe-bottom', '24px');
    root.setProperty('--studio-safe-left', '16px');
    root.setProperty('--studio-safe-right', '12px');
  });
  const mobileDialogBox = await dialog.boundingBox();
  expect(mobileDialogBox).not.toBeNull();
  expect(mobileDialogBox!.x).toBeGreaterThanOrEqual(16);
  expect(mobileDialogBox!.x + mobileDialogBox!.width).toBeLessThanOrEqual(378);
  expect(mobileDialogBox!.y).toBeGreaterThanOrEqual(20);
  expect(mobileDialogBox!.y + mobileDialogBox!.height).toBeLessThanOrEqual(820);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Discard draft' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Project' })).toBeFocused({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Open properties' }).click();
  await expect(page.getByRole('button', { name: 'Landscape' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');

  const context = page.context();
  await page.close();
  const verificationPage = await context.newPage();
  await verificationPage.goto('/');
  await expect(verificationPage.getByRole('dialog', { name: 'Recover local draft' })).not.toBeVisible();
  await expect(verificationPage.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave ready', { timeout: 15_000 });
});

test('contains a corrupt IndexedDB draft until the user discards it', async ({ page }) => {
  await page.goto('/');
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
  await expect(page.locator('.studio-shell')).toHaveAttribute('inert');
  await expect(page.getByRole('button', { name: 'Discard damaged draft' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Discard damaged draft' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave ready');
});

test('delayed autosave recovery preempts Export and mobile drawers without losing trigger focus', async ({ page }) => {
  await page.goto('/');
  const autosaveStatus = page.getByRole('status', { name: 'Autosave status' });
  await expect(autosaveStatus).toHaveText('Autosave ready');
  await page.getByRole('button', { name: 'Portrait' }).click();
  await expect(autosaveStatus).toHaveText('All changes saved locally');

  const context = page.context();
  await context.addInitScript(() => {
    const originalTransaction = IDBDatabase.prototype.transaction;
    let isDelayedFirstDraftTransaction = false;
    IDBDatabase.prototype.transaction = function delayedInitialDraftTransaction(
      this: IDBDatabase,
      storeNames: string | string[],
      mode?: IDBTransactionMode,
      options?: IDBTransactionOptions,
    ) {
      const transaction = originalTransaction.call(this, storeNames, mode, options);
      const names = typeof storeNames === 'string' ? [storeNames] : storeNames;
      if (isDelayedFirstDraftTransaction || !names.includes('drafts')) return transaction;
      isDelayedFirstDraftTransaction = true;

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

  const scenarios = [
    {
      viewport: { width: 1440, height: 900 },
      triggerName: 'Export',
      preemptedDialogName: 'Export map',
      decision: 'Recover draft',
    },
    {
      viewport: { width: 390, height: 844 },
      triggerName: 'Open layers',
      preemptedDialogName: 'Layers sidebar',
      decision: 'Recover draft',
    },
    {
      viewport: { width: 390, height: 844 },
      triggerName: 'Open properties',
      preemptedDialogName: 'Properties sidebar',
      decision: 'Discard draft',
    },
  ];

  let scenarioPage = page;
  for (const scenario of scenarios) {
    await scenarioPage.close();
    scenarioPage = await context.newPage();
    await scenarioPage.setViewportSize(scenario.viewport);
    await scenarioPage.goto('/');
    await scenarioPage.waitForFunction(() => (
      typeof (window as typeof window & { __releaseAutosaveLoad?: () => void }).__releaseAutosaveLoad === 'function'
    ));

    const trigger = scenarioPage.getByRole('button', { name: scenario.triggerName });
    await trigger.click();
    const preemptedDialog = scenarioPage.getByRole('dialog', { name: scenario.preemptedDialogName });
    await expect(preemptedDialog).toBeVisible();
    await scenarioPage.evaluate(() => {
      (window as typeof window & { __releaseAutosaveLoad?: () => void }).__releaseAutosaveLoad?.();
    });

    const recoveryDialog = scenarioPage.getByRole('dialog', { name: 'Recover local draft' });
    const recover = recoveryDialog.getByRole('button', { name: 'Recover draft' });
    const discard = recoveryDialog.getByRole('button', { name: 'Discard draft' });
    await expect(recoveryDialog).toBeVisible();
    await expect(scenarioPage.locator('[aria-modal="true"]:visible')).toHaveCount(1);
    await expect(preemptedDialog).not.toBeVisible();
    await expect(recover).toBeFocused();
    await scenarioPage.keyboard.press('Shift+Tab');
    await expect(discard).toBeFocused();
    await scenarioPage.keyboard.press('Escape');
    await expect(recoveryDialog).toBeVisible();
    await expect(discard).toBeFocused();
    await scenarioPage.keyboard.press('Tab');
    await expect(recover).toBeFocused();

    await recoveryDialog.getByRole('button', { name: scenario.decision }).click();

    await expect(recoveryDialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    if (scenario.triggerName !== 'Export') {
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }
  }
});
