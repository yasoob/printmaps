import { readFile, stat, writeFile } from 'node:fs/promises';
import { expect, test, type Download, type Locator, type Page } from '@playwright/test';

async function installNativeExportObserver(page: Page) {
  await page.evaluate(() => {
    const browserWindow = window as Window & {
      __nativeExportRegions?: string[];
      __nativeExportStages?: Array<{ stage: string; at: number }>;
    };
    browserWindow.__nativeExportRegions = [];
    browserWindow.__nativeExportStages = [];
    window.addEventListener('printmap:png-export-stage', ((event: CustomEvent<{ stage?: string }>) => {
      if (event.detail.stage) {
        browserWindow.__nativeExportStages?.push({ stage: event.detail.stage, at: performance.now() });
      }
    }) as EventListener);
    const recordNativeRegion = (node: Node) => {
      if (!(node instanceof HTMLElement)) return;
      const region = node.dataset.nativeExportRegion;
      if (region) browserWindow.__nativeExportRegions?.push(region);
    };
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) recordNativeRegion(node);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

const readNativeExportRegions = (page: Page) => page.evaluate(() => (
  (window as Window & { __nativeExportRegions?: string[] }).__nativeExportRegions ?? []
));

const readNativeExportStages = (page: Page) => page.evaluate(() => (
  (window as Window & { __nativeExportStages?: Array<{ stage: string; at: number }> })
    .__nativeExportStages ?? []
));

async function downloadPng(page: Page, dialog: Locator): Promise<Download> {
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PNG' }).click();
  const rejectExportError = async () => {
    const alert = dialog.getByRole('alert');
    await alert.waitFor({ state: 'visible', timeout: 0 });
    throw new Error(await alert.textContent() ?? 'PNG export failed.');
  };
  return Promise.race([
    download,
    rejectExportError(),
  ]);
}

test('export offers one keyboard-accessible format choice with responsive technical disclosure', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleProblems.push(message.text());
  });
  await page.goto('/');
  await expect(page.locator('[data-map-ready="true"]').or(page.getByText('Map preview unavailable'))).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  const png = dialog.getByRole('radio', { name: /PNG/ });
  const svg = dialog.getByRole('radio', { name: /Layered SVG/ });
  const pdf = dialog.getByRole('radio', { name: /PDF/ });
  await expect(png).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByRole('button', { name: 'Download PNG' })).toBeFocused();
  await expect(dialog.locator('.primary-button')).toHaveCount(1);
  await expect(dialog.locator('#export-technical-content')).toBeHidden();
  const idleStatus = dialog.getByRole('status');
  await expect(idleStatus).toHaveText('');
  await expect(idleStatus).toHaveCSS('position', 'absolute');

  const chrome = await dialog.evaluate((element) => {
    const read = (selector: string) => {
      const target = element.querySelector<HTMLElement>(selector);
      if (!target) throw new Error(`Missing export element: ${selector}`);
      const style = getComputedStyle(target);
      return {
        backgroundColor: style.backgroundColor,
        borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
      };
    };
    const formatGroup = read('.export-format-group');
    const formatOptions = [...element.querySelectorAll<HTMLElement>('.export-format-option')].map((option) => {
      const style = getComputedStyle(option);
      return {
        backgroundColor: style.backgroundColor,
        borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
        boxShadow: style.boxShadow,
      };
    });
    return {
      formatGroupBackground: formatGroup.backgroundColor,
      formatOptions,
      headerBorderWidths: read('.export-dialog-header').borderWidths,
      outputBorderWidths: read('.export-output-summary').borderWidths,
      technicalBorderWidths: read('.export-technical-details').borderWidths,
      footerBorderWidths: read('.export-dialog-actions').borderWidths,
      cancelBackground: read('.export-dialog-actions > button:not(.primary-button)').backgroundColor,
      cancelBorderWidths: read('.export-dialog-actions > button:not(.primary-button)').borderWidths,
    };
  });
  expect(chrome.formatGroupBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(chrome.formatOptions).toHaveLength(3);
  expect(chrome.formatOptions.every(({ borderWidths }) => borderWidths.every((width) => width === '0px'))).toBe(true);
  expect(chrome.formatOptions.every(({ boxShadow }) => boxShadow === 'none')).toBe(true);
  expect(chrome.formatOptions[0]?.backgroundColor).not.toBe(chrome.formatOptions[1]?.backgroundColor);
  expect(chrome.headerBorderWidths.every((width) => width === '0px')).toBe(true);
  expect(chrome.outputBorderWidths.every((width) => width === '0px')).toBe(true);
  expect(chrome.technicalBorderWidths.every((width) => width === '0px')).toBe(true);
  expect(chrome.footerBorderWidths.every((width) => width === '0px')).toBe(true);
  expect(chrome.cancelBackground).toBe('rgba(0, 0, 0, 0)');
  expect(chrome.cancelBorderWidths.every((width) => width === '0px')).toBe(true);

  await svg.click();
  await expect(svg).toHaveAttribute('aria-checked', 'true');
  await expect(dialog).toContainText('297 × 210 mm');
  await expect(dialog.getByRole('button', { name: 'Download layered SVG' })).toBeVisible();
  await svg.press('ArrowRight');
  await expect(pdf).toHaveAttribute('aria-checked', 'true');
  await expect(pdf).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Download PDF' })).toBeVisible();

  const details = dialog.getByRole('button', { name: 'Technical details' });
  await details.click();
  await expect(details).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog).toContainText('raster basemap');
  await expect(dialog).toContainText('named vector overlays');
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'docs/screenshots/latest-desktop.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(390);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(844);
  for (const control of [
    dialog.getByRole('radio', { name: /PNG/ }),
    dialog.getByRole('radio', { name: /Layered SVG/ }),
    dialog.getByRole('radio', { name: /PDF/ }),
    details,
    dialog.getByRole('button', { name: 'Close export' }),
    dialog.getByRole('button', { name: 'Cancel' }),
    dialog.getByRole('button', { name: 'Download PDF' }),
  ]) {
    const controlBox = await control.boundingBox();
    expect(controlBox).not.toBeNull();
    expect(controlBox!.height).toBeGreaterThanOrEqual(44);
    expect(controlBox!.width).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.body.scrollWidth - window.innerWidth)).toBe(0);
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'docs/screenshots/latest-mobile.png' });
  expect(consoleProblems).toEqual([]);
});

