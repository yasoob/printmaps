import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const isHeadlessWebGlDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
);

async function downloadPoiSvgPoint(
  page: import('@playwright/test').Page,
  outputPath: string,
) {
  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const download = await downloadPromise;
  await download.saveAs(outputPath);
  const svgText = await readFile(outputPath, 'utf8');
  const point = await page.evaluate((text) => {
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml');
    const circle = svg.documentElement.querySelector(':scope [data-layer-id="poi-cafe"] circle');
    return [circle?.getAttribute('cx'), circle?.getAttribute('cy')];
  }, svgText);
  await dialog.getByRole('button', { name: 'Close export' }).click();
  return point;
}

async function downloadRouteSvgPath(
  page: import('@playwright/test').Page,
  outputPath: string,
) {
  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const download = await downloadPromise;
  await download.saveAs(outputPath);
  const svgText = await readFile(outputPath, 'utf8');
  const path = await page.evaluate((text) => {
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml');
    return svg.documentElement.querySelector(':scope [data-layer-id="route-01"] path')?.getAttribute('d');
  }, svgText);
  await dialog.getByRole('button', { name: 'Close export' }).click();
  return path;
}

async function downloadShapeSvgPath(
  page: import('@playwright/test').Page,
  outputPath: string,
) {
  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const download = await downloadPromise;
  await download.saveAs(outputPath);
  const svgText = await readFile(outputPath, 'utf8');
  const path = await page.evaluate((text) => {
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml');
    return svg.documentElement.querySelector(':scope [data-layer-id="area-center"] path')?.getAttribute('d');
  }, svgText);
  await dialog.getByRole('button', { name: 'Close export' }).click();
  return path;
}

test('content appearance edits update the live map, history, and layered SVG', async ({ page }, testInfo) => {
  await page.goto('/');
  const mapRoot = page.getByTestId('map-canvas');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so export cannot be exercised.');

  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await page.getByLabel('Route color').fill('#112233');
  await page.getByRole('textbox', { name: 'Route width' }).fill('8');
  await page.getByRole('textbox', { name: 'Route width' }).press('Tab');

  await page.getByRole('button', { name: 'Select Coffee stop' }).click();
  await page.getByLabel('POI color').fill('#445566');
  await page.getByRole('textbox', { name: 'POI marker size' }).fill('21');
  await page.getByRole('textbox', { name: 'POI marker size' }).press('Tab');
  await page.getByRole('combobox', { name: 'POI marker shape' }).selectOption('diamond');
  await page.getByRole('combobox', { name: 'POI marker symbol' }).selectOption('coffee');
  await page.getByRole('textbox', { name: 'POI label' }).fill('Café Central');
  await page.getByRole('textbox', { name: 'POI label' }).press('Tab');
  await page.screenshot({ path: testInfo.outputPath('poi-markers-desktop.png'), fullPage: true });

  await page.getByRole('button', { name: 'Select City center' }).click();
  await page.getByLabel('Shape fill color').fill('#abcdef');
  await page.getByLabel('Shape outline color').fill('#654321');
  await page.getByRole('textbox', { name: 'Shape outline width' }).fill('3');
  await page.getByRole('textbox', { name: 'Shape outline width' }).press('Tab');
  await expect(mapRoot).toHaveAttribute(
    'data-map-layer-appearance',
    'route-01:#112233:8:car:false|poi-cafe:#445566:21:diamond:coffee:Café Central|area-center:#abcdef:#654321:3',
  );

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('textbox', { name: 'Shape outline width' })).toHaveValue('2');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('textbox', { name: 'Shape outline width' })).toHaveValue('3');

  await page.getByRole('button', { name: 'Export' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('dialog', { name: 'Export map' })
    .getByRole('button', { name: 'Download layered SVG' })
    .click();
  const download = await downloadPromise;
  const outputPath = testInfo.outputPath('custom-appearance.layered.svg');
  await download.saveAs(outputPath);
  const svgText = await readFile(outputPath, 'utf8');
  const appearance = await page.evaluate((text) => {
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml');
    const route = svg.documentElement.querySelector(':scope [data-layer-id="route-01"] path');
    const poi = svg.documentElement.querySelector(':scope [data-layer-id="poi-cafe"]');
    const poiMarker = poi?.querySelector(':scope [data-poi-marker-shape="diamond"] path');
    const shape = svg.documentElement.querySelector(':scope [data-layer-id="area-center"] path');
    return {
      route: [route?.getAttribute('stroke'), route?.getAttribute('stroke-width')],
      poi: [
        poiMarker?.getAttribute('fill'),
        poi?.querySelector(':scope [data-poi-marker-symbol="coffee"]')?.textContent,
        poi?.querySelector(':scope [data-poi-label]')?.textContent,
      ],
      shape: [
        shape?.getAttribute('fill'),
        shape?.getAttribute('stroke'),
        shape?.getAttribute('stroke-width'),
      ],
    };
  }, svgText);
  expect(appearance).toEqual({
    route: ['#112233', '2.4'],
    poi: ['#445566', 'C', 'Café Central'],
    shape: ['#abcdef', '#654321', '0.75'],
  });
});

