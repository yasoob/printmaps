import path from 'node:path';
import { expect, test } from '@playwright/test';

test('reviewed map-data batches apply bounded styling before one-step import', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleProblems.push(message.text());
  });
  await page.goto('./');
  await page.locator('input[accept^=".geojson"]').setInputFiles([
    path.resolve('tests/fixtures/import/supported.geojson'),
    path.resolve('tests/fixtures/import/wave2/namespaced.kml'),
  ]);

  const dialog = page.getByRole('dialog', { name: 'Import map data' });
  await expect(dialog.getByRole('group', { name: 'Style imported routes' })).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Style imported POIs' })).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Style imported shapes' })).toBeVisible();
  const commit = dialog.getByRole('button', { name: 'Import 2 files' });
  await dialog.getByRole('textbox', { name: 'Import route width' }).fill('17');
  await expect(dialog.getByRole('textbox', { name: 'Import route width' })).toHaveAttribute('aria-invalid', 'true');
  await expect(commit).toBeDisabled();
  await dialog.getByRole('textbox', { name: 'Import route width' }).fill('7');
  await dialog.getByLabel('Import route color').fill('#112233');
  await dialog.getByRole('textbox', { name: 'Import POI marker size' }).fill('22');
  await dialog.getByRole('combobox', { name: 'Import POI marker shape' }).selectOption('diamond');
  await dialog.getByLabel('Import POI color').fill('#445566');
  await dialog.getByRole('textbox', { name: 'Import shape outline width' }).fill('3');
  await dialog.getByLabel('Import shape fill color').fill('#778899');
  await dialog.getByLabel('Import shape outline color').fill('#aabbcc');
  await expect(commit).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('import-styling-desktop.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  const dialogBox = await dialog.boundingBox();
  const commitBox = await commit.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(commitBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(390);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(844);
  expect(commitBox!.y + commitBox!.height).toBeLessThanOrEqual(844);
  expect(await page.evaluate(() => document.body.scrollWidth - window.innerWidth)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('import-styling-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await commit.click();

  await expect(page.getByRole('status', { name: 'Map data import status' }))
    .toHaveText('Imported 2 files as 6 layers. Undo removes the whole import.');
  await expect(page.getByLabel('POI color')).toHaveValue('#445566');
  await expect(page.getByRole('spinbutton', { name: 'POI marker size' })).toHaveValue('22');
  await expect(page.getByRole('combobox', { name: 'POI marker shape' })).toHaveValue('diamond');
  await page.getByRole('button', { name: 'Select Río line' }).click();
  await expect(page.getByLabel('Route color')).toHaveValue('#112233');
  await expect(page.getByRole('spinbutton', { name: 'Route width' })).toHaveValue('7');
  await page.getByRole('button', { name: 'Select 公園 polygon' }).click();
  await expect(page.getByLabel('Shape fill color')).toHaveValue('#778899');
  await expect(page.getByLabel('Shape outline color')).toHaveValue('#aabbcc');
  await expect(page.getByRole('spinbutton', { name: 'Shape outline width' })).toHaveValue('3');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Select Café Central' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Café point' })).not.toBeVisible();
  expect(consoleProblems).toEqual([]);
});