test('layered SVG download embeds the raster basemap and preserves named vector groups', async ({ page }, testInfo) => {
  await page.goto('/');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so export cannot be exercised.');

  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('radio', { name: /Layered SVG/ }).click();
  await expect(dialog).toContainText('raster basemap');
  await expect(dialog).toContainText('named vector overlays');
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('vienna-field-guide.layered.svg');
  const outputPath = testInfo.outputPath('vienna-field-guide.layered.svg');
  await download.saveAs(outputPath);
  const svgText = await readFile(outputPath, 'utf8');
  const structure = await page.evaluate((text) => {
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml');
    const root = svg.documentElement as unknown as SVGSVGElement;
    return {
      parserError: svg.querySelector('parsererror')?.textContent ?? null,
      width: root.getAttribute('width'),
      height: root.getAttribute('height'),
      viewBox: root.getAttribute('viewBox'),
      basemapMode: root.dataset.basemapContent,
      overlayMode: root.dataset.overlayContent,
      imageHref: root.querySelector(':scope > [data-scene-role="raster-basemap"] image')?.getAttribute('href') ?? '',
      groups: [...root.querySelectorAll(':scope > g')].map((group) => ({
        name: (group as SVGGElement).dataset.layerName,
        role: (group as SVGGElement).dataset.sceneRole,
        vectorElements: group.querySelectorAll('path, circle').length,
      })),
    };
  }, svgText);
  expect(structure.parserError).toBeNull();
  expect(structure).toMatchObject({
    width: '297mm',
    height: '210mm',
    viewBox: '0 0 297 210',
    basemapMode: 'raster',
    overlayMode: 'vector',
  });
  expect(structure.imageHref).toMatch(/^data:image\/png;base64,/);
  expect(structure.groups.map(({ name }) => name)).toEqual([
    'Paper basemap',
    'Route 01',
    'Coffee stop',
    'City center',
    'Attribution',
  ]);
  expect(structure.groups.slice(1, 4).every(({ role, vectorElements }) => (
    role === 'vector-overlay' && vectorElements > 0
  ))).toBe(true);
  await expect(dialog.getByRole('status')).toContainText('Download started for layered SVG');
});

