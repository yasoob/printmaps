import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test('Save downloads the current project as portable versioned JSON', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Portrait' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('vienna-field-guide.printmap.json');

  const outputPath = testInfo.outputPath('vienna-field-guide.printmap.json');
  await download.saveAs(outputPath);
  const savedProject = JSON.parse(await readFile(outputPath, 'utf8'));
  expect(savedProject).toMatchObject({
    schemaVersion: 3,
    id: 'vienna-field-guide',
    title: 'Vienna field guide',
    page: { preset: 'A4', widthMm: 210, heightMm: 297, orientation: 'portrait' },
  });
  expect(savedProject.layers.map((layer: { id: string }) => layer.id)).toEqual([
    'route-01',
    'poi-cafe',
    'area-center',
    'basemap',
  ]);
});

test('opens a validated portable project as a focused fresh history root', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Portrait' }).click();
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(path.resolve('tests/fixtures/alpine-poster.printmap.json'));

  await expect(page.getByRole('button', { name: 'Alpine poster' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Summit route' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Route 01' })).not.toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Page width' })).toHaveValue('297');
  await expect(page.getByRole('textbox', { name: 'Page height' })).toHaveValue('420');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
  await expect(page.getByRole('status', { name: 'Project file status' })).toHaveText('Opened Alpine poster. Edit history was reset.');
  await expect(page.getByRole('button', { name: 'Open' })).toBeFocused();
});

test('rejects invalid project files without replacing work and allows a retry', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Portrait' }).click();

  for (const invalidFile of [
    {
      file: { name: 'broken.printmap.json', mimeType: 'application/json', buffer: Buffer.from('{') },
      error: 'not valid JSON',
    },
    {
      file: {
        name: 'renamed.json',
        mimeType: 'application/json',
        buffer: await readFile(path.resolve('tests/fixtures/alpine-poster.printmap.json')),
      },
      error: '.printmap.json',
    },
    {
      file: {
        name: 'oversized.printmap.json',
        mimeType: 'application/json',
        buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 0x20),
      },
      error: '10 MB',
    },
  ]) {
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Open' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(invalidFile.file);

    await expect(page.getByRole('alert', { name: 'Project file status' })).toContainText(invalidFile.error);
    await expect(page.getByRole('button', { name: 'Vienna field guide' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Open' })).toBeFocused();
  }

  const retryChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open' }).click();
  const retryChooser = await retryChooserPromise;
  await retryChooser.setFiles(path.resolve('tests/fixtures/alpine-poster.printmap.json'));
  await expect(page.getByRole('button', { name: 'Alpine poster' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Project file status' })).toContainText('Edit history was reset');
  await expect(page.getByRole('button', { name: 'Open' })).toBeFocused();
});

test('imports supported GeoJSON as one undoable editable layer batch', async ({ page }) => {
  await page.goto('/');

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(path.resolve('tests/fixtures/import/supported.geojson'));

  await expect(page.getByRole('heading', { name: 'Café Central' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Café Central' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Danube path' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Inner district' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'GeoJSON import status' }))
    .toHaveText('Imported 3 GeoJSON layers. Undo removes the whole import.');
  await expect(page.getByRole('button', { name: 'Import' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();

  await page.getByRole('button', { name: 'Select Danube path' }).click();
  await expect(page.getByRole('heading', { name: 'Danube path' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Select Café Central' })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
});

test('rejects empty GeoJSON without changing history and allows the same chooser to retry', async ({ page }) => {
  await page.goto('/');

  const emptyChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import' }).click();
  const emptyChooser = await emptyChooserPromise;
  await emptyChooser.setFiles({
    name: 'empty.geojson',
    mimeType: 'application/geo+json',
    buffer: Buffer.from('{"type":"FeatureCollection","features":[]}'),
  });

  await expect(page.getByRole('alert', { name: 'GeoJSON import status' }))
    .toContainText('at least one supported Point, LineString, or Polygon feature');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Import' })).toBeFocused();

  const retryChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import' }).click();
  const retryChooser = await retryChooserPromise;
  await retryChooser.setFiles(path.resolve('tests/fixtures/import/supported.geojson'));
  await expect(page.getByRole('status', { name: 'GeoJSON import status' })).toContainText('Imported 3');
  await expect(page.getByRole('button', { name: 'Select Café Central' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import' })).toBeFocused();
});
