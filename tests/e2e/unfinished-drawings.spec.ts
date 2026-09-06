import { expect, test, type Page } from '@playwright/test';
import { buffer } from 'node:stream/consumers';
import { expandToolSettings } from './authoring-panel-support';

async function addRoutePoint(page: Page, longitude: string, latitude: string) {
  await expandToolSettings(page, 'route');
  const sources = page.locator('.route-point-sources');
  if (await sources.getAttribute('open') === null) await sources.locator('summary').click();
  await page.getByRole('textbox', { name: 'New route point longitude' }).fill(longitude);
  await page.getByRole('textbox', { name: 'New route point latitude' }).fill(latitude);
  await page.getByRole('button', { name: 'Add coordinates' }).click();
}

async function downloadProject(page: Page) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Download project' }).click();
  const download = await downloading;
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Project download stream unavailable');
  const contents = await buffer(stream);
  return JSON.parse(contents.toString('utf8'));
}

async function openProject(page: Page, document: unknown) {
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Open project', exact: true }).click();
  const chooser = await choosing;
  await chooser.setFiles({
    name: 'replacement.printmap.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(document)),
  });
}

async function dismissReload(page: Page) {
  const prompting = page.waitForEvent('dialog');
  const reloading = page.evaluate(() => window.location.reload());
  const dialog = await prompting;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
  await reloading;
}

