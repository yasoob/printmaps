import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';

test('Save downloads the current project as portable versioned JSON', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Bearing' }).fill('35');
  await page.getByRole('textbox', { name: 'Pitch' }).fill('40');
  await page.getByRole('textbox', { name: 'Pitch' }).press('Tab');
  await page.getByRole('textbox', { name: 'Text scale' }).fill('125');
  await page.getByRole('textbox', { name: 'Text scale' }).press('Tab');
  await page.getByRole('checkbox', { name: 'Show roads' }).uncheck();
  await page.getByRole('button', { name: 'Portrait' }).click();
  await page.getByRole('combobox', { name: 'Map style' }).selectOption('positron');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('vienna-field-guide.printmap.json');

  const outputPath = testInfo.outputPath('vienna-field-guide.printmap.json');
  await download.saveAs(outputPath);
  const savedProject = JSON.parse(await readFile(outputPath, 'utf8'));
  expect(savedProject).toMatchObject({
    schemaVersion: 10,
    id: 'vienna-field-guide',
    title: 'Vienna field guide',
    page: { preset: 'A4', widthMm: 210, heightMm: 297, orientation: 'portrait' },
    camera: { bearing: 35, pitch: 40 },
    style: {
      preset: 'positron',
      textScalePercent: 125,
      visibility: { roads: false, buildings: true, labels: true },
    },
  });
  expect(savedProject.layers.map((layer: { id: string }) => layer.id)).toEqual([
    'route-01',
    'poi-cafe',
    'area-center',
    'basemap',
  ]);
});

test('Save ZIP downloads a deterministic archive that Open restores as a fresh project', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Bearing' }).fill('35');
  await page.getByRole('textbox', { name: 'Bearing' }).press('Tab');
  await page.getByRole('checkbox', { name: 'Show roads' }).uncheck();

  const downloadArchive = async (filename: string) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save ZIP' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('vienna-field-guide.printmap.zip');
    const outputPath = testInfo.outputPath(filename);
    await download.saveAs(outputPath);
    return outputPath;
  };

  const firstPath = await downloadArchive('project-first.printmap.zip');
  const secondPath = await downloadArchive('project-second.printmap.zip');
  const firstBytes = await readFile(firstPath);
  expect(await readFile(secondPath)).toEqual(firstBytes);

  const entries = unzipSync(firstBytes);
  expect(Object.keys(entries)).toHaveLength(2);
  expect(Object.hasOwn(entries, 'manifest.json')).toBe(true);
  expect(Object.hasOwn(entries, 'project.printmap.json')).toBe(true);
  expect(JSON.parse(strFromU8(entries['manifest.json']))).toEqual({
    format: 'print-map-studio-project',
    archiveVersion: 1,
    project: 'project.printmap.json',
    assets: [],
  });
  expect(JSON.parse(strFromU8(entries['project.printmap.json']))).toMatchObject({
    schemaVersion: 10,
    camera: { bearing: 35, pitch: 0 },
    style: { visibility: { roads: false, buildings: true, labels: true } },
  });

  await page.getByRole('button', { name: 'Portrait' }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(firstPath);

  await expect(page.getByRole('textbox', { name: 'Bearing' })).toHaveValue('35');
  await expect(page.getByRole('checkbox', { name: 'Show roads' })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Landscape' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('status', { name: 'Project file status' })).toContainText('Opened Vienna field guide');
  await expect(page.getByRole('button', { name: 'Open' })).toBeFocused();
});

