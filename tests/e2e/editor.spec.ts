import { expect, test } from '@playwright/test';

const isExpectedWebGlDiagnostic = (message: string, browserName: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
  || (browserName === 'firefox' && message.includes('WebGL context was lost.'))
);

test('desktop editor switches between project and layer properties', async ({ page, browserName }, testInfo) => {
  const consoleProblems: string[] = [];
  let releasePositronStyle!: () => void;
  const positronStyleGate = new Promise<void>((resolve) => { releasePositronStyle = resolve; });
  page.on('pageerror', (error) => {
    consoleProblems.push(error.message);
  });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isExpectedWebGlDiagnostic(message.text(), browserName)) {
      consoleProblems.push(message.text());
    }
  });
  await page.route('**/styles/night-ink.json', async (route) => {
    await positronStyleGate;
    await route.continue();
  });

  await page.goto('./');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Layers sidebar' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Properties sidebar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Map tools' })).toBeVisible();
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await expect(page.getByRole('heading', { name: 'Route 01' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Route 01' })).toHaveAttribute('aria-current', 'true');

  await page.locator('.maplibregl-canvas').click({ position: { x: 80, y: 80 } });
  await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Route 01' })).not.toHaveAttribute('aria-current', 'true');
  await page.getByRole('spinbutton', { name: 'Bearing' }).fill('35');
  await page.getByRole('spinbutton', { name: 'Pitch' }).fill('40');
  await page.getByRole('spinbutton', { name: 'Pitch' }).press('Tab');
  await page.getByRole('spinbutton', { name: 'Text scale' }).fill('125');
  await page.getByRole('checkbox', { name: 'Show roads' }).uncheck();
  const style = page.getByRole('radio', { name: /^Night Ink:/ });
  await style.focus();
  await style.click();
  const map = page.getByTestId('map-canvas');
  await expect(map).toHaveAttribute('data-style-preset', 'night-ink');
  await expect(map).not.toHaveAttribute('data-map-ready', 'true');
  releasePositronStyle();
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await expect(map).toHaveAttribute('data-map-bearing', '35');
  await expect(map).toHaveAttribute('data-map-pitch', '40');
  await expect(map).toHaveAttribute('data-map-text-scale', '125');
  await expect(map).toHaveAttribute('data-map-feature-visibility', 'roads:false,buildings:true,labels:true,water:true,parks:true,landuse:true,transit:true');

  await page.screenshot({ path: testInfo.outputPath('editor-desktop.png'), fullPage: true });
  expect(consoleProblems).toEqual([]);
});

test('map content overlays preview on list hover and select from the canvas', async ({ page }) => {
  await page.goto('./');
  const mapRoot = page.getByTestId('map-canvas');
  await expect(mapRoot).toHaveAttribute('data-map-layer-order', 'route-01,poi-cafe,area-center', { timeout: 20_000 });

  await page.getByRole('button', { name: 'Select Coffee stop' }).hover();
  await expect(mapRoot).toHaveAttribute('data-previewed-layer', 'poi-cafe');
  await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
  await page.getByRole('button', { name: 'Select Route 01' }).hover();
  await expect(mapRoot).toHaveAttribute('data-previewed-layer', 'route-01');
  await page.getByRole('button', { name: 'Select City center' }).hover();
  await expect(mapRoot).toHaveAttribute('data-previewed-layer', 'area-center');
  await expect(mapRoot).toHaveAttribute('data-selected-layer', '');

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

test('desktop commands, orientation, reorder, and overflow menu work in a real browser', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });

  const frame = page.locator('.print-frame');
  const landscapeBounds = await frame.boundingBox();
  expect(landscapeBounds).not.toBeNull();
  expect(landscapeBounds!.width).toBeGreaterThan(landscapeBounds!.height);

  await page.getByRole('button', { name: 'Portrait' }).click();
  await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('spinbutton', { name: 'Page width' })).toHaveValue('210');
  await expect(page.getByRole('spinbutton', { name: 'Page height' })).toHaveValue('297');
  const portraitBounds = await frame.boundingBox();
  expect(portraitBounds).not.toBeNull();
  expect(portraitBounds!.height).toBeGreaterThan(portraitBounds!.width);

  await page.getByRole('spinbutton', { name: 'Bearing' }).fill('35');
  await page.getByRole('spinbutton', { name: 'Pitch' }).fill('40');
  await page.getByRole('spinbutton', { name: 'Pitch' }).press('Tab');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-bearing', '35');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-pitch', '40');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Pitch' })).toHaveValue('0');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Pitch' })).toHaveValue('40');

  await expect(page.locator('[data-fit-request="0"]')).toBeVisible();
  await page.getByRole('button', { name: 'Fit page' }).click();
  await expect(page.locator('[data-fit-request="1"][data-camera-fit-request="1"]')).toBeVisible();

  const routeHandle = page.getByRole('button', { name: 'Reorder Route 01' });
  const coffeeHandle = page.getByRole('button', { name: 'Reorder Coffee stop' });
  await routeHandle.dragTo(coffeeHandle);
  await expect(page.getByRole('list', { name: 'Map layers' }).getByRole('button', { name: /^Select / }).nth(0)).toHaveAccessibleName('Select Coffee stop');
  await page.getByRole('button', { name: 'Reorder Route 01' }).press('Alt+ArrowUp');
  await expect(page.getByRole('list', { name: 'Map layers' }).getByRole('button', { name: /^Select / }).nth(0)).toHaveAccessibleName('Select Route 01');

  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await page.getByRole('button', { name: 'Layer menu' }).click();
  const replace = page.getByRole('menuitem', { name: 'Replace layer data' });
  const duplicate = page.getByRole('menuitem', { name: 'Duplicate layer' });
  await expect(replace).toBeFocused();
  await replace.press('ArrowDown');
  await expect(duplicate).toBeFocused();
  await duplicate.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Delete layer' })).toBeFocused();
  await page.getByRole('menuitem', { name: 'Delete layer' }).press('ArrowUp');
  await expect(duplicate).toBeFocused();
  await duplicate.click();
  await expect(page.getByRole('button', { name: 'Select Route 01 copy' })).toBeFocused();
});

