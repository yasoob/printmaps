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

test('style loading failure shows a recoverable map status', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox fixture intentionally exercises the WebGL fallback path.');
  await page.route('**/styles/liberty.json', (route) => route.abort());

  await page.goto('/');

  await expect(page.getByRole('status')).toContainText('Map preview unavailable');
  await expect(page.getByRole('status')).toContainText('style');
});

test('mobile shell has no body-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const metrics = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(metrics.body).toBeLessThanOrEqual(metrics.viewport);
  await expect(page.getByRole('navigation', { name: 'Map tools' })).toBeVisible();
});
