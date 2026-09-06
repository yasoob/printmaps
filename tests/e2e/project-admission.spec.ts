import { expect, test, type Page } from '@playwright/test';
import { expandToolSettings } from './authoring-panel-support';
import { admissionFixture, downloadAdmissionProject, openAdmissionProject, savedAdmissionRecord } from './project-admission-support';

test.beforeEach(async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('./');
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave ready');
});

async function openSpreadsheet(page: Page, text: string) {
  await page.getByRole('button', { name: 'Place (P)' }).click();
  await page.getByRole('button', { name: 'Paste POI list' }).click();
  await page.getByRole('textbox', { name: 'POI spreadsheet rows' }).fill(text);
}

const rows = (batch: number, count = 300) => Array.from({ length: count }, (_, index) => `Batch ${batch} place ${index}\t16.37\t48.21`).join('\n');

test('four 300-row batches reject atomically at 901, retain input and permit 99 more portable layers', async ({ page }, testInfo) => {
  test.slow();
  if (await page.locator('.layer-row').count() !== 1) await openAdmissionProject(page, await admissionFixture(page));
  await expect(page.locator('.layer-row')).toHaveCount(1);
  for (const batch of [1, 2, 3]) {
    await openSpreadsheet(page, rows(batch));
    await page.getByRole('button', { name: 'Add POIs', exact: true }).click();
    await expect(page.locator('.layer-row')).toHaveCount(batch * 300 + 1);
    await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  }
  const original = await savedAdmissionRecord(page);
  await openSpreadsheet(page, rows(4));
  await page.getByRole('button', { name: 'Add POIs', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('room for 99 more layers (maximum 1000, including the basemap)');
  await expect(page.locator('.layer-row')).toHaveCount(901);
  await expect(page.getByRole('textbox', { name: 'POI spreadsheet rows' })).toHaveValue(rows(4));
  expect(await savedAdmissionRecord(page)).toEqual(original);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-026-fourth-batch-rejected.png') });
  await page.getByRole('textbox', { name: 'POI spreadsheet rows' }).fill(rows(4, 99));
  await page.getByRole('button', { name: 'Add POIs', exact: true }).click();
  await expect(page.locator('.layer-row')).toHaveCount(1000);
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  const downloaded = await downloadAdmissionProject(page, testInfo, '1000-layers');
  expect(downloaded.layers).toHaveLength(1000);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.layer-row')).toHaveCount(901);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.layer-row')).toHaveCount(1000);
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  await page.reload();
  await expect(page.locator('.layer-row')).toHaveCount(1000);
  await openAdmissionProject(page, downloaded);
  const reopened = await savedAdmissionRecord(page);
  expect(reopened.document.layers).toEqual(downloaded.layers);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
});

