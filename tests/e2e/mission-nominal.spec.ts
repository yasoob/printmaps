import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { waitForAutosaveReady } from './autosave-fixture';

const isFirefoxDisplayEnabled = process.env.PRINTMAP_FIREFOX_HEADED === '1';

const isExpectedWebGlDiagnostic = (message: string, browserName: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
  || (browserName === 'firefox' && message.includes('WebGL context was lost.'))
);


test('nominal design, author, import, persist, reopen, and export workflow', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if (
      (message.type() === 'error' || message.type() === 'warning')
      && !isExpectedWebGlDiagnostic(message.text(), testInfo.project.name)
    ) {
      consoleProblems.push(message.text());
    }
  });

  await page.goto('/');
  await waitForAutosaveReady(page);
  const mapCanvas = page.getByTestId('map-canvas');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(
    testInfo.project.name === 'firefox'
      && !isFirefoxDisplayEnabled
      && await mapFallback.isVisible(),
    'This browser runtime has no WebGL 2 renderer; use npm run test:e2e for the headed Xvfb release gate.',
  );
  await expect(mapCanvas).toHaveAttribute('data-map-ready', 'true');

  await page.getByRole('radio', { name: /^Sea Glass:/ }).click();
  await expect(mapCanvas).toHaveAttribute('data-style-preset', 'sea-glass');
  await expect(mapCanvas).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const width = page.getByRole('spinbutton', { name: 'Page width' });
  const height = page.getByRole('spinbutton', { name: 'Page height' });
  await width.fill('20');
  await width.press('Tab');
  await height.fill('60');
  await height.press('Tab');
  await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Route (R)' }).click();
  const canvas = page.locator('.maplibregl-canvas');
  const canvasBox = await canvas.boundingBox();
  const frameBox = await page.locator('.print-frame').boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  const routePoint = (xFraction: number, yFraction: number) => ({
    x: frameBox!.x - canvasBox!.x + frameBox!.width * xFraction,
    y: frameBox!.y - canvasBox!.y + frameBox!.height * yFraction,
  });
  await canvas.click({ position: routePoint(0.3, 0.35) });
  await canvas.click({ position: routePoint(0.7, 0.65) });
  await page.getByRole('button', { name: 'Finish route' }).click();
  await expect(page.getByRole('button', { name: 'Select Route 02' })).toHaveAttribute('aria-current', 'true');
  await page.getByRole('spinbutton', { name: 'Route width' }).fill('6');
  await page.getByRole('spinbutton', { name: 'Route width' }).press('Tab');
  await expect(mapCanvas).toHaveAttribute('data-map-layer-order', /route-02/);

  await page.locator('input[accept^=".geojson"][multiple]').setInputFiles(path.resolve('tests/fixtures/import/supported.geojson'));
  await expect(page.getByRole('status', { name: 'Map data import status' }))
    .toHaveText('Imported 3 GeoJSON layers. Undo removes the whole import.');
  await expect(page.getByRole('button', { name: 'Select Café Central' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Select Route 02' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Café Central' })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Page width' })).toHaveValue('20');
  await expect(page.getByRole('spinbutton', { name: 'Page height' })).toHaveValue('60');
  await expect(mapCanvas).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });

  const projectDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Download project' }).click();
  const projectDownload = await projectDownloadPromise;
  const projectPath = testInfo.outputPath('nominal-workflow.printmap.json');
  await projectDownload.saveAs(projectPath);
  const savedProject = JSON.parse(await readFile(projectPath, 'utf8'));
  expect(savedProject).toMatchObject({
    schemaVersion: 21,
    page: { widthMm: 20, heightMm: 60, orientation: 'portrait' },
    style: { preset: 'sea-glass' },
  });
  expect(savedProject.layers.map((layer: { id: string }) => layer.id)).toContain('route-02');

  await page.getByRole('button', { name: 'Landscape' }).click();
  const openChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Open project' }).click();
  const openChooser = await openChooserPromise;
  await openChooser.setFiles(projectPath);
  await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Select Route 02' })).toBeVisible();
  await expect(mapCanvas).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });

  await page.getByRole('button', { name: 'Export' }).click();
  let exportDialog = page.getByRole('dialog', { name: 'Export map' });
  await exportDialog.getByRole('radio', { name: /Layered SVG/ }).click();
  let downloadPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Download layered SVG' }).click();
  let download = await downloadPromise;
  const svgPath = testInfo.outputPath('nominal-workflow.layered.svg');
  await download.saveAs(svgPath);
  const svg = await readFile(svgPath, 'utf8');
  expect(svg).toContain('width="20mm"');
  expect(svg).toContain('height="60mm"');
  expect(svg).toContain('data-layer-name="Route 02"');
  expect(svg).toContain('data-layer-name="Café Central"');
  await exportDialog.getByRole('button', { name: 'Close export' }).click();

  await page.getByRole('button', { name: 'Export' }).click();
  exportDialog = page.getByRole('dialog', { name: 'Export map' });
  await exportDialog.getByRole('radio', { name: /PDF/ }).click();
  downloadPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Download PDF' }).click();
  download = await downloadPromise;
  const pdfPath = testInfo.outputPath('nominal-workflow.pdf');
  await download.saveAs(pdfPath);
  const pdf = await readFile(pdfPath);
  expect(pdf.subarray(0, 8).toString('latin1')).toBe('%PDF-1.7');
  expect(pdf.toString('latin1')).toContain('/Type /OCG /Name (Route 02)');
  await exportDialog.getByRole('button', { name: 'Close export' }).click();

  await page.getByRole('button', { name: 'Export' }).click();
  exportDialog = page.getByRole('dialog', { name: 'Export map' });
  await expect(exportDialog).toContainText('236 × 709 px — 300 DPI pixel target');
  downloadPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Download PNG' }).click();
  download = await downloadPromise;
  const pngPath = testInfo.outputPath('nominal-workflow.png');
  await download.saveAs(pngPath);
  const png = await readFile(pngPath);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.readUInt32BE(16)).toBe(236);
  expect(png.readUInt32BE(20)).toBe(709);
  await exportDialog.getByRole('button', { name: 'Close export' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  expect(consoleProblems).toEqual([]);
});