test('real reload confirmation retains route work on cancel; accepted reload restores completed layers only', async ({ page }, testInfo) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Portrait', exact: true }).click();
  const status = page.getByRole('status', { name: 'Autosave status' });
  await expect(status).toHaveText('All changes saved locally');
  await page.getByRole('button', { name: 'Route (R)' }).click();
  await addRoutePoint(page, '16.35', '48.2');
  await addRoutePoint(page, '16.38', '48.22');
  await expect(status).toHaveText('Completed layers saved locally · Unfinished work not saved');
  await dismissReload(page);
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('2 points');
  await page.screenshot({ path: testInfo.outputPath('ux-fix-016-route-reload-dismissed.png') });
  const downloaded = await downloadProject(page);
  expect(downloaded).not.toHaveProperty('hasUnfinishedDrawing');
  expect(downloaded.layers.some((layer: { id: string }) => layer.id.includes('draft'))).toBe(false);
  const prompting = page.waitForEvent('dialog');
  const reloading = page.reload();
  const dialog = await prompting;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.accept();
  await reloading;
  await expect(page.getByRole('status', { name: 'Unfinished drawing' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Select (V)' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Portrait', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const restored = await downloadProject(page);
  expect(restored.layers).toEqual(downloaded.layers);
});

test('suspended raw area input is protected through source and tool changes; explicit Cancel removes the guard', async ({ page }, testInfo) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('tab', { name: 'Draw custom area' }).click();
  const longitude = page.getByRole('textbox', { name: 'New area point longitude' });
  await longitude.fill('181');
  await page.getByRole('button', { name: 'Add area point' }).click();
  await expect(longitude).toHaveValue('181');
  await page.getByRole('tab', { name: 'Travel time' }).click();
  await page.getByRole('button', { name: 'Close Area menu' }).click();
  await expect(page.getByRole('status', { name: 'Unfinished drawing' })).toBeVisible();
  await dismissReload(page);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-016-suspended-area-input.png') });
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('tab', { name: 'Draw custom area' }).click();
  await expect(longitude).toHaveValue('181');
  await page.getByRole('button', { name: 'Cancel area' }).click();
  const prompts: string[] = [];
  page.on('dialog', async (dialog) => { prompts.push(dialog.type()); await dialog.accept(); });
  await page.reload();
  expect(prompts).toEqual([]);
  await expect(page.getByRole('status', { name: 'Unfinished drawing' })).toHaveCount(0);
});

test('project replacement requires an isolated deliberate choice and resets all draft epochs', async ({ page }, testInfo) => {
  await page.goto('./');
  const replacement = await downloadProject(page);
  replacement.title = 'UX 016 replacement';
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('tab', { name: 'Draw custom area' }).click();
  await page.getByRole('textbox', { name: 'New area point longitude' }).fill('16.399');
  await page.getByRole('button', { name: 'Route (R)' }).click();
  await addRoutePoint(page, '16.35', '48.2');
  await openProject(page, replacement);
  const dialog = page.getByRole('dialog', { name: 'Discard unfinished work?' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await page.keyboard.press('p');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeFocused();
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('1 point');
  await openProject(page, replacement);
  await expect(dialog).toHaveCSS('opacity', '1');
  await page.screenshot({ path: testInfo.outputPath('ux-fix-016-project-replacement-choice.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Discard unfinished work and open' }).click();
  await expect(page.getByRole('button', { name: 'UX 016 replacement', exact: true })).toBeVisible();
  for (const tool of ['Place (P)', 'Area (S)', 'Route (R)']) {
    await page.getByRole('button', { name: tool }).click();
    await expect(page.getByRole('status', { name: 'Unfinished drawing' })).toHaveCount(0);
  }
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('Click the map');
  const prompts: string[] = [];
  page.on('dialog', async (prompt) => { prompts.push(prompt.type()); await prompt.accept(); });
  await page.reload();
  expect(prompts).toEqual([]);
});

test('Finish removes the unload guard and saves one undoable route; leaving a new draft requests confirmation', async ({ page }) => {
  await page.goto('./');
  const original = await downloadProject(page);
  await page.getByRole('button', { name: 'Route (R)' }).click();
  await addRoutePoint(page, '16.35', '48.2');
  await addRoutePoint(page, '16.38', '48.22');
  await page.getByRole('button', { name: 'Finish route' }).click();
  await expect(page.getByRole('status', { name: 'Unfinished drawing' })).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  const finished = await downloadProject(page);
  expect(finished.layers).toHaveLength(original.layers.length + 1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  const undone = await downloadProject(page);
  expect(undone.layers).toEqual(original.layers);
  await page.getByRole('button', { name: 'Route (R)' }).click();
  await addRoutePoint(page, '16.35', '48.2');
  const prompting = page.waitForEvent('dialog');
  const leaving = page.getByRole('link', { name: 'Print Map Studio home' }).click();
  const dialog = await prompting;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
  await leaving;
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('1 point');
});

test('invalid raw route coordinates remain protected until corrected, added, or explicitly discarded', async ({ page }, testInfo) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Route (R)' }).click();
  await page.locator('.route-point-sources > summary').click();
  const longitude = page.getByRole('textbox', { name: 'New route point longitude' });
  const original = await longitude.inputValue();
  await longitude.fill('181');
  await longitude.press('Tab');
  await expect(longitude).toHaveValue('181');
  await expect(page.getByRole('button', { name: 'Add coordinates' })).toBeDisabled();
  await dismissReload(page);
  await expect(longitude).toHaveValue('181');
  await page.screenshot({ path: testInfo.outputPath('ux-fix-016-route-input-retained.png') });
  await longitude.fill(original);
  await expect(page.getByRole('status', { name: 'Unfinished drawing' })).toHaveCount(0);
  await longitude.fill('16.4');
  await page.getByRole('button', { name: 'Add coordinates' }).click();
  await page.getByRole('button', { name: 'Undo last route point' }).click();
  await expect(page.getByRole('status', { name: 'Unfinished drawing' })).toHaveCount(0);
  const prompts: string[] = [];
  page.on('dialog', async (dialog) => { prompts.push(dialog.type()); await dialog.accept(); });
  await page.reload();
  expect(prompts).toEqual([]);
});

test('the draft warning and replacement choice remain visible and operable on a narrow screen', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('./');
  const replacement = await downloadProject(page);
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('tab', { name: 'Draw custom area' }).click();
  await expandToolSettings(page, 'area');
  await page.getByRole('textbox', { name: 'New area point longitude' }).fill('16.399');
  await page.getByRole('button', { name: 'Hide area settings' }).click();
  const notice = page.locator('.unfinished-drawing-notice');
  await expect(notice).toBeVisible();
  await notice.locator('summary').click();
  await expect(notice).toContainText('Browsers may not show a warning');
  await page.screenshot({ path: testInfo.outputPath('ux-fix-016-mobile-warning.png'), animations: 'disabled' });
  await notice.locator('summary').click();
  await openProject(page, replacement);
  const dialog = page.getByRole('dialog', { name: 'Discard unfinished work?' });
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(page.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-016-mobile-replacement.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeFocused();
  await expect(notice).toBeVisible();
});