test('opens a validated portable project as a focused fresh history root', async ({ page, browserName }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Portrait' }).click();
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  const alpineProject = JSON.parse(await readFile(path.resolve('tests/fixtures/alpine-poster.printmap.json'), 'utf8'));
  alpineProject.camera = { bearing: -20, pitch: 35 };
  alpineProject.style = {
    preset: 'positron',
    textScalePercent: 150,
    visibility: { roads: false, buildings: true, labels: false },
  };
  alpineProject.layers.find((layer: { type: string }) => layer.type === 'basemap').name = 'Positron basemap';

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'alpine-poster.printmap.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(alpineProject)),
  });

  await expect(page.getByRole('button', { name: 'Alpine poster' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Summit route' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Positron basemap' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Route 01' })).not.toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Page width' })).toHaveValue('297');
  await expect(page.getByRole('textbox', { name: 'Page height' })).toHaveValue('420');
  await expect(page.getByRole('textbox', { name: 'Bearing' })).toHaveValue('-20');
  await expect(page.getByRole('textbox', { name: 'Pitch' })).toHaveValue('35');
  await expect(page.getByRole('combobox', { name: 'Map style' })).toHaveValue('positron');
  await expect(page.getByRole('textbox', { name: 'Text scale' })).toHaveValue('150');
  await expect(page.getByRole('checkbox', { name: 'Show roads' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Show buildings' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Show labels' })).not.toBeChecked();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-style-preset', 'positron');
  if (browserName !== 'firefox') {
    await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-text-scale', '150');
    await expect(page.getByTestId('map-canvas')).toHaveAttribute(
      'data-map-feature-visibility',
      'roads:false,buildings:true,labels:false',
    );
  }
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
    {
      file: { name: 'broken.printmap.zip', mimeType: 'application/zip', buffer: Buffer.from('not a zip') },
      error: 'not a valid project ZIP archive',
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
  await expect(page.getByRole('status', { name: 'Map data import status' }))
    .toHaveText('Imported 3 GeoJSON layers. Undo removes the whole import.');
  await expect(page.getByRole('button', { name: 'Import' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();

  await page.getByRole('button', { name: 'Select Danube path' }).click();
  await expect(page.getByRole('heading', { name: 'Danube path' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Select Café Central' })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
});

test('imports GPX as one undoable editable layer batch', async ({ page }) => {
  await page.goto('/');

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(path.resolve('tests/fixtures/import/wave2/namespaced.gpx'));

  await expect(page.getByRole('heading', { name: 'Café Central' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Café Central' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Danube route' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Morgenweg 東京' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Map data import status' }))
    .toHaveText('Imported 3 GPX layers. Undo removes the whole import.');
  await expect(page.getByRole('button', { name: 'Import' })).toBeFocused();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Select Café Central' })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
});

test('imports KML as one undoable editable layer batch', async ({ page }) => {
  await page.goto('/');

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(path.resolve('tests/fixtures/import/wave2/namespaced.kml'));

  await expect(page.getByRole('heading', { name: 'Café point' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Café point' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Río line' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select 公園 polygon' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Map data import status' }))
    .toHaveText('Imported 3 KML layers. Undo removes the whole import.');
  await expect(page.getByRole('button', { name: 'Import' })).toBeFocused();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Select Café point' })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
});

test('rejects invalid GPX and KML without changing history and allows a retry', async ({ page }) => {
  await page.goto('/');

  for (const invalidFile of [
    {
      file: { name: 'empty.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from('<gpx xmlns="http://www.topografix.com/GPX/1/1"/>') },
      error: 'GPX contains no supported features',
    },
    {
      file: { name: 'broken.kml', mimeType: 'application/vnd.google-earth.kml+xml', buffer: Buffer.from('<kml>') },
      error: 'not valid KML XML',
    },
    {
      file: { name: 'renamed.txt', mimeType: 'text/plain', buffer: Buffer.from('<gpx/>') },
      error: 'GeoJSON, GPX, or KML file',
    },
  ]) {
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(invalidFile.file);

    await expect(page.getByRole('alert', { name: 'Map data import status' })).toContainText(invalidFile.error);
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Import' })).toBeFocused();
  }

  const retryChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import' }).click();
  const retryChooser = await retryChooserPromise;
  await retryChooser.setFiles(path.resolve('tests/fixtures/import/wave2/namespaced.kml'));
  await expect(page.getByRole('status', { name: 'Map data import status' })).toContainText('Imported 3 KML layers');
  await expect(page.getByRole('button', { name: 'Import' })).toBeFocused();
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

  await expect(page.getByRole('alert', { name: 'Map data import status' }))
    .toContainText('at least one supported Point, LineString, or Polygon feature');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Import' })).toBeFocused();

  const retryChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import' }).click();
  const retryChooser = await retryChooserPromise;
  await retryChooser.setFiles(path.resolve('tests/fixtures/import/supported.geojson'));
  await expect(page.getByRole('status', { name: 'Map data import status' })).toContainText('Imported 3');
  await expect(page.getByRole('button', { name: 'Select Café Central' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import' })).toBeFocused();
});
