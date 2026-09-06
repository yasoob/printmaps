import { expect, test, type Locator } from '@playwright/test';
import { expandToolSettings } from './authoring-panel-support';

async function elementWidth(locator: Locator) {
  const box = await locator.boundingBox();
  return box?.width;
}

test('phone Project menu shows the full name and opens a focused, cancellable rename dialog', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('./');
  const project = page.getByRole('button', { name: 'Project', exact: true });
  await project.click();
  await expect(page.locator('.project-menu-identity')).toContainText('Vienna field guide');
  await page.getByRole('menuitem', { name: 'Rename project' }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename project' });
  const input = dialog.getByRole('textbox', { name: 'Project name' });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Vienna field guide');
  await expect(input).toHaveAttribute('maxlength', '120');
  await input.fill('Discard this name');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(project).toBeFocused();
  await project.click();
  await expect(page.locator('.project-menu-identity')).toContainText('Vienna field guide');

  await page.getByRole('menuitem', { name: 'Rename project' }).click();
  await expect(input).toBeFocused();
  await input.fill('W'.repeat(120));
  await input.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(project).toBeFocused();
  await project.click();
  const identity = page.locator('.project-menu-identity');
  await expect(identity).toContainText('W'.repeat(120));
  expect(await identity.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const menuBox = await page.getByRole('menu', { name: 'Project actions' }).boundingBox();
  expect(menuBox!.x).toBeGreaterThanOrEqual(0);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(320);
  await page.getByRole('menuitem', { name: 'Undo', exact: true }).click();
  await project.click();
  await expect(identity).toContainText('Vienna field guide');
  await page.getByRole('menuitem', { name: 'Rename project' }).click();
  await input.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(project).toBeFocused();
});

test('mobile document history can undo and redo a deleted layer through Project', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const project = page.getByRole('button', { name: 'Project', exact: true });
  await project.click();
  await expect(page.getByRole('menuitem', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Redo', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Open layers' }).click();
  await page.getByRole('button', { name: 'Select Coffee stop' }).click();
  await page.getByRole('button', { name: 'Layer menu' }).click();
  await page.getByRole('menuitem', { name: 'Delete layer' }).click();
  await page.getByRole('button', { name: 'Close properties' }).click();
  await expect(page.locator('[data-layer-select="poi-cafe"]')).toHaveCount(0);

  await project.click();
  const undo = page.getByRole('menuitem', { name: 'Undo', exact: true });
  const undoBox = await undo.boundingBox();
  expect(undoBox!.height).toBeGreaterThanOrEqual(44);
  await undo.click();
  await expect(page.locator('[data-layer-select="poi-cafe"]')).toHaveCount(1);
  await expect(project).toBeFocused();
  await project.click();
  await page.getByRole('menuitem', { name: 'Redo', exact: true }).click();
  await expect(page.locator('[data-layer-select="poi-cafe"]')).toHaveCount(0);

  await page.setViewportSize({ width: 1440, height: 900 });
  await project.click();
  await expect(page.getByRole('menuitem', { name: 'Undo', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
});

test('desktop Layers collapse resizes the live canvas and remains independent of mobile drawers', async ({ page }) => {
  await page.goto('./');
  const map = page.getByTestId('map-canvas');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Select Coffee stop' }).click();
  const originalCenter = await map.getAttribute('data-map-center');
  const originalZoom = await map.getAttribute('data-map-zoom');
  const originalCanvas = await page.locator('.canvas-region').boundingBox();
  const originalSidebar = await page.locator('#layers-panel').boundingBox();
  const originalMapNode = await map.elementHandle();

  await page.getByRole('button', { name: 'Collapse layers' }).click();
  const expand = page.getByRole('button', { name: 'Expand layers' });
  await expect(expand).toBeFocused();
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('list', { name: 'Map layers', includeHidden: true })).toBeHidden();
  await expect.poll(() => elementWidth(page.locator('#layers-panel'))).toBe(44);
  await expect.poll(() => elementWidth(page.locator('.canvas-region')))
    .toBe(originalCanvas!.width + originalSidebar!.width - 44);
  await expect.poll(async () => page.locator('.maplibregl-canvas').evaluate((element) => element.clientWidth))
    .toBe(originalCanvas!.width + originalSidebar!.width - 44);
  expect(await map.evaluate((element, original) => element === original, originalMapNode)).toBe(true);
  await expect(map).toHaveAttribute('data-map-center', originalCenter!);
  await expect(map).toHaveAttribute('data-map-zoom', originalZoom!);
  await expect(map).toHaveAttribute('data-selected-layer', 'poi-cafe');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();

  await page.getByRole('button', { name: 'Project', exact: true }).focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open layers' }).click();
  await expect(page.getByRole('dialog', { name: 'Layers sidebar' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Map layers' })).toBeVisible();
  await page.getByRole('button', { name: 'Close layers' }).click();
  await expect(page.getByRole('button', { name: 'Open layers' })).toBeFocused();

  await page.getByRole('button', { name: 'Project', exact: true }).focus();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(expand).toBeVisible();
  await expand.press('Enter');
  await expect(page.getByRole('list', { name: 'Map layers' })).toBeVisible();
  await expect.poll(() => elementWidth(page.locator('#layers-panel'))).toBe(originalSidebar!.width);
  await expect(map).toHaveAttribute('data-selected-layer', 'poi-cafe');
});

test('initial editor search, live scale, title history, and Project actions work together', async ({ page }, testInfo) => {
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          id: 'place.vienna',
          geometry: { type: 'Point', coordinates: [16.3725, 48.2084] },
          properties: { name: 'Vienna', place_formatted: 'Austria' },
        }],
      }),
    });
  });
  await page.goto('./');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });

  const undo = page.getByRole('button', { name: 'Undo' });
  const redo = page.getByRole('button', { name: 'Redo' });
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await expect(undo).toHaveCSS('cursor', 'default');
  await expect(undo).toHaveCSS('opacity', '0.38');

  await page.getByRole('button', { name: 'Vienna field guide' }).click();
  const title = page.getByRole('textbox', { name: 'Project title' });
  await expect(title).toBeFocused();
  await title.fill('Summer map');
  await title.press('Enter');
  await expect(page.getByRole('button', { name: 'Summer map' })).toBeVisible();
  await expect(undo).toBeEnabled();

  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Vienna field guide' })).toBeVisible();
  await expect(undo).toBeDisabled();
  await expect(redo).toBeEnabled();
  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByRole('button', { name: 'Summer map' })).toBeVisible();

  const search = page.getByRole('combobox', { name: 'Search places and addresses' });
  await search.fill('Vienna');
  await search.press('Enter');
  await page.getByRole('option', { name: 'Vienna, Austria' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-location-request', /16\.3725,48\.2084/);

  const scale = page.getByLabel(/^Map scale:/);
  const initialScale = await scale.getAttribute('aria-label');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(scale).not.toHaveAttribute('aria-label', initialScale!);

  const project = page.getByRole('button', { name: 'Project' });
  await expect(project).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share' })).toHaveCount(0);
  await project.click();
  await expect(page.getByRole('menuitem', { name: 'Open project' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Download project' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Import map data' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: testInfo.outputPath('editor-shell-actions.png') });
});

test('Backspace deletes a selected content layer but never hijacks text editing', async ({ page }) => {
  await page.goto('./');
  const coffee = page.getByRole('button', { name: 'Select Coffee stop' });
  await coffee.click();
  await page.keyboard.press('Backspace');
  await expect(coffee).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Select Coffee stop' })).toBeVisible();

  await page.getByRole('button', { name: 'Vienna field guide' }).click();
  const title = page.getByRole('textbox', { name: 'Project title' });
  await title.fill('Coffee');
  await title.press('Backspace');
  await expect(page.getByRole('button', { name: 'Select Coffee stop' })).toBeVisible();
});

test('route radios and Shape tabs rove with arrow keys without clipping mobile labels', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  await page.getByRole('button', { name: 'Route (R)' }).click();
  await expandToolSettings(page, 'route');
  const straight = page.getByRole('radio', { name: 'Straight' });
  const arc = page.getByRole('radio', { name: 'Arc', exact: true });
  await straight.focus();
  await straight.press('ArrowRight');
  await expect(arc).toBeFocused();
  await expect(arc).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Cancel route' }).click();

  await page.getByRole('button', { name: 'Area (S)' }).click();
  const administrative = page.getByRole('tab', { name: 'Find administrative area' });
  const draw = page.getByRole('tab', { name: 'Draw custom area' });
  await administrative.focus();
  await administrative.press('ArrowRight');
  await expect(draw).toBeFocused();
  await expect(draw).toHaveAttribute('aria-selected', 'true');
  const metrics = await draw.evaluate((element) => {
    const tablist = element.parentElement!;
    const style = getComputedStyle(tablist);
    return {
      height: element.getBoundingClientRect().height,
      overflow: style.overflow,
      scrollHeight: element.scrollHeight,
    };
  });
  expect(metrics.height).toBeGreaterThanOrEqual(40);
  expect(metrics.scrollHeight).toBeLessThanOrEqual(Math.ceil(metrics.height));
  expect(metrics.overflow).not.toBe('hidden');
});
