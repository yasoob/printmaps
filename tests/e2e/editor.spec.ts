import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const isHeadlessWebGlDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
);

test('desktop editor switches between project and layer properties', async ({ page, browserName }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => consoleProblems.push(error.message));
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isHeadlessWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });

  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Layers sidebar' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Properties sidebar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Map tools' })).toBeVisible();
  if (browserName !== 'firefox') {
    await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  }

  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await expect(page.getByRole('heading', { name: 'Route 01' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Route 01' })).toHaveAttribute('aria-current', 'true');

  if (browserName !== 'firefox') {
    await page.locator('.maplibregl-canvas').click({ position: { x: 80, y: 80 } });
    await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select Route 01' })).not.toHaveAttribute('aria-current', 'true');
  }

  await page.screenshot({ path: testInfo.outputPath('editor-desktop.png'), fullPage: true });
  expect(consoleProblems).toEqual([]);
});

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
    await (await chooserPromise).setFiles(invalidFile.file);

    await expect(page.getByRole('alert', { name: 'Project file status' })).toContainText(invalidFile.error);
    await expect(page.getByRole('button', { name: 'Vienna field guide' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Open' })).toBeFocused();
  }

  const retryChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open' }).click();
  await (await retryChooser).setFiles(path.resolve('tests/fixtures/alpine-poster.printmap.json'));
  await expect(page.getByRole('button', { name: 'Alpine poster' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Project file status' })).toContainText('Edit history was reset');
  await expect(page.getByRole('button', { name: 'Open' })).toBeFocused();
});

test('map content overlays preview on list hover and select from the canvas', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox fixture intentionally exercises the WebGL fallback path.');
  await page.goto('/');
  const mapRoot = page.getByTestId('map-canvas');
  await expect(mapRoot).toHaveAttribute('data-map-layer-order', 'route-01,poi-cafe,area-center', { timeout: 20_000 });

  await page.getByRole('button', { name: 'Select Coffee stop' }).hover();
  await expect(mapRoot).toHaveAttribute('data-previewed-layer', 'poi-cafe');
  await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
  await page.getByRole('button', { name: 'Select Route 01' }).hover();
  await expect(mapRoot).toHaveAttribute('data-previewed-layer', 'route-01');

  const mapBox = await mapRoot.boundingBox();
  expect(mapBox).not.toBeNull();
  await page.locator('.maplibregl-canvas').click({
    position: { x: mapBox!.width / 2, y: mapBox!.height / 2 },
  });
  await expect(page.getByRole('heading', { name: 'Coffee stop' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Coffee stop' })).toHaveAttribute('aria-current', 'true');

  await page.getByRole('button', { name: 'Hide Route 01' }).click();
  await expect(mapRoot).toHaveAttribute('data-map-layer-order', 'poi-cafe,area-center');
  const cityHandle = page.getByRole('button', { name: 'Reorder City center' });
  await cityHandle.dragTo(page.getByRole('button', { name: 'Reorder Coffee stop' }));
  await expect(mapRoot).toHaveAttribute('data-map-layer-order', 'area-center,poi-cafe');
});

test('desktop commands, orientation, reorder, and overflow menu work in a real browser', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox fixture intentionally exercises the WebGL fallback path.');
  await page.goto('/');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });

  const frame = page.locator('.print-frame');
  const landscapeBounds = await frame.boundingBox();
  expect(landscapeBounds).not.toBeNull();
  expect(landscapeBounds!.width).toBeGreaterThan(landscapeBounds!.height);

  await page.getByRole('button', { name: 'Portrait' }).click();
  await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Page width' })).toHaveValue('210');
  await expect(page.getByRole('textbox', { name: 'Page height' })).toHaveValue('297');
  const portraitBounds = await frame.boundingBox();
  expect(portraitBounds).not.toBeNull();
  expect(portraitBounds!.height).toBeGreaterThan(portraitBounds!.width);

  await expect(page.locator('[data-fit-request="0"]')).toBeVisible();
  await page.getByRole('button', { name: 'Fit page (Shift+1)' }).click();
  await expect(page.locator('[data-fit-request="1"][data-camera-fit-request="1"]')).toBeVisible();

  const routeHandle = page.getByRole('button', { name: 'Reorder Route 01' });
  const coffeeHandle = page.getByRole('button', { name: 'Reorder Coffee stop' });
  await routeHandle.dragTo(coffeeHandle);
  await expect(page.getByRole('list', { name: 'Map layers' }).getByRole('button', { name: /^Select / }).nth(0)).toHaveAccessibleName('Select Coffee stop');
  await page.getByRole('button', { name: 'Reorder Route 01' }).press('Alt+ArrowUp');
  await expect(page.getByRole('list', { name: 'Map layers' }).getByRole('button', { name: /^Select / }).nth(0)).toHaveAccessibleName('Select Route 01');

  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await page.getByRole('button', { name: 'Layer menu' }).click();
  const duplicate = page.getByRole('menuitem', { name: 'Duplicate layer' });
  await expect(duplicate).toBeFocused();
  await duplicate.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Delete layer' })).toBeFocused();
  await page.getByRole('menuitem', { name: 'Delete layer' }).press('ArrowUp');
  await expect(duplicate).toBeFocused();
  await duplicate.click();
  await expect(page.getByRole('button', { name: 'Select Route 01 copy' })).toBeFocused();
});

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
    expect((await stat(outputPath)).size).toBeGreaterThan(1000);
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

test('style loading failure shows a recoverable map status', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox fixture intentionally exercises the WebGL fallback path.');
  await page.route('**/styles/liberty.json', (route) => route.abort());

  await page.goto('/');

  await expect(page.getByRole('status')).toContainText('Map preview unavailable');
  await expect(page.getByRole('status')).toContainText('style');
});

test('mobile shell exposes accessible drawers and non-overlapping attribution states', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByRole('status');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });

  const metrics = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(metrics.body).toBeLessThanOrEqual(metrics.viewport);

  const toolbar = page.getByRole('navigation', { name: 'Map tools' });
  await expect(toolbar).toBeVisible();
  let toolbarBox = await toolbar.boundingBox();
  expect(toolbarBox).not.toBeNull();
  expect(toolbarBox!.x).toBeGreaterThanOrEqual(8);
  expect(toolbarBox!.x + toolbarBox!.width).toBeLessThanOrEqual(382);

  if (await mapReady.isVisible()) {
    const attribution = page.locator('.maplibregl-ctrl-attrib');
    const attributionButton = page.locator('.maplibregl-ctrl-attrib-button');
    await expect(attribution).not.toHaveAttribute('open');
    await expect(attribution).not.toHaveClass(/maplibregl-compact-show/);
    const buttonBox = await attributionButton.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(buttonBox!.width).toBeGreaterThanOrEqual(24);
    expect(buttonBox!.height).toBeGreaterThanOrEqual(24);
    expect(await attributionButton.evaluate((element) => ({
      size: getComputedStyle(element).backgroundSize,
      repeat: getComputedStyle(element).backgroundRepeat,
      position: getComputedStyle(element).backgroundPosition,
    }))).toEqual({ size: '8px 8px', repeat: 'no-repeat', position: '50% 50%' });

    await attributionButton.click();
    await expect(attribution).toHaveAttribute('open');
    await expect(attribution).toHaveClass(/maplibregl-compact-show/);
    let expandedBox = await attribution.boundingBox();
    expect(expandedBox).not.toBeNull();
    expect(expandedBox!.y + expandedBox!.height).toBeLessThanOrEqual(toolbarBox!.y);

    await attributionButton.click();
    await expect(attribution).not.toHaveAttribute('open');
    await expect(attribution).not.toHaveClass(/maplibregl-compact-show/);

    await page.evaluate(() => {
      const root = document.documentElement.style;
      root.setProperty('--studio-safe-top', '20px');
      root.setProperty('--studio-safe-bottom', '24px');
      root.setProperty('--studio-safe-left', '16px');
      root.setProperty('--studio-safe-right', '12px');
    });
    toolbarBox = await toolbar.boundingBox();
    const topbarBox = await page.locator('.topbar').boundingBox();
    const exportBox = await page.getByRole('button', { name: 'Export' }).boundingBox();
    const mobileActionsBox = await page.locator('.mobile-panel-actions').boundingBox();
    expect(topbarBox).not.toBeNull();
    expect(exportBox).not.toBeNull();
    expect(mobileActionsBox).not.toBeNull();
    expect(topbarBox!.height).toBeGreaterThanOrEqual(64);
    expect(exportBox!.y).toBeGreaterThanOrEqual(20);
    expect(exportBox!.x + exportBox!.width).toBeLessThanOrEqual(378);
    expect(mobileActionsBox!.x).toBeGreaterThanOrEqual(24);
    expect(toolbarBox!.x).toBeGreaterThanOrEqual(24);
    expect(toolbarBox!.x + toolbarBox!.width).toBeLessThanOrEqual(370);
    await attributionButton.click();
    expandedBox = await attribution.boundingBox();
    expect(toolbarBox).not.toBeNull();
    expect(expandedBox).not.toBeNull();
    expect(expandedBox!.y + expandedBox!.height).toBeLessThanOrEqual(toolbarBox!.y);
    await attributionButton.click();
    await expect(attribution).not.toHaveAttribute('open');
    await expect(attribution).not.toHaveClass(/maplibregl-compact-show/);
    await page.evaluate(() => {
      const root = document.documentElement.style;
      root.removeProperty('--studio-safe-top');
      root.removeProperty('--studio-safe-bottom');
      root.removeProperty('--studio-safe-left');
      root.removeProperty('--studio-safe-right');
    });

    const mapCanvas = page.locator('.maplibregl-canvas');
    const mapBox = await mapCanvas.boundingBox();
    expect(mapBox).not.toBeNull();
    await attributionButton.click();
    await expect(attribution).toHaveAttribute('open');
    await page.mouse.move(mapBox!.x + mapBox!.width / 2, mapBox!.y + mapBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(mapBox!.x + mapBox!.width / 2 + 32, mapBox!.y + mapBox!.height / 2, { steps: 4 });
    await page.mouse.up();
    await expect(attribution).not.toHaveAttribute('open');
    await expect(attribution).not.toHaveClass(/maplibregl-compact-show/);
    await attributionButton.click();
    await expect(attribution).toHaveAttribute('open');
    await expect(attribution).toHaveClass(/maplibregl-compact-show/);
    await attributionButton.click();
  }

  const layersButton = page.getByRole('button', { name: 'Open layers' });
  const propertiesButton = page.getByRole('button', { name: 'Open properties' });
  await page.evaluate(() => {
    const root = document.documentElement.style;
    root.setProperty('--studio-safe-top', '20px');
    root.setProperty('--studio-safe-bottom', '24px');
    root.setProperty('--studio-safe-left', '16px');
    root.setProperty('--studio-safe-right', '12px');
  });
  await layersButton.click();
  const layersDialog = page.getByRole('dialog', { name: 'Layers sidebar' });
  const collapseLayers = page.getByRole('button', { name: 'Collapse layers' });
  await expect(layersDialog).toBeVisible();
  await expect(layersButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.topbar')).toHaveAttribute('inert');
  await expect(page.locator('.canvas-region')).toHaveAttribute('inert');
  await expect(page.locator('#properties-panel')).toHaveAttribute('inert');
  await expect.poll(async () => (await layersDialog.boundingBox())?.x ?? -999).toBeGreaterThanOrEqual(16);
  const safeDrawerBox = await layersDialog.boundingBox();
  expect(safeDrawerBox).not.toBeNull();
  expect(safeDrawerBox!.y).toBeGreaterThanOrEqual(64);
  expect(safeDrawerBox!.y + safeDrawerBox!.height).toBeLessThanOrEqual(820);
  await page.evaluate(() => {
    const root = document.documentElement.style;
    root.removeProperty('--studio-safe-top');
    root.removeProperty('--studio-safe-bottom');
    root.removeProperty('--studio-safe-left');
    root.removeProperty('--studio-safe-right');
  });
  await expect(collapseLayers).toBeFocused();
  await collapseLayers.press('Shift+Tab');
  await expect(layersDialog.locator('button:not([disabled]), input:not([disabled]), select:not([disabled])').last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(collapseLayers).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(layersDialog).not.toBeVisible();
  await expect(layersButton).toBeFocused();

  await layersButton.click();
  await page.getByRole('button', { name: 'Close open panel' }).click({ position: { x: 385, y: 400 } });
  await expect(layersDialog).not.toBeVisible();
  await expect(layersButton).toBeFocused();

  await layersButton.click();
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await expect(layersDialog).not.toBeVisible();
  await expect(layersButton).toBeFocused();

  await propertiesButton.click();
  const propertiesDialog = page.getByRole('dialog', { name: 'Properties sidebar' });
  const closeProperties = page.getByRole('button', { name: 'Close properties' });
  await expect(propertiesDialog).toBeVisible();
  await expect(propertiesButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.topbar')).toHaveAttribute('inert');
  await expect(page.locator('.canvas-region')).toHaveAttribute('inert');
  await expect(page.locator('#layers-panel')).toHaveAttribute('inert');
  await expect(closeProperties).toBeFocused();
  await page.getByRole('button', { name: 'Layer menu' }).click();
  await page.getByRole('menuitem', { name: 'Duplicate layer' }).click();
  await expect(page.getByRole('heading', { name: 'Route 01 copy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Layer menu' })).toBeFocused();
  await page.getByRole('button', { name: 'Layer menu' }).click();
  await page.getByRole('menuitem', { name: 'Delete layer' }).click();
  const projectHeading = page.getByRole('heading', { name: 'Project' });
  await expect(projectHeading).toBeVisible();
  await expect(projectHeading).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(propertiesDialog).not.toBeVisible();
  await expect(propertiesButton).toBeFocused();

  await page.setViewportSize({ width: 320, height: 844 });
  const narrowMetrics = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(narrowMetrics.body).toBeLessThanOrEqual(narrowMetrics.viewport);
  const narrowToolbarBox = await toolbar.boundingBox();
  expect(narrowToolbarBox).not.toBeNull();
  expect(narrowToolbarBox!.x).toBeGreaterThanOrEqual(8);
  expect(narrowToolbarBox!.x + narrowToolbarBox!.width).toBeLessThanOrEqual(312);

  await layersButton.click();
  await expect(page.getByRole('dialog', { name: 'Layers sidebar' })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopLayers = page.locator('#layers-panel');
  await expect(desktopLayers).toBeVisible();
  await expect(desktopLayers).not.toHaveAttribute('role');
  await expect(desktopLayers).not.toHaveAttribute('aria-modal');
  await expect(desktopLayers).not.toHaveClass(/is-mobile-open/);
  await expect(page.locator('.topbar')).not.toHaveAttribute('inert');
  await expect(page.locator('.canvas-region')).not.toHaveAttribute('inert');
  await expect(page.getByRole('button', { name: 'Vienna field guide' })).toBeFocused();

  if (await mapReady.isVisible()) {
    const attribution = page.locator('.maplibregl-ctrl-attrib');
    const attributionButton = page.locator('.maplibregl-ctrl-attrib-button');
    await expect(attribution).toHaveAttribute('open');
    await expect(attribution).toHaveClass(/maplibregl-compact-show/);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(attribution).not.toHaveAttribute('open');
    await expect(attribution).not.toHaveClass(/maplibregl-compact-show/);
    await attributionButton.click();
    await expect(attribution).toHaveAttribute('open');
    await expect(attribution).toHaveClass(/maplibregl-compact-show/);
    await attributionButton.click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(attribution).toHaveAttribute('open');
    await expect(attribution).toHaveClass(/maplibregl-compact-show/);
  }
});