test('browser location centers the map and map-area lock gates movement commands', async ({ context, page, browserName }) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isExpectedWebGlDiagnostic(message.text(), browserName)) {
      consoleProblems.push(message.text());
    }
  });
  await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:4175' });
  await context.setGeolocation({ longitude: 16.3725, latitude: 48.2084 });
  await page.goto('./');
  const map = page.getByTestId('map-canvas');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });

  await page.getByRole('button', { name: 'Use my location' }).click();

  await expect(page.locator('.map-location-status')).toContainText('Map centered on your current location');
  await expect(map).toHaveAttribute('data-map-location-applied', '1');

  const lock = page.getByRole('switch', { name: 'Lock map area' });
  await lock.check();
  await expect(map).toHaveAttribute('data-map-area-locked', 'true');
  await expect(page.getByRole('button', { name: 'Fit page' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Use my location' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeDisabled();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(lock).not.toBeChecked();
  await expect(map).toHaveAttribute('data-map-area-locked', 'false');
  await expect(page.getByRole('button', { name: 'Use my location' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
  expect(consoleProblems).toEqual([]);
});

test('desktop canvas controls stay anchored and clear of every authoring panel', async ({ page }) => {
  for (const viewport of [
    { width: 2000, height: 600 },
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
    const baselineFit = await page.getByRole('button', { name: 'Fit page' }).boundingBox();
    const baselineZoom = await page.locator('.maplibregl-ctrl-group').first().boundingBox();
    expect(baselineFit).not.toBeNull();
    expect(baselineZoom).not.toBeNull();

    for (const authoring of [
      { button: 'Place (P)', panel: '.poi-authoring-panel' },
      { button: 'Route (R)', panel: '.route-authoring-panel' },
      { button: 'Area (S)', panel: '.shape-authoring-panel' },
    ]) {
      await page.getByRole('button', { name: authoring.button }).click();
      const fitBox = await page.getByRole('button', { name: 'Fit page' }).boundingBox();
      const zoomBox = await page.locator('.maplibregl-ctrl-group').first().boundingBox();
      const panelBox = await page.locator(authoring.panel).boundingBox();
      const canvasRegionBox = await page.locator('.canvas-region').boundingBox();
      expect(fitBox).not.toBeNull();
      expect(zoomBox).not.toBeNull();
      expect(panelBox).not.toBeNull();
      expect(canvasRegionBox).not.toBeNull();
      expect(fitBox!.x).toBeCloseTo(baselineFit!.x, 0);
      expect(fitBox!.y).toBeCloseTo(baselineFit!.y, 0);
      expect(zoomBox!.x).toBeCloseTo(baselineZoom!.x, 0);
      expect(zoomBox!.y).toBeCloseTo(baselineZoom!.y, 0);
      expect(panelBox!.x).toBeGreaterThanOrEqual(canvasRegionBox!.x);
      expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(canvasRegionBox!.x + canvasRegionBox!.width);
      expect(panelBox!.x + panelBox!.width / 2).toBeCloseTo(
        canvasRegionBox!.x + canvasRegionBox!.width / 2,
        0,
      );
      expect(
        fitBox!.x + fitBox!.width <= panelBox!.x
        || panelBox!.x + panelBox!.width <= fitBox!.x
        || fitBox!.y + fitBox!.height <= panelBox!.y
        || panelBox!.y + panelBox!.height <= fitBox!.y,
      ).toBe(true);
      expect(
        zoomBox!.x + zoomBox!.width <= panelBox!.x
        || panelBox!.x + panelBox!.width <= zoomBox!.x
        || zoomBox!.y + zoomBox!.height <= panelBox!.y
        || panelBox!.y + panelBox!.height <= zoomBox!.y,
      ).toBe(true);
      await page.getByRole('button', { name: 'Select (V)' }).click();
    }
  }
});

test('map cursor reflects selection, dragging, and authoring intent', async ({ page }) => {
  await page.goto('./');
  const map = page.getByTestId('map-canvas');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const canvas = map.locator('.maplibregl-canvas');

  await expect(canvas).toHaveCSS('cursor', 'default');
  await page.getByRole('button', { name: 'Route (R)' }).click();
  await expect(canvas).toHaveCSS('cursor', 'crosshair');
  await page.getByRole('button', { name: 'Select (V)' }).click();
  await expect(canvas).toHaveCSS('cursor', 'default');

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 80, box!.y + 80);
  await page.mouse.down();
  await page.mouse.move(box!.x + 112, box!.y + 80, { steps: 4 });
  await expect(canvas).toHaveCSS('cursor', 'grabbing');
  await page.mouse.up();
  await expect(canvas).toHaveCSS('cursor', 'default');

  for (const tool of ['Place (P)', 'Area (S)']) {
    await page.getByRole('button', { name: tool }).click();
    await expect(canvas).toHaveCSS('cursor', 'crosshair');
  }
});

test('style loading failure shows a recoverable map status', async ({ page }) => {
  let confirmStyleAbort: (() => void) | undefined;
  const styleAbort = new Promise<void>((resolve) => { confirmStyleAbort = resolve; });
  await page.route('**/styles/paper.json', async (route) => {
    await route.abort();
    confirmStyleAbort?.();
  });

  await page.goto('./');
  await styleAbort;

  const mapStatus = page.getByLabel('Map canvas').getByRole('status');
  await expect(mapStatus).toContainText('Map preview unavailable', { timeout: 20_000 });
  await expect(mapStatus).toContainText('style');
});

test('switches open map styles and recovers after a selected style fails', async ({ page }) => {
  await page.route('**/styles/night-ink.json', (route) => route.abort());
  await page.goto('./');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  const style = page.getByRole('radio', { name: /^Night Ink:/ });

  await style.click();

  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-style-preset', 'night-ink');
  await expect(page.getByLabel('Map canvas').getByRole('status')).toContainText('map style could not be loaded', { ignoreCase: true });

  await page.getByRole('radio', { name: /^Paper:/ }).click();

  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-style-preset', 'paper');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('Map canvas').getByRole('status')).not.toBeVisible();
});

test('applies Coastal, translated labels, and expanded map detail controls', async ({ page, browserName }) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isExpectedWebGlDiagnostic(message.text(), browserName)) {
      consoleProblems.push(message.text());
    }
  });
  await page.goto('./');
  const map = page.getByTestId('map-canvas');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });

  await page.getByRole('radio', { name: /^Coastal:/ }).click();
  await expect(map).toHaveAttribute('data-style-preset', 'coastal');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await page.getByRole('combobox', { name: 'Map language' }).selectOption('de');
  await page.getByRole('checkbox', { name: 'Show water' }).uncheck();
  await page.getByRole('checkbox', { name: 'Show parks' }).uncheck();
  await page.getByRole('checkbox', { name: 'Show land detail' }).uncheck();
  await page.getByRole('checkbox', { name: 'Show transit' }).uncheck();

  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await expect(map).toHaveAttribute('data-map-language', 'de');
  await expect(map).toHaveAttribute('data-map-feature-visibility', 'roads:true,buildings:true,labels:true,water:false,parks:false,landuse:false,transit:false');
  await expect(page.getByRole('button', { name: 'Select Coastal basemap' })).toBeVisible();
  expect(consoleProblems).toEqual([]);
});