test('201-character names remain correctable; 200-character names and generated copies save and reopen', async ({ page }, testInfo) => {
  if (await page.locator('.layer-row').count() !== 1) await openAdmissionProject(page, await admissionFixture(page));
  await openSpreadsheet(page, 'Original\t16.37\t48.21');
  await page.getByRole('button', { name: 'Add POIs', exact: true }).click();
  await page.getByRole('button', { name: 'Select Original', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  const original = await savedAdmissionRecord(page);
  const input = page.getByRole('textbox', { name: 'Layer name' });
  await input.fill('n'.repeat(201));
  await input.press('Tab');
  await expect(input).toHaveValue('n'.repeat(201));
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toContainText('200 characters');
  await expect(page.getByRole('button', { name: 'Select Original', exact: true })).toBeVisible();
  expect(await savedAdmissionRecord(page)).toEqual(original);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-026-name-rejected.png') });
  await input.fill('n'.repeat(200));
  await input.press('Tab');
  await expect(input).toHaveAttribute('aria-invalid', 'false');
  await page.getByRole('button', { name: 'Layer menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Duplicate layer', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  const downloaded = await downloadAdmissionProject(page, testInfo, 'bounded-names');
  expect(downloaded.layers).toHaveLength(3);
  expect(downloaded.layers.filter(({ type }) => type === 'poi').map(({ name }) => name.length)).toEqual([200, 200]);
  expect(downloaded.layers.some(({ name }) => name === 'n'.repeat(200))).toBe(true);
  await page.reload();
  await expect(page.locator('.layer-row')).toHaveCount(3);
  await openAdmissionProject(page, downloaded);
  const reopened = await savedAdmissionRecord(page);
  expect(reopened.document.layers).toEqual(downloaded.layers);
});

test('rejected custom-area and route Finish retain meaningful drafts and reload protection', async ({ page }, testInfo) => {
  await openAdmissionProject(page, await admissionFixture(page, 'layers'));
  const original = await savedAdmissionRecord(page);
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('tab', { name: 'Draw custom area' }).click();
  for (const [longitude, latitude] of [['16.35', '48.2'], ['16.38', '48.2'], ['16.38', '48.22']]) {
    await page.getByRole('textbox', { name: 'New area point longitude' }).fill(longitude);
    await page.getByRole('textbox', { name: 'New area point latitude' }).fill(latitude);
    await page.getByRole('button', { name: 'Add area point', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Finish area', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('room for 0 more layers');
  await expect(page.getByRole('status', { name: 'Area drawing status' })).toHaveText('3 vertices');
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('Completed layers saved locally · Unfinished work not saved');
  const prompting = page.waitForEvent('dialog');
  const reloading = page.evaluate(() => window.location.reload());
  const dialog = await prompting;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
  await reloading;
  await expect(page.getByRole('status', { name: 'Area drawing status' })).toHaveText('3 vertices');
  await page.screenshot({ path: testInfo.outputPath('ux-fix-026-area-retained.png') });
  expect(await savedAdmissionRecord(page)).toEqual(original);
  await page.getByRole('button', { name: 'Cancel area', exact: true }).click();
  await page.getByRole('button', { name: 'Route (R)' }).click();
  const sources = page.locator('.route-point-sources');
  for (const [longitude, latitude] of [['16.35', '48.2'], ['16.38', '48.22']]) {
    await expandToolSettings(page, 'route');
    if (await sources.getAttribute('open') === null) await sources.locator('summary').click();
    await page.getByRole('textbox', { name: 'New route point longitude' }).fill(longitude);
    await page.getByRole('textbox', { name: 'New route point latitude' }).fill(latitude);
    await page.getByRole('button', { name: 'Add coordinates', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Finish route', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('room for 0 more layers');
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('2 points');
  expect(await savedAdmissionRecord(page)).toEqual(original);
  await expect(page.locator('.layer-row')).toHaveCount(1000);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-026-route-retained.png') });
});

test('a rejected area midpoint drag restores the visible handle and canonical geometry at the exact Arc-weighted limit', async ({ page }, testInfo) => {
  await openAdmissionProject(page, await admissionFixture(page, 'positions'));
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Select Editable area', exact: true }).click();
  await page.getByRole('button', { name: 'Edit area points', exact: true }).click();
  const handle = page.getByRole('button', { name: 'Add area point between 1 and 2', exact: true });
  await expect(handle).toBeVisible();
  const before = await handle.boundingBox();
  expect(before).not.toBeNull();
  const original = await savedAdmissionRecord(page);
  await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
  await page.mouse.down();
  await page.mouse.move(before!.x + 30, before!.y - 25, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('alert')).toContainText('200,000 positions');
  await expect.poll(async () => {
    const after = await handle.boundingBox();
    return after ? Math.hypot(after.x - before!.x, after.y - before!.y) : Infinity;
  }).toBeLessThan(1);
  expect(await savedAdmissionRecord(page)).toEqual(original);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  const downloaded = await downloadAdmissionProject(page, testInfo, 'arc-budget-rollback');
  expect(downloaded.layers).toEqual(original.document.layers);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-026-midpoint-rollback.png') });
});