test('POI coordinates update the live map, history, portable project, and layered SVG', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(message.text());
  });
  await page.goto('/');
  const mapRoot = page.getByTestId('map-canvas');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so live geometry/export cannot be exercised.');

  await page.getByRole('button', { name: 'Select Coffee stop' }).click();
  const initialPoint = await downloadPoiSvgPoint(page, testInfo.outputPath('poi-before.layered.svg'));
  const longitude = page.getByRole('textbox', { name: 'POI longitude' });
  const latitude = page.getByRole('textbox', { name: 'POI latitude' });
  await longitude.fill('16.4');
  await longitude.press('Tab');
  await expect(latitude).toBeFocused();
  await expect(mapRoot).toHaveAttribute('data-map-layer-geometry', /poi-cafe:\[16\.4,48\.2084\]/);
  await latitude.fill('48.25');
  await latitude.press('Tab');
  await expect(mapRoot).toHaveAttribute('data-map-layer-geometry', /poi-cafe:\[16\.4,48\.25\]/);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('textbox', { name: 'POI latitude' })).toHaveValue('48.2084');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('textbox', { name: 'POI latitude' })).toHaveValue('48.25');

  const movedPoint = await downloadPoiSvgPoint(page, testInfo.outputPath('poi-after.layered.svg'));
  expect(movedPoint).not.toEqual(initialPoint);
  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const projectDownload = await savePromise;
  const projectPath = testInfo.outputPath('poi-edited.printmap.json');
  await projectDownload.saveAs(projectPath);
  const project = JSON.parse(await readFile(projectPath, 'utf8')) as {
    layers: Array<{ id: string; geometry?: { coordinates: unknown } }>;
  };
  expect(project.layers.find((layer) => layer.id === 'poi-cafe')?.geometry?.coordinates).toEqual([16.4, 48.25]);
  expect(consoleProblems).toEqual([]);
});

test('route vertex coordinates update the live map, history, portable project, and layered SVG', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(message.text());
  });
  await page.goto('/');
  const mapRoot = page.getByTestId('map-canvas');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so live geometry/export cannot be exercised.');

  await page.getByRole('button', { name: 'Select Route 01' }).click();
  const initialPath = await downloadRouteSvgPath(page, testInfo.outputPath('route-before.layered.svg'));
  await page.getByRole('combobox', { name: 'Route vertex' }).selectOption('1');
  const longitude = page.getByRole('textbox', { name: 'Route vertex longitude' });
  const latitude = page.getByRole('textbox', { name: 'Route vertex latitude' });
  await longitude.fill('16.4');
  await longitude.press('Tab');
  await expect(latitude).toBeFocused();
  await latitude.fill('48.25');
  await latitude.press('Tab');
  await expect(mapRoot).toHaveAttribute('data-map-layer-geometry', /route-01:\[\[16\.326,48\.194\],\[16\.4,48\.25\]/);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('textbox', { name: 'Route vertex latitude' })).toHaveValue('48.205');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('textbox', { name: 'Route vertex latitude' })).toHaveValue('48.25');

  const movedPath = await downloadRouteSvgPath(page, testInfo.outputPath('route-after.layered.svg'));
  expect(movedPath).toBeTruthy();
  expect(movedPath).not.toEqual(initialPath);
  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const projectDownload = await savePromise;
  const projectPath = testInfo.outputPath('route-edited.printmap.json');
  await projectDownload.saveAs(projectPath);
  const project = JSON.parse(await readFile(projectPath, 'utf8')) as {
    layers: Array<{ id: string; geometry?: { coordinates: unknown } }>;
  };
  expect(project.layers.find((layer) => layer.id === 'route-01')?.geometry?.coordinates).toEqual([
    [16.326, 48.194], [16.4, 48.25], [16.391, 48.215], [16.429, 48.226],
  ]);
  expect(consoleProblems).toEqual([]);
});

test('shape vertex coordinates preserve ring closure across the live map, history, project, and layered SVG', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isHeadlessWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });
  await page.goto('/');
  const mapRoot = page.getByTestId('map-canvas');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so live geometry/export cannot be exercised.');

  await page.getByRole('button', { name: 'Select City center' }).click();
  const initialPath = await downloadShapeSvgPath(page, testInfo.outputPath('shape-before.layered.svg'));
  const longitude = page.getByRole('textbox', { name: 'Shape vertex longitude' });
  const latitude = page.getByRole('textbox', { name: 'Shape vertex latitude' });
  await longitude.fill('16.35');
  await longitude.press('Tab');
  await expect(latitude).toBeFocused();
  await latitude.fill('48.19');
  await latitude.press('Tab');
  await expect(mapRoot).toHaveAttribute(
    'data-map-layer-geometry',
    /area-center:\[\[\[16\.35,48\.19\].*\[16\.35,48\.19\]\]\]/,
  );

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('textbox', { name: 'Shape vertex latitude' })).toHaveValue('48.198');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('textbox', { name: 'Shape vertex latitude' })).toHaveValue('48.19');

  const movedPath = await downloadShapeSvgPath(page, testInfo.outputPath('shape-after.layered.svg'));
  expect(movedPath).toBeTruthy();
  expect(movedPath).not.toEqual(initialPath);
  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const projectDownload = await savePromise;
  const projectPath = testInfo.outputPath('shape-edited.printmap.json');
  await projectDownload.saveAs(projectPath);
  const project = JSON.parse(await readFile(projectPath, 'utf8')) as {
    layers: Array<{ id: string; geometry?: { coordinates: unknown } }>;
  };
  expect(project.layers.find((layer) => layer.id === 'area-center')?.geometry?.coordinates).toEqual([[
    [16.35, 48.19], [16.395, 48.198], [16.395, 48.22], [16.354, 48.22], [16.35, 48.19],
  ]]);
  expect(consoleProblems).toEqual([]);
});
