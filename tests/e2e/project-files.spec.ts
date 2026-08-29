import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test('Download project saves the current portable versioned JSON', async ({ context, page }, testInfo) => {
  await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:4175' });
  await context.setGeolocation({ longitude: 16.41, latitude: 48.23 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-center', '16.41,48.23');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-zoom', '14');
  await page.getByRole('spinbutton', { name: 'Bearing' }).fill('35');
  await page.getByRole('spinbutton', { name: 'Pitch' }).fill('40');
  await page.getByRole('spinbutton', { name: 'Pitch' }).press('Tab');
  await page.getByRole('spinbutton', { name: 'Text scale' }).fill('125');
  await page.getByRole('spinbutton', { name: 'Text scale' }).press('Tab');
  await page.getByRole('checkbox', { name: 'Show roads' }).uncheck();
  await page.getByRole('checkbox', { name: 'Show water' }).uncheck();
  await page.getByRole('button', { name: 'Portrait' }).click();
  await page.getByRole('radio', { name: /^Night Ink:/ }).click();
  await page.getByRole('combobox', { name: 'Map language' }).selectOption('de');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Download project' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('vienna-field-guide.printmap.json');

  const outputPath = testInfo.outputPath('vienna-field-guide.printmap.json');
  await download.saveAs(outputPath);
  const savedProject = JSON.parse(await readFile(outputPath, 'utf8'));
  expect(savedProject).toMatchObject({
    schemaVersion: 21,
    id: 'vienna-field-guide',
    title: 'Vienna field guide',
    page: { preset: 'A4', widthMm: 210, heightMm: 297, orientation: 'portrait' },
    camera: { bearing: 35, center: [16.41, 48.23], locked: false, pitch: 40, zoom: 14 },
    style: {
      preset: 'night-ink',
      language: 'de',
      textScalePercent: 125,
      visibility: { roads: false, buildings: true, labels: true, water: false, parks: true, landuse: true, transit: true },
    },
  });
  expect(savedProject.layers.map((layer: { id: string }) => layer.id)).toEqual([
    'route-01',
    'poi-cafe',
    'area-center',
    'basemap',
  ]);
});

test('Project download and open restore the current project as a fresh history root', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('spinbutton', { name: 'Bearing' }).fill('35');
  await page.getByRole('spinbutton', { name: 'Bearing' }).press('Tab');
  await page.getByRole('checkbox', { name: 'Show roads' }).uncheck();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Download project' }).click();
  const download = await downloadPromise;
  const projectPath = testInfo.outputPath('saved-project.printmap.json');
  await download.saveAs(projectPath);

  await page.getByRole('button', { name: 'Portrait' }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Open project' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(projectPath);

  await expect(page.getByRole('spinbutton', { name: 'Bearing' })).toHaveValue('35');
  await expect(page.getByRole('checkbox', { name: 'Show roads' })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Landscape' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Project' })).toBeFocused();
});

