import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

async function checkHelp(page: Page, dialog: Locator, name: string, { isMobile, info }: { isMobile: boolean; info: TestInfo }) {
  const help = dialog.getByRole('button', { name, exact: true });
  const tooltip = dialog.locator('[role="tooltip"][data-open]');
  await expect(tooltip).toHaveCount(0);
  if (isMobile) {
    await expect.poll(async () => {
      const box = await help.boundingBox();
      return box ? Math.round(Math.min(box.width, box.height) * 1000) / 1000 : 0;
    }).toBeGreaterThanOrEqual(44);
    await help.tap();
  } else {
    await help.hover();
    await expect(tooltip).toBeVisible();
    await tooltip.hover();
    await expect(tooltip).toBeVisible();
    await dialog.hover({ position: { x: 12, y: 12 } });
    await expect(tooltip).toHaveCount(0);
    await help.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(help).toBeFocused();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await help.click();
    await dialog.hover({ position: { x: 12, y: 12 } });
  }
  await expect(tooltip).toBeVisible();
  await expect(help).toHaveAttribute('aria-expanded', 'true');
  const id = await tooltip.getAttribute('id');
  const descriptionIds = await help.getAttribute('aria-describedby');
  expect(descriptionIds?.split(' ')).toContain(id);
  await expect.poll(async () => {
    const [popup, parent] = await Promise.all([tooltip.boundingBox(), dialog.boundingBox()]);
    if (!popup || !parent) return false;
    return popup.x >= parent.x && popup.y >= parent.y
      && popup.x + popup.width <= parent.x + parent.width + 1
      && popup.y + popup.height <= parent.y + parent.height + 1;
  }).toBe(true);
  expect(await tooltip.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return [[box.left + 2, box.top + 2], [box.right - 2, box.bottom - 2]].every(([x, y]) => element.contains(document.elementFromPoint(x, y)));
  })).toBe(true);
  await page.screenshot({ path: info.outputPath(`${name.replaceAll(' ', '-').toLowerCase()}.png`) });
  await page.keyboard.press('Escape');
  await expect(tooltip).toHaveCount(0);
  await expect(dialog).toBeVisible();
  if (isMobile) await help.tap();
  else await help.click();
  await expect(tooltip).toBeVisible();
  if (isMobile) await help.tap();
  else await help.click();
  await expect(tooltip).toHaveCount(0);
  if (isMobile) await help.tap();
  else await help.click();
  await dialog.click({ position: { x: 12, y: 12 } });
  await expect(tooltip).toHaveCount(0);
  await expect(dialog).toBeVisible();
}

for (const isMobile of [false, true]) {
  test.describe(isMobile ? 'mobile contextual help' : 'desktop contextual help', () => {
    test.use(isMobile ? { viewport: { width: 390, height: 844 }, hasTouch: true } : { viewport: { width: 1440, height: 900 } });

    test('real dialogs preserve their controls and contain hover, focus and pinned help', async ({ page }, info) => {
      test.setTimeout(90_000);
      const errors: string[] = [];
      page.on('pageerror', (error) => { errors.push(error.message); });
      await page.route('**/styles/*.json', (route) => route.fulfill({ json: {
        version: 8,
        sources: { fixture: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: 'UI test fixture' } },
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#f3eee3' } },
          { id: 'fixture', type: 'circle', source: 'fixture' },
        ],
      } }));
      await page.goto('./');
      await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 30_000 });
      await page.getByRole('button', { name: 'Export', exact: true }).click();
      let dialog = page.getByRole('dialog', { name: 'Export map', exact: true });
      await dialog.getByRole('radio', { name: /Layered SVG/ }).click();
      await dialog.getByRole('combobox', { name: 'Basemap rendering' }).selectOption('vector');
      await expect(dialog.getByRole('combobox', { name: 'Basemap rendering' })).toHaveValue('vector');
      await checkHelp(page, dialog, 'Basemap rendering help', { isMobile, info });
      await expect(dialog.getByRole('button', { name: 'Download layered SVG' })).toBeEnabled();
      await dialog.getByRole('tab', { name: 'Video', exact: true }).click();
      await expect(dialog).toBeVisible();
      if (isMobile) {
        expect(await dialog.evaluate((element) => Number(getComputedStyle(element).zIndex))).toBe(100);
        expect(await page.locator('.right-sidebar').evaluate((element) => Number(getComputedStyle(element).zIndex))).toBe(60);
        expect(await page.locator('.export-dialog-backdrop').evaluate((element) => Number(getComputedStyle(element).zIndex))).toBe(99);
      }
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await dialog.getByLabel('Duration', { exact: true }).selectOption('15');
      await checkHelp(page, dialog, 'Video recording help', { isMobile, info });
      await checkHelp(page, dialog, 'Video aspect help', { isMobile, info });
      await expect(dialog.getByLabel('Duration', { exact: true })).toHaveValue('15');
      if (!isMobile) {
        const [fps, aspect] = await Promise.all([
          dialog.getByLabel('Target frame rate', { exact: true }).boundingBox(),
          dialog.getByLabel('Video aspect', { exact: true }).boundingBox(),
        ]);
        expect(Math.abs(fps!.x - aspect!.x)).toBeLessThan(1);
        expect(aspect!.y).toBeGreaterThan(fps!.y);
      }
      await dialog.getByRole('tab', { name: '3D model', exact: true }).click();
      await checkHelp(page, dialog, 'Terrain STL help', { isMobile, info });
      await dialog.getByRole('checkbox', { name: 'Raise a route ridge' }).click();
      await checkHelp(page, dialog, 'Route ridge help', { isMobile, info });
      await checkHelp(page, dialog, 'Elevation data and credits', { isMobile, info });
      await expect(dialog.getByRole('button', { name: 'Download STL' })).toBeEnabled();
      await dialog.getByRole('tab', { name: 'Print', exact: true }).click();
      await dialog.getByRole('button', { name: 'Preview on wall', exact: true }).click();
      await expect(dialog.locator('.studio-wall-scene img')).toBeVisible({ timeout: 30_000 });
      await checkHelp(page, dialog, 'Wall preview help', { isMobile, info });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await page.getByRole('button', { name: 'Share', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Share this map' });
      await expect(dialog.getByText('Not private. Links cannot be revoked.')).toBeVisible();
      await checkHelp(page, dialog, 'Share snapshot help', { isMobile, info });
      await checkHelp(page, dialog, 'Share privacy help', { isMobile, info });
      await checkHelp(page, dialog, 'Embed preview help', { isMobile, info });
      await dialog.getByLabel('Embed height (pixels)').fill('12');
      await expect(dialog.getByRole('alert')).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}
