import { readFile, stat } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('export downloads the current print frame as PNG on desktop and mobile', async ({ page }, testInfo) => {
  await page.goto('/');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so export cannot be exercised.');

  for (const viewport of [
    { width: 1440, height: 900, label: 'desktop' },
    { width: 390, height: 844, label: 'mobile' },
    { width: 390, height: 520, label: 'short-mobile' },
  ]) {
    await page.setViewportSize(viewport);
    await page.getByRole('button', { name: 'Export' }).click();
    const dialog = page.getByRole('dialog', { name: 'Export map' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('current print-frame preview');
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport.height);

    const frameBox = await page.locator('.print-frame').boundingBox();
    expect(frameBox).not.toBeNull();
    const deviceScaleFactor = await page.evaluate(() => window.devicePixelRatio);
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download PNG' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('vienna-field-guide.png');
    const outputPath = testInfo.outputPath(`vienna-field-guide-${viewport.label}.png`);
    await download.saveAs(outputPath);
    const outputStats = await stat(outputPath);
    expect(outputStats.size).toBeGreaterThan(1000);
    const png = await readFile(outputPath);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const pngWidth = png.readUInt32BE(16);
    const pngHeight = png.readUInt32BE(20);
    expect(Math.abs(pngWidth - Math.round(frameBox!.width * deviceScaleFactor))).toBeLessThanOrEqual(1);
    expect(Math.abs(pngHeight - Math.round(frameBox!.height * deviceScaleFactor))).toBeLessThanOrEqual(1);
    const pixelEvidence = await page.evaluate(async (encoded) => {
      const image = new Image();
      image.src = `data:image/png;base64,${encoded}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('PNG verification canvas unavailable');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let opaque = 0;
      let darkest = 255;
      let lightest = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] > 0) opaque += 1;
        const luminance = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
        darkest = Math.min(darkest, luminance);
        lightest = Math.max(lightest, luminance);
      }
      const bottom = context.getImageData(0, Math.max(0, canvas.height - 10), canvas.width, Math.min(10, canvas.height)).data;
      const colorProbe = document.createElement('canvas');
      colorProbe.width = 1;
      colorProbe.height = 1;
      const probeContext = colorProbe.getContext('2d', { willReadFrequently: true });
      if (!probeContext) throw new Error('Attribution color probe unavailable');
      probeContext.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--studio-surface').trim();
      probeContext.fillRect(0, 0, 1, 1);
      const surface = probeContext.getImageData(0, 0, 1, 1).data;
      let surfacePixels = 0;
      let textPixels = 0;
      for (let index = 0; index < bottom.length; index += 4) {
        const isMatchesSurface = bottom[index] === surface[0]
          && bottom[index + 1] === surface[1]
          && bottom[index + 2] === surface[2]
          && bottom[index + 3] === surface[3];
        if (isMatchesSurface) surfacePixels += 1;
        else if (bottom[index + 3] > 0) textPixels += 1;
      }
      return {
        opaqueRatio: opaque / (canvas.width * canvas.height),
        luminanceRange: lightest - darkest,
        attributionSurfaceRatio: surfacePixels / (bottom.length / 4),
        attributionTextPixels: textPixels,
      };
    }, png.toString('base64'));
    expect(pixelEvidence.opaqueRatio).toBeGreaterThan(0.95);
    expect(pixelEvidence.luminanceRange).toBeGreaterThan(20);
    expect(pixelEvidence.attributionSurfaceRatio).toBeGreaterThan(0.6);
    expect(pixelEvidence.attributionTextPixels).toBeGreaterThan(5);
    await expect(dialog.getByRole('status')).toContainText(/Download started for .* × .* PNG/);

    await dialog.getByRole('button', { name: 'Close export' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Export' })).toBeFocused();
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  const widthField = page.getByRole('textbox', { name: 'Page width' });
  await widthField.fill('100');
  await widthField.press('Tab');
  const heightField = page.getByRole('textbox', { name: 'Page height' });
  await heightField.fill('300');
  await heightField.press('Tab');
  await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
  const customFrame = await page.locator('.print-frame').boundingBox();
  expect(customFrame).not.toBeNull();
  expect(Math.abs(customFrame!.width / customFrame!.height - 1 / 3)).toBeLessThan(0.01);
  await page.getByRole('button', { name: 'Export' }).click();
  const customDialog = page.getByRole('dialog', { name: 'Export map' });
  const customDownloadPromise = page.waitForEvent('download');
  await customDialog.getByRole('button', { name: 'Download PNG' }).click();
  const customDownload = await customDownloadPromise;
  const customPath = testInfo.outputPath('vienna-field-guide-custom-100x300.png');
  await customDownload.saveAs(customPath);
  const customPng = await readFile(customPath);
  expect(Math.abs(customPng.readUInt32BE(16) / customPng.readUInt32BE(20) - 1 / 3)).toBeLessThan(0.01);
});
