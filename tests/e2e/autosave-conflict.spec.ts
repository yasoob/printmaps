import { expect, test } from '@playwright/test';
import { expandToolSettings } from './authoring-panel-support';
import { dismissReload, downloadDocument, holdNextRead, openConflict, reviewConflict, storedDraft } from './autosave-conflict-support';

test('two real tabs preserve A5, download it without replacement, and keep selection and undo on cancellation', async ({ page }, testInfo) => {
  const { winner, saved } = await openConflict(page);
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  const dialog = await reviewConflict(page);
  for (const key of ['p', 's', 'r', 'v', 'ControlOrMeta+z', 'ControlOrMeta+y', 'Delete', 'Backspace']) {
    await page.keyboard.press(key);
  }
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download this tab’s version' }).click();
  const backup = await downloading;
  const document = await downloadDocument(backup);
  expect(document.page.preset).toBe('A5');
  expect(document.layers).toEqual(saved.document.layers);
  await backup.saveAs(testInfo.outputPath('ux-fix-028-losing-tab.printmap.json'));
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('status', { name: 'Conflict download status' })).toContainText('Download started. Check your browser’s downloads; this tab has not been replaced');
  expect(await storedDraft(winner)).toEqual(saved);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-028-download-keeps-decision.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Select Route 01' })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('button', { name: 'Select (V)' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await dismissReload(page);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  expect(await storedDraft(winner)).toEqual(saved);
  expect(await page.evaluate(() => window.conflictInstrumentation.puts)).toBe(0);
});