test('opens a validated portable project as a focused fresh history root', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Portrait' }).click();
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  const alpineProject = JSON.parse(await readFile(path.resolve('tests/fixtures/alpine-poster.printmap.json'), 'utf8'));
  alpineProject.camera = { bearing: -20, center: [11.34, 47.31], locked: true, pitch: 35, zoom: 13.5 };
  alpineProject.style = {
    preset: 'night-ink',
    language: 'de',
    textScalePercent: 150,
    visibility: { roads: false, buildings: true, labels: false, water: false, parks: true, landuse: true, transit: true },
  };
  alpineProject.layers.find((layer: { type: string }) => layer.type === 'basemap').name = 'Night Ink basemap';

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Open project' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'alpine-poster.printmap.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(alpineProject)),
  });

  await expect(page.getByRole('button', { name: 'Alpine poster' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Summit route' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Night Ink basemap' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Route 01' })).not.toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Page width' })).toHaveValue('297');
  await expect(page.getByRole('spinbutton', { name: 'Page height' })).toHaveValue('420');
  await expect(page.getByRole('spinbutton', { name: 'Bearing' })).toHaveValue('-20');
  await expect(page.getByRole('spinbutton', { name: 'Pitch' })).toHaveValue('35');
  await expect(page.getByRole('switch', { name: 'Lock map area' })).toBeChecked();
  await expect(page.getByRole('radio', { name: /^Night Ink:/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('combobox', { name: 'Map language' })).toHaveValue('de');
  await expect(page.getByRole('spinbutton', { name: 'Text scale' })).toHaveValue('150');
  await expect(page.getByRole('checkbox', { name: 'Show roads' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Show buildings' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Show labels' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Show water' })).not.toBeChecked();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-style-preset', 'night-ink');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-center', '11.34,47.31');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-zoom', '13.5');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-text-scale', '150');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute(
    'data-map-feature-visibility',
    'roads:false,buildings:true,labels:false,water:false,parks:true,landuse:true,transit:true',
  );
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Project' })).toBeFocused();
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
    await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Open project' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(invalidFile.file);

    await expect(page.getByRole('alert', { name: 'Project file status' })).toContainText(invalidFile.error);
    await expect(page.getByRole('button', { name: 'Vienna field guide' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Project' })).toBeFocused();
  }

  const retryChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Open project' }).click();
  const retryChooser = await retryChooserPromise;
  await retryChooser.setFiles(path.resolve('tests/fixtures/alpine-poster.printmap.json'));
  await expect(page.getByRole('button', { name: 'Alpine poster' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Project' })).toBeFocused();
});

test('imports supported GeoJSON as one undoable editable layer batch', async ({ page }) => {
  await page.goto('/');

  const chooserPromise = page.waitForEvent('filechooser');
  const project = page.getByRole('button', { name: 'Project' });
  await project.click();
  await page.getByRole('menuitem', { name: 'Import map data' }).click();
  await expect(project).toHaveAttribute('aria-expanded', 'false');
  const chooser = await chooserPromise;
  await chooser.setFiles(path.resolve('tests/fixtures/import/supported.geojson'));

  await expect(page.getByRole('heading', { name: 'Café Central' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Café Central' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Danube path' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Inner district' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Map data import status' }))
    .toHaveText('Imported 3 GeoJSON layers. Undo removes the whole import.');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();

  await page.getByRole('button', { name: 'Select Danube path' }).click();
  await expect(page.getByRole('heading', { name: 'Danube path' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Select Café Central' })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
});

test('drops multiple map-data files as one reviewed batch and fits their combined extent', async ({ page }) => {
  await page.goto('/');
  const files = await Promise.all([
    ['supported.geojson', 'application/geo+json', 'tests/fixtures/import/supported.geojson'],
    ['namespaced.kml', 'application/vnd.google-earth.kml+xml', 'tests/fixtures/import/wave2/namespaced.kml'],
  ].map(async ([name, type, filename]) => {
    const bytes = await readFile(path.resolve(filename));
    return { name, type, base64: bytes.toString('base64') };
  }));
  const transfer = await page.evaluateHandle((entries) => {
    const dataTransfer = new DataTransfer();
    for (const entry of entries) {
      const bytes = Uint8Array.from(atob(entry.base64), (character) => character.codePointAt(0) ?? 0);
      dataTransfer.items.add(new File([bytes], entry.name, { type: entry.type }));
    }
    return dataTransfer;
  }, files);

  await page.locator('.canvas-region').dispatchEvent('dragenter', { dataTransfer: transfer });
  await expect(page.getByText('Drop GeoJSON, GPX, or KML files')).toBeVisible();
  await page.locator('.canvas-region').dispatchEvent('drop', { dataTransfer: transfer });

  const dialog = page.getByRole('dialog', { name: 'Import map data' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('supported.geojson')).toBeVisible();
  await expect(dialog.getByText('namespaced.kml')).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'Fit imported content' })).toBeChecked();
  await dialog.getByRole('button', { name: 'Import 2 files' }).click();

  await expect(page.getByRole('status', { name: 'Map data import status' }))
    .toHaveText('Imported 2 files as 6 layers. Undo removes the whole import.');
  await expect(page.getByRole('button', { name: 'Select Café Central' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Café point' })).toBeVisible();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-camera-fit-import', '1');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Select Café Central' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Café point' })).not.toBeVisible();
});

test('replaces a reviewed import batch without changing the explicit retain-view choice', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[accept^=".geojson"]').setInputFiles([
    path.resolve('tests/fixtures/import/supported.geojson'),
    path.resolve('tests/fixtures/import/wave2/namespaced.gpx'),
  ]);

  const dialog = page.getByRole('dialog', { name: 'Import map data' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: 'Keep current view' }).check();
  const replacementChooserPromise = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Replace files' }).click();
  const replacementChooser = await replacementChooserPromise;
  await replacementChooser.setFiles(path.resolve('tests/fixtures/import/wave2/namespaced.kml'));

  await expect(dialog.getByRole('radio', { name: 'Keep current view' })).toBeChecked();
  await expect(dialog.getByText('namespaced.kml')).toBeVisible();
  await expect(dialog.getByText('supported.geojson')).not.toBeVisible();
  await dialog.getByRole('button', { name: 'Import 1 files' }).click();

  await expect(page.getByRole('button', { name: 'Select Café point' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Café Central' })).not.toBeVisible();
  await expect(page.getByTestId('map-canvas')).not.toHaveAttribute('data-camera-fit-import');
});

test('ignores map-data drops while another modal workflow owns the editor', async ({ page }) => {
  test.slow();
  await page.goto('/');
  await page.getByRole('button', { name: 'Export' }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export map' });
  await expect(exportDialog).toBeVisible();
  const transfer = await page.evaluateHandle(() => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(['{}'], 'blocked.geojson', { type: 'application/geo+json' }));
    return dataTransfer;
  });

  await page.locator('.canvas-region').dispatchEvent('dragenter', { dataTransfer: transfer });
  await page.locator('.canvas-region').dispatchEvent('drop', { dataTransfer: transfer });

  await expect(exportDialog).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Import map data' })).not.toBeVisible();
});

test('contains import review focus and restores it after cancelling a dropped batch', async ({ page }) => {
  await page.goto('/');
  const transfer = await page.evaluateHandle(() => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([
      JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { name: 'Dropped point' },
          geometry: { type: 'Point', coordinates: [16.37, 48.21] },
        }],
      }),
    ], 'dropped.geojson', { type: 'application/geo+json' }));
    return dataTransfer;
  });
  await page.locator('.canvas-region').dispatchEvent('drop', { dataTransfer: transfer });

  const dialog = page.getByRole('dialog', { name: 'Import map data' });
  const addFiles = dialog.getByRole('button', { name: 'Import 1 files' });
  await expect(addFiles).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close map data import' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(addFiles).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Project' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('imports GPX as one undoable editable layer batch', async ({ page }) => {
  await page.goto('/');

  await page.locator('input[accept^=".geojson"]').setInputFiles(path.resolve('tests/fixtures/import/wave2/namespaced.gpx'));

  await expect(page.getByRole('heading', { name: 'Café Central' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Café Central' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Danube route' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Morgenweg 東京' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Map data import status' }))
    .toHaveText('Imported 3 GPX layers. Undo removes the whole import.');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Select Café Central' })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
});