test('PDF download has the exact page box with a raster basemap and named vector overlays', async ({ page }, testInfo) => {
  await page.goto('/');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so export cannot be exercised.');

  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('radio', { name: /PDF/ }).click();
  await expect(dialog).toContainText('exact-page PDF');
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('vienna-field-guide.pdf');
  const outputPath = testInfo.outputPath('vienna-field-guide.pdf');
  await download.saveAs(outputPath);
  const pdf = await readFile(outputPath);
  expect(pdf.subarray(0, 8).toString('latin1')).toBe('%PDF-1.7');
  expect(pdf.length).toBeGreaterThan(1000);
  const pdfText = pdf.toString('latin1');
  expect(pdfText).toContain('/MediaBox [0 0 841.889764 595.275591]');
  expect(pdfText).toContain('/CropBox [0 0 841.889764 595.275591]');
  expect(pdfText).toContain('/Subtype /Image');
  expect(pdfText).toContain('/Filter /DCTDecode');
  expect(pdfText).toContain('/Type /OCG /Name (Route 01)');
  expect(pdfText).toContain('/Type /OCG /Name (Coffee stop)');
  expect(pdfText).toContain('/Type /OCG /Name (City center)');
  expect(pdfText).toContain('% Vector layer: Route 01');
  expect(pdfText).toContain('% Vector layer: Coffee stop');
  expect(pdfText).toContain('% Vector layer: City center');
  await expect(dialog.getByRole('status')).toContainText('Download started for PDF');
});

