import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('oversized raster output remains one PNG and handles picker cancellation', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () => { throw new DOMException('User cancelled.', 'AbortError'); },
    });
  });
  await page.goto('./');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await page.getByRole('spinbutton', { name: 'Page width' }).fill('1400');
  await page.getByRole('spinbutton', { name: 'Page width' }).press('Tab');
  await page.getByRole('button', { name: 'Export' }).click();

  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await expect(dialog.getByText(/streamed into one PNG file/)).toBeVisible();
  await expect(dialog).not.toContainText(/tile/i);
  const save = dialog.getByRole('button', { name: 'Download PNG' });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(dialog.getByRole('status')).toContainText('Export cancelled.');
  await expect(save).toBeEnabled();
});

test('streamed regions decode as one PNG in Chromium', async ({ page }) => {
  await page.goto('./');
  const result = await page.evaluate(async () => {
    const rasterModulePath = '/src/export/largeRasterPng.ts';
    const preflightModulePath = '/src/export/preflight.ts';
    const { createLargeRasterPng } = await import(rasterModulePath);
    const { planExportPreflight } = await import(preflightModulePath);
    const chunks: Uint8Array[] = [];
    const preflight = planExportPreflight({
      format: 'png',
      page: { widthMm: 25.4, heightMm: 25.4 },
      dpi: 100,
      attributions: ['© OpenStreetMap contributors'],
      basemap: 'raster',
      vectorOverlays: true,
      cancellationSupported: true,
      rasterDelivery: 'streaming-png',
    }, { gpuMaxSidePx: 64, preferredTileSidePx: 64, tileOverlapPx: 4 });
    const output = await createLargeRasterPng({
      preflight,
      writable: {
        write: (chunk: Uint8Array) => { chunks.push(Uint8Array.from(chunk)); },
        close: () => {},
        abort: () => {},
      },
      renderTile: async ({ region }: { region: { width: number; height: number } }) => {
        const canvas = document.createElement('canvas');
        canvas.width = region.width;
        canvas.height = region.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        context.fillStyle = '#547f69';
        context.fillRect(0, 0, canvas.width, canvas.height);
        return canvas;
      },
    });
    const blob = new Blob(chunks.map((chunk) => Uint8Array.from(chunk).buffer), { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    const decoded = document.createElement('canvas');
    decoded.width = bitmap.width;
    decoded.height = bitmap.height;
    const decodedContext = decoded.getContext('2d');
    if (!decodedContext) throw new Error('Decoded canvas unavailable');
    decodedContext.drawImage(bitmap, 0, 0);
    return {
      attributionPixel: [...decodedContext.getImageData(99, 99, 1, 1).data],
      blobType: blob.type,
      bytes: blob.size,
      height: bitmap.height,
      renderCount: output.renderCount,
      signature: [...chunks[0].subarray(0, 8)],
      topPixel: [...decodedContext.getImageData(99, 0, 1, 1).data],
      width: bitmap.width,
    };
  });

  expect(result).toMatchObject({
    blobType: 'image/png',
    height: 100,
    signature: [137, 80, 78, 71, 13, 10, 26, 10],
    width: 100,
  });
  expect(result.bytes).toBeGreaterThan(100);
  expect(result.renderCount).toBeGreaterThan(1);
  expect(result.attributionPixel).not.toEqual(result.topPixel);
});

test('large PDF export embeds overlapping native-detail basemap regions', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.goto('./');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so export cannot be exercised.');
  await page.evaluate(() => {
    const browserWindow = window as Window & { __nativeExportRegions?: string[] };
    const nativeExportRegions: string[] = [];
    browserWindow.__nativeExportRegions = nativeExportRegions;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.dataset.nativeExportRegion) {
            nativeExportRegions.push(node.dataset.nativeExportRegion);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  const width = page.getByRole('spinbutton', { name: 'Page width' });
  await width.fill('600');
  await width.press('Tab');
  const height = page.getByRole('spinbutton', { name: 'Page height' });
  await height.fill('50');
  await height.press('Tab');
  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('radio', { name: /PDF/ }).click();

  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  const outputPath = testInfo.outputPath('vienna-field-guide-large.pdf');
  await download.saveAs(outputPath);
  const pdf = await readFile(outputPath);
  const pdfText = pdf.toString('latin1');

  expect(pdfText).toContain('/MediaBox [0 0 1700.787402 141.732283]');
  expect(pdfText.match(/\/Subtype \/Image/g)).toHaveLength(2);
  expect(pdfText).toContain('/Width 3584 /Height 591');
  expect(pdfText).toContain('/Width 3503 /Height 591');
  expect(pdfText.match(/\/Filter \/FlateDecode/g)).toHaveLength(2);
  const allNativeRegions = await page.evaluate(() => (
    (window as Window & { __nativeExportRegions?: string[] }).__nativeExportRegions ?? []
  ));
  const nativeRegions = allNativeRegions.filter((region) => region.endsWith('/7087x591'));
  expect(nativeRegions).toEqual([
    '0,0,3840,591/7087x591',
    '3328,0,3759,591/7087x591',
  ]);
});