test('imports KML as one undoable editable layer batch', async ({ page }) => {
  await page.goto('/');

  await page.locator('input[accept^=".geojson"]').setInputFiles(path.resolve('tests/fixtures/import/wave2/namespaced.kml'));

  await expect(page.getByRole('heading', { name: 'Café point' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Café point' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Río line' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select 公園 polygon' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Map data import status' }))
    .toHaveText('Imported 3 KML layers. Undo removes the whole import.');

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
    await page.locator('input[accept^=".geojson"]').setInputFiles(invalidFile.file);

    await expect(page.getByRole('alert', { name: 'Map data import status' })).toContainText(invalidFile.error);
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
    }

  await page.locator('input[accept^=".geojson"]').setInputFiles(path.resolve('tests/fixtures/import/wave2/namespaced.kml'));
  await expect(page.getByRole('status', { name: 'Map data import status' })).toContainText('Imported 3 KML layers');
});

test('rejects empty GeoJSON without changing history and allows the same chooser to retry', async ({ page }) => {
  await page.goto('/');

  await page.locator('input[accept^=".geojson"]').setInputFiles({
    name: 'empty.geojson',
    mimeType: 'application/geo+json',
    buffer: Buffer.from('{"type":"FeatureCollection","features":[]}'),
  });

  await expect(page.getByRole('alert', { name: 'Map data import status' }))
    .toContainText('at least one supported Point, LineString, or Polygon feature');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();

  await page.locator('input[accept^=".geojson"]').setInputFiles(path.resolve('tests/fixtures/import/supported.geojson'));
  await expect(page.getByRole('status', { name: 'Map data import status' })).toContainText('Imported 3');
  await expect(page.getByRole('button', { name: 'Select Café Central' })).toBeVisible();
});