test('export downloads the current print frame as PNG on desktop and mobile', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.goto('/');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so export cannot be exercised.');

  await installNativeExportObserver(page);

  for (const viewport of [
    { width: 1440, height: 900, label: 'desktop' },
    { width: 390, height: 844, label: 'mobile' },
    { width: 390, height: 520, label: 'short-mobile' },
  ]) {
    await page.setViewportSize(viewport);
    await page.getByRole('button', { name: 'Export' }).click();
    const dialog = page.getByRole('dialog', { name: 'Export map' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('3508 × 2480 px — 300 DPI pixel target');
    await expect(dialog).toContainText('PNG physical-resolution metadata is not embedded');
    await expect(dialog).toContainText('renders each map tile at its target pixel dimensions');
    await expect(dialog).not.toContainText('resamples the current browser render');
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport.height);

    const frameBox = await page.locator('.print-frame').boundingBox();
    expect(frameBox).not.toBeNull();
    if (viewport.label === 'desktop') {
      const download = await downloadPng(page, dialog);
      expect(download.suggestedFilename()).toBe('vienna-field-guide.png');
      const outputPath = testInfo.outputPath('vienna-field-guide-a4-300dpi.png');
      const saveStartedAt = Date.now();
      await download.saveAs(outputPath);
      const downloadSaveMs = Date.now() - saveStartedAt;
      const outputStats = await stat(outputPath);
      expect(outputStats.size).toBeGreaterThan(1000);
      const png = await readFile(outputPath);
      expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      const pngWidth = png.readUInt32BE(16);
      const pngHeight = png.readUInt32BE(20);
      expect(pngWidth).toBe(3508);
      expect(pngHeight).toBe(2480);
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
      const attributionProbeHeight = Math.min(80, canvas.height);
      const bottom = context.getImageData(
        0,
        canvas.height - attributionProbeHeight,
        canvas.width,
        attributionProbeHeight,
      ).data;
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
      const nativeRegions = await readNativeExportRegions(page);
      expect(nativeRegions).toContain('0,0,3508,2480/3508x2480');
      const stages = await readNativeExportStages(page);
      const stageTime = (stage: string) => stages.find((entry) => entry.stage === stage)?.at;
      const renderingAt = stageTime('rendering');
      const composingAt = stageTime('composing');
      const encodingAt = stageTime('encoding');
      const downloadingAt = stageTime('downloading');
      expect([renderingAt, composingAt, encodingAt, downloadingAt].every((value) => Number.isFinite(value))).toBe(true);
      const timings = {
        renderMs: composingAt! - renderingAt!,
        compositionMs: encodingAt! - composingAt!,
        encodingMs: downloadingAt! - encodingAt!,
        downloadSaveMs,
      };
      expect(Object.values(timings).every((value) => value >= 0)).toBe(true);
      await writeFile(testInfo.outputPath('a4-native-png-timings.json'), JSON.stringify(timings, null, 2));
      await expect(dialog.getByRole('status')).toContainText(/Download started for .* × .* PNG/);
    }

    await dialog.getByRole('button', { name: 'Close export' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Export' })).toBeFocused();
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  const widthField = page.getByRole('textbox', { name: 'Page width' });
  await widthField.fill('20');
  await widthField.press('Tab');
  const heightField = page.getByRole('textbox', { name: 'Page height' });
  await heightField.fill('60');
  await heightField.press('Tab');
  await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
  const customFrame = await page.locator('.print-frame').boundingBox();
  expect(customFrame).not.toBeNull();
  expect(Math.abs(customFrame!.width / customFrame!.height - 1 / 3)).toBeLessThan(0.01);
  await page.getByRole('button', { name: 'Export' }).click();
  const customDialog = page.getByRole('dialog', { name: 'Export map' });
  await expect(customDialog).toContainText('236 × 709 px — 300 DPI pixel target');
  await expect(customDialog).toContainText('PNG physical-resolution metadata is not embedded');
  const customDownload = await downloadPng(page, customDialog);
  const customPath = testInfo.outputPath('vienna-field-guide-custom-small.png');
  await customDownload.saveAs(customPath);
  const customPng = await readFile(customPath);
  expect(customPng.readUInt32BE(16)).toBe(236);
  expect(customPng.readUInt32BE(20)).toBe(709);
  expect(Math.abs(customPng.readUInt32BE(16) / customPng.readUInt32BE(20) - 1 / 3)).toBeLessThan(0.01);
  const nativeRegions = await readNativeExportRegions(page);
  expect(nativeRegions).toContain('0,0,236,709/236x709');
});

test('large PNG export renders multiple overlapping native map tiles', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto('/');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so export cannot be exercised.');
  await installNativeExportObserver(page);

  const width = page.getByRole('textbox', { name: 'Page width' });
  await width.fill('600');
  await width.press('Tab');
  const height = page.getByRole('textbox', { name: 'Page height' });
  await height.fill('50');
  await height.press('Tab');
  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await expect(dialog).toContainText('7087 × 591 px — 300 DPI pixel target');

  await dialog.getByRole('button', { name: 'Download PNG' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Turn off Show labels');
  await dialog.getByRole('button', { name: 'Close export' }).click();
  await page.getByRole('checkbox', { name: 'Show labels' }).uncheck();
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(dialog).toContainText('7087 × 591 px — 300 DPI pixel target');

  const download = await downloadPng(page, dialog);
  const outputPath = testInfo.outputPath('vienna-field-guide-native-tiles.png');
  await download.saveAs(outputPath);
  const png = await readFile(outputPath);
  expect(png.readUInt32BE(16)).toBe(7087);
  expect(png.readUInt32BE(20)).toBe(591);

  const allNativeRegions = await readNativeExportRegions(page);
  const nativeRegions = allNativeRegions.filter((region) => region.endsWith('/7087x591'));
  expect(nativeRegions).toHaveLength(2);
  expect(nativeRegions[0]).toMatch(/^0,0,4080,591\//);
  expect(nativeRegions[1]).toMatch(/^4048,0,3039,591\//);
});
