import { expect, test } from '@playwright/test';

const isHeadlessWebGlDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
);

test('desktop editor switches between project and layer properties', async ({ page, browserName }, testInfo) => {
  const consoleProblems: string[] = [];
  let releasePositronStyle!: () => void;
  const positronStyleGate = new Promise<void>((resolve) => { releasePositronStyle = resolve; });
  page.on('pageerror', (error) => {
    consoleProblems.push(error.message);
  });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isHeadlessWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });
  await page.route('**/styles/positron.json', async (route) => {
    await positronStyleGate;
    await route.continue();
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
    await page.getByRole('textbox', { name: 'Bearing' }).fill('35');
    await page.getByRole('textbox', { name: 'Pitch' }).fill('40');
    await page.getByRole('textbox', { name: 'Pitch' }).press('Tab');
    await page.getByRole('textbox', { name: 'Text scale' }).fill('125');
    const style = page.getByRole('combobox', { name: 'Map style' });
    await style.focus();
    await style.selectOption('positron');
    const map = page.getByTestId('map-canvas');
    await expect(map).toHaveAttribute('data-style-preset', 'positron');
    await expect(map).not.toHaveAttribute('data-map-ready', 'true');
    releasePositronStyle();
    await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
    await expect(map).toHaveAttribute('data-map-bearing', '35');
    await expect(map).toHaveAttribute('data-map-pitch', '40');
    await expect(map).toHaveAttribute('data-map-text-scale', '125');
  }

  await page.screenshot({ path: testInfo.outputPath('editor-desktop.png'), fullPage: true });
  expect(consoleProblems).toEqual([]);
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

  await page.getByRole('textbox', { name: 'Bearing' }).fill('35');
  await page.getByRole('textbox', { name: 'Pitch' }).fill('40');
  await page.getByRole('textbox', { name: 'Pitch' }).press('Tab');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-bearing', '35');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-pitch', '40');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('textbox', { name: 'Pitch' })).toHaveValue('0');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('textbox', { name: 'Pitch' })).toHaveValue('40');

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

test('style loading failure shows a recoverable map status', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox fixture intentionally exercises the WebGL fallback path.');
  await page.route('**/styles/liberty.json', (route) => route.abort());

  await page.goto('/');

  const mapStatus = page.getByLabel('Map canvas').getByRole('status');
  await expect(mapStatus).toContainText('Map preview unavailable');
  await expect(mapStatus).toContainText('style');
});

test('switches open map styles and recovers after a selected style fails', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox fixture intentionally exercises the WebGL fallback path.');
  await page.route('**/styles/positron.json', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  const style = page.getByRole('combobox', { name: 'Map style' });

  await style.selectOption('positron');

  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-style-preset', 'positron');
  await expect(page.getByLabel('Map canvas').getByRole('status')).toContainText('map style could not be loaded', { ignoreCase: true });

  await style.selectOption('liberty');

  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-style-preset', 'liberty');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('Map canvas').getByRole('status')).not.toBeVisible();
});
