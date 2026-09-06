import { expect, test, type Page } from '@playwright/test';

async function importData(page: Page) {
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Import map data', exact: true }).click();
  const chooser = await choosing;
  await chooser.setFiles('tests/fixtures/import/supported.geojson');
  await page.getByRole('dialog', { name: 'Import map data' }).getByRole('button', { name: 'Import 1 file' }).click();
  await expect(page.getByRole('status', { name: 'Map data import status' })).toBeVisible();
}

async function openInvalidProject(page: Page) {
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Open project', exact: true }).click();
  const chooser = await choosing;
  await chooser.setFiles({ name: 'broken.printmap.json', mimeType: 'application/json', buffer: Buffer.from('{') });
}

for (const width of [1440, 390, 320]) {
  test(`a new file error is above old success and can be dismissed at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('./');
    await importData(page);
    await openInvalidProject(page);
    const notices = page.getByRole('region', { name: 'File notifications' });
    const error = notices.getByRole('alert', { name: 'Project file status' });
    const success = notices.getByRole('status', { name: 'Map data import status' });
    await expect(error).toContainText('not valid JSON');
    await expect(success).toContainText('Imported 3 GeoJSON layers');
    const errorBox = await error.boundingBox();
    const successBox = await success.boundingBox();
    expect(errorBox!.y + errorBox!.height).toBeLessThanOrEqual(successBox!.y);
    expect(errorBox!.x).toBeGreaterThanOrEqual(0);
    expect(errorBox!.x + errorBox!.width).toBeLessThanOrEqual(width);
    const close = error.getByRole('button', { name: 'Dismiss project file status' });
    const closeBox = await close.boundingBox();
    expect(closeBox!.width).toBeGreaterThanOrEqual(44);
    expect(closeBox!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath('ux-fix-034-prioritized-feedback.png'), animations: 'disabled' });
    await close.focus();
    await close.press('Enter');
    await expect(error).toHaveCount(0);
    await expect(success).toBeVisible();
    await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeFocused();
    await success.getByRole('button', { name: 'Dismiss map data import status' }).click();
    await expect(notices).toBeHidden();
    const search = page.getByRole('combobox', { name: 'Search places and addresses' });
    await search.click();
    await expect(search).toBeFocused();
    await expect(page.locator('.layer-row')).toHaveCount(7);
  });
}

test('a failed download remains visible above import success and a retry clears only its error', async ({ page }, testInfo) => {
  await page.goto('./');
  await importData(page);
  await page.evaluate(() => {
    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob) => {
      if (blob instanceof File && blob.name.endsWith('.printmap.json')) {
        URL.createObjectURL = createObjectURL;
        throw new Error('Controlled project download failure');
      }
      return createObjectURL(blob);
    };
  });
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Download project', exact: true }).click();
  const error = page.getByRole('alert', { name: 'Project save status' });
  const success = page.getByRole('status', { name: 'Map data import status' });
  await expect(error).toContainText('Controlled project download failure');
  const errorBox = await error.boundingBox();
  const successBox = await success.boundingBox();
  expect(errorBox!.y + errorBox!.height).toBeLessThanOrEqual(successBox!.y);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-034-download-failure.png'), animations: 'disabled' });
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Download project', exact: true }).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toMatch(/\.printmap\.json$/);
  await expect(error).toHaveCount(0);
  await expect(success).toBeVisible();
});
