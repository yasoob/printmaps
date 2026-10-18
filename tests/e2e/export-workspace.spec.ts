import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { chooseOption, expectSelectValue } from './select-support';

async function openWorkspace(page: Page) {
  await page.goto('./');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 40_000 });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  return page.getByRole('dialog', { name: 'Export map' });
}

async function expectSingleFittingDialog(page: Page, dialog: Locator) {
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(1);
  const fit = await dialog.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      left: box.left, top: box.top, right: box.right, bottom: box.bottom,
      viewportWidth: innerWidth, viewportHeight: innerHeight,
      overflow: element.scrollWidth - element.clientWidth,
      bodyOverflow: [...element.querySelectorAll('.studio-dialog-body')].map((body) => body.scrollWidth - body.clientWidth),
    };
  });
  expect(fit.left).toBeGreaterThanOrEqual(0);
  expect(fit.top).toBeGreaterThanOrEqual(0);
  expect(fit.right).toBeLessThanOrEqual(fit.viewportWidth);
  expect(fit.bottom).toBeLessThanOrEqual(fit.viewportHeight);
  expect(fit.overflow).toBeLessThanOrEqual(1);
  expect(fit.bodyOverflow.every((overflow) => overflow <= 1)).toBe(true);
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 700 }]) {
  test(`single export workspace destinations and framed back path fit ${viewport.width}px`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    const dialog = await openWorkspace(page);
    const shell = await dialog.elementHandle();
    await expect(dialog.getByRole('tab', { name: 'Print', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.getByRole('button', { name: 'Download PNG' })).toBeFocused();
    await expectSingleFittingDialog(page, dialog);
    await page.screenshot({ path: info.outputPath(`print-${viewport.width}.png`) });
    await dialog.getByRole('radio', { name: /Layered SVG/ }).click();
    await chooseOption(dialog, 'Basemap rendering', 'True vector artwork (reflowed labels)');
    await expectSingleFittingDialog(page, dialog);
    await page.screenshot({ path: info.outputPath(`vector-${viewport.width}.png`) });
    await dialog.getByRole('button', { name: 'Basemap rendering help' }).click();
    await expect(dialog.getByRole('tooltip')).toContainText('Nothing automatically falls back to an image.');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('tab', { name: 'Video', exact: true }).click();
    await expect(dialog.getByLabel('Duration')).toBeVisible();
    await expectSingleFittingDialog(page, dialog);
    const capability = await dialog.getByRole('button', { name: 'Download MP4' }).isDisabled();
    if (capability) {
      await expect(dialog.getByRole('alert')).toContainText(/MP4|canvas/);
      await expect(dialog.getByRole('alert')).toBeInViewport();
      info.annotations.push({ type: 'native-mp4-unavailable', description: await dialog.getByRole('alert').textContent() ?? 'MP4 unsupported' });
    }
    await page.screenshot({ path: info.outputPath(`video-${capability ? 'capability' : 'idle'}-${viewport.width}.png`) });
    await chooseOption(dialog, 'Duration', '15 seconds');
    await dialog.getByRole('tab', { name: '3D model', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Download STL' })).toBeInViewport();
    await expectSingleFittingDialog(page, dialog);
    await page.screenshot({ path: info.outputPath(`3d-model-${viewport.width}.png`) });
    await dialog.getByRole('tab', { name: 'Video', exact: true }).click();
    await expectSelectValue(dialog, 'Duration', '15');
    await dialog.getByRole('tab', { name: 'Print', exact: true }).click();
    await expectSelectValue(dialog, 'Basemap rendering', 'vector');
    await dialog.getByRole('button', { name: 'Preview on wall' }).click();
    await expect(dialog.getByRole('img', { name: /finished map poster/ })).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByRole('button', { name: 'Back to export' })).toBeFocused();
    await expectSingleFittingDialog(page, dialog);
    await page.screenshot({ path: info.outputPath(`framed-preview-${viewport.width}.png`) });
    await dialog.getByRole('button', { name: 'Back to export' }).click();
    await expectSelectValue(dialog, 'Basemap rendering', 'vector');
    await expect(dialog.getByRole('button', { name: 'Download layered SVG' })).toBeFocused();
    expect(await shell!.evaluate((element) => element === document.querySelector('[role="dialog"]'))).toBe(true);
    await page.screenshot({ path: info.outputPath(`back-to-export-${viewport.width}.png`) });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeFocused();
  });
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`simulated controller only: video idle, busy and explicit cancellation at ${viewport.width}px`, async ({ page }, info) => {
    // Only the job and capability are simulated; this is not MP4 encoding evidence.
    await page.route('**/src/video/capability.ts', (route) => route.fulfill({
      contentType: 'application/javascript',
      body: 'export function getVideoCapability() { return { supported: true, mimeType: "video/mp4" }; }',
    }));
    await page.route('**/src/video/exportVideoDocument.ts', (route) => route.fulfill({
      contentType: 'application/javascript',
      body: `export function exportVideoDocument({signal,onProgress}) {
        onProgress({phase:"recording",fraction:0.35,presentedFrames:105,missedFrameSlots:2});
        return new Promise((resolve,reject) => signal.addEventListener("abort",()=>reject(signal.reason),{once:true}));
      }`,
    }));
    await page.setViewportSize(viewport);
    const dialog = await openWorkspace(page);
    await dialog.getByRole('tab', { name: 'Video', exact: true }).click();
    const download = dialog.getByRole('button', { name: 'Download MP4' });
    await expect(download).toBeEnabled();
    await page.screenshot({ path: info.outputPath(`simulated-video-idle-${viewport.width}.png`) });
    const downloads: string[] = [];
    page.on('download', (item) => { downloads.push(item.suggestedFilename()); });
    await download.click();
    await expect(dialog.getByRole('status')).toContainText('Recording 35%');
    await expect(dialog.getByRole('status')).toBeInViewport();
    await expect(dialog.getByRole('progressbar')).toBeInViewport();
    const tabs = await dialog.getByRole('tab').all();
    for (const tab of tabs) await expect(tab).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Close export' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await expectSingleFittingDialog(page, dialog);
    await page.screenshot({ path: info.outputPath(`simulated-video-busy-${viewport.width}.png`) });
    await dialog.getByRole('button', { name: 'Cancel recording' }).click();
    await expect(dialog.getByRole('status')).toContainText('No file downloaded');
    await expect(download).toBeFocused();
    await dialog.getByRole('tab', { name: 'Print', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
    expect(downloads).toEqual([]);
    info.annotations.push({ type: 'simulated-controller', description: 'Busy/focus/cancel UI only; no MP4 encoder or fake encoded file.' });
  });
}

test('the workspace downloads real PNG, true-vector SVG, and binary terrain STL', async ({ page }, info) => {
  test.setTimeout(180_000);
  const dialog = await openWorkspace(page);
  const pngDownload = page.waitForEvent('download', { timeout: 90_000 });
  await dialog.getByRole('button', { name: 'Download PNG' }).click();
  const pngPath = info.outputPath('workspace-map.png');
  const downloadedPng = await pngDownload;
  await downloadedPng.saveAs(pngPath);
  const png = await readFile(pngPath);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.readUInt32BE(16)).toBe(3508);
  expect(png.readUInt32BE(20)).toBe(2480);
  await dialog.getByRole('radio', { name: /Layered SVG/ }).click();
  await chooseOption(dialog, 'Basemap rendering', 'True vector artwork (reflowed labels)');
  const svgDownload = page.waitForEvent('download', { timeout: 60_000 });
  await dialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const svgPath = info.outputPath('workspace-map.svg');
  const downloadedSvg = await svgDownload;
  await downloadedSvg.saveAs(svgPath);
  const svg = await readFile(svgPath, 'utf8');
  expect(svg).toContain('data-basemap-content="vector"');
  expect(svg).not.toContain('<image');
  expect(svg.match(/<path /g)!.length).toBeGreaterThan(100);
  const terrainTile = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const context = canvas.getContext('2d')!;
    const pixels = context.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const elevation = 33_768 + Math.round(500 * Math.sin(x / 255 * Math.PI) * Math.sin(y / 255 * Math.PI));
        pixels.data.set([Math.floor(elevation / 256), elevation % 256, 0, 255], (y * 256 + x) * 4);
      }
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL('image/png').split(',', 2)[1];
  });
  await page.route('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**', (route) => route.fulfill({
    body: Buffer.from(terrainTile, 'base64'), contentType: 'image/png', headers: { 'access-control-allow-origin': '*' },
  }));
  await dialog.getByRole('tab', { name: '3D model' }).click();
  await dialog.getByRole('button', { name: 'Fit dimensions to print frame' }).click();
  await chooseOption(dialog, 'Relief detail', 'Low · 64 samples');
  const stlDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download STL' }).click();
  const stlPath = info.outputPath('workspace-terrain.stl');
  const downloadedStl = await stlDownload;
  await downloadedStl.saveAs(stlPath);
  const stl = await readFile(stlPath);
  const triangleCount = stl.readUInt32LE(80);
  expect(triangleCount).toBeGreaterThan(1000);
  expect(stl.byteLength).toBe(84 + triangleCount * 50);
  await expect(dialog.getByRole('status')).toContainText('STL downloaded');
  info.annotations.push({ type: 'terrain-fixture', description: 'Real elevation decoding, relief mesh and binary STL serialization using deterministic Terrarium tiles.' });
});