test('explicit destructive loading shows A3 without queued A5 writes and only future edits resume autosave', async ({ page }, testInfo) => {
  const { winner, saved } = await openConflict(page);
  await reviewConflict(page);
  await page.getByRole('button', { name: 'Discard this tab and load saved version' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Page preset' })).toHaveValue('A3');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave ready');
  await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeFocused();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  expect(await storedDraft(winner)).toEqual(saved);
  expect(await page.evaluate(() => window.conflictInstrumentation.puts)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-028-loaded-winner.png'), animations: 'disabled' });
  await page.getByRole('combobox', { name: 'Page preset' }).selectOption('A6');
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  const next = await storedDraft(winner);
  expect(next.document.page.preset).toBe('A6');
  expect(next.revision).toBe(saved.revision + 1);
  expect(await page.evaluate(() => window.conflictInstrumentation.puts)).toBe(1);
  const prompts: string[] = [];
  page.on('dialog', async (prompt) => { prompts.push(prompt.type()); await prompt.accept(); });
  await page.reload();
  expect(prompts).toEqual([]);
  await expect(page.getByRole('combobox', { name: 'Page preset' })).toHaveValue('A6');
});

test('failed backup preserves the losing tab, recovery choice and native unload protection', async ({ page }, testInfo) => {
  const { winner, saved } = await openConflict(page);
  await reviewConflict(page);
  await page.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = (blob) => {
      if (blob instanceof File && blob.name.endsWith('.printmap.json')) {
        URL.createObjectURL = original;
        throw new Error('Controlled conflict backup failure');
      }
      return original(blob);
    };
  });
  await page.getByRole('button', { name: 'Download this tab’s version' }).click();
  await expect(page.getByRole('alert', { name: 'Conflict download error' })).toHaveText('Controlled conflict backup failure');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('status', { name: 'Conflict download status' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-028-backup-failure.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('combobox', { name: 'Page preset' })).toHaveValue('A5');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await dismissReload(page);
  expect(await storedDraft(winner)).toEqual(saved);
  expect(await page.evaluate(() => window.conflictInstrumentation.puts)).toBe(0);
});

test('canceling a pending real IndexedDB read preserves newer local work and does not silently resume writing', async ({ page }, testInfo) => {
  const { winner, saved } = await openConflict(page);
  await reviewConflict(page);
  await holdNextRead(page);
  await page.getByRole('button', { name: 'Discard this tab and load saved version' }).click();
  await expect.poll(() => page.evaluate(() => window.conflictInstrumentation.readHeld)).toBe(true);
  await expect(page.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Download this tab’s version' })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('ux-fix-028-pending-read-choice.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await page.getByRole('combobox', { name: 'Page preset' }).selectOption('A6');
  await reviewConflict(page);
  await expect(page.getByRole('button', { name: 'Discard this tab and load saved version' })).toBeDisabled();
  await page.evaluate(() => window.conflictInstrumentation.releaseRead!());
  await expect(page.getByRole('button', { name: 'Discard this tab and load saved version' })).toBeEnabled();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('combobox', { name: 'Page preset' })).toHaveValue('A6');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  expect(await storedDraft(winner)).toEqual(saved);
  expect(await page.evaluate(() => window.conflictInstrumentation.puts)).toBe(0);
});

test('a newer winner during a delayed recovery read is never overwritten by the resumed stale tab', async ({ page }) => {
  const { winner, saved } = await openConflict(page);
  await reviewConflict(page);
  await holdNextRead(page);
  await page.getByRole('button', { name: 'Discard this tab and load saved version' }).click();
  await expect.poll(() => page.evaluate(() => window.conflictInstrumentation.readHeld)).toBe(true);
  await winner.getByRole('combobox', { name: 'Page preset' }).selectOption('A6');
  await expect(winner.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  const newer = await storedDraft(winner);
  expect(newer.revision).toBe(saved.revision + 1);
  await page.evaluate(() => window.conflictInstrumentation.releaseRead!());
  await expect(page.getByRole('combobox', { name: 'Page preset' })).toHaveValue('A3');
  await page.getByRole('combobox', { name: 'Page preset' }).selectOption('A5');
  await expect(page.getByRole('status', { name: 'Autosave conflict notice' })).toBeVisible();
  expect(await storedDraft(winner)).toEqual(newer);
  expect(await page.evaluate(() => window.conflictInstrumentation.puts)).toBe(0);
  await reviewConflict(page);
  await page.getByRole('button', { name: 'Discard this tab and load saved version' }).click();
  await expect(page.getByRole('combobox', { name: 'Page preset' })).toHaveValue('A6');
  expect(await storedDraft(winner)).toEqual(newer);
});

test('suspended unfinished coordinates are warned about, excluded from download, retained on cancel, and reset only on deliberate load', async ({ page }, testInfo) => {
  const { saved } = await openConflict(page);
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('tab', { name: 'Draw custom area' }).click();
  await page.getByRole('textbox', { name: 'New area point longitude' }).fill('181');
  await page.getByRole('tab', { name: 'Travel time' }).click();
  await page.getByRole('button', { name: 'Close Area menu' }).click();
  await expect(page.getByRole('status', { name: 'Unfinished drawing' })).toBeVisible();
  const dialog = await reviewConflict(page);
  await expect(dialog).toContainText('Unfinished drawings and unadded point inputs are not saved or included in downloads');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download this tab’s version' }).click();
  const document = await downloadDocument(await downloading);
  expect(document.layers).toEqual(saved.document.layers);
  expect(document.page.preset).toBe('A5');
  expect(document).not.toHaveProperty('hasUnfinishedDrawing');
  await dismissReload(page);
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('ux-fix-028-unfinished-warning.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('tab', { name: 'Draw custom area' }).click();
  await expect(page.getByRole('textbox', { name: 'New area point longitude' })).toHaveValue('181');
  await page.getByRole('button', { name: 'Close Area menu' }).click();
  await reviewConflict(page);
  await page.getByRole('button', { name: 'Discard this tab and load saved version' }).click();
  await expect(page.getByRole('status', { name: 'Unfinished drawing' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('tab', { name: 'Draw custom area' }).click();
  await expandToolSettings(page, 'area');
  await expect(page.getByRole('textbox', { name: 'New area point longitude' })).not.toHaveValue('181');
  await expect(page.getByRole('status', { name: 'Unfinished drawing' })).toHaveCount(0);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`conflict choices, keyboard scrolling and search remain usable at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await openConflict(page);
    const search = page.getByRole('combobox', { name: 'Search places and addresses' });
    await search.click();
    await page.setViewportSize(viewport);
    await search.click();
    await expect(search).toBeFocused();
    const dialog = await reviewConflict(page);
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Download this tab’s version' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    const details = page.getByRole('region', { name: 'Autosave conflict details' });
    await expect(details).toBeFocused();
    await details.press('End');
    await expect.poll(() => details.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Discard this tab and load saved version' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(details).toBeFocused();
    const buttons = await dialog.getByRole('button').all();
    for (const button of buttons) {
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.screenshot({ path: testInfo.outputPath('ux-fix-028-mobile-conflict.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeFocused();
    await search.click();
    await expect(search).toBeFocused();
  });
}
