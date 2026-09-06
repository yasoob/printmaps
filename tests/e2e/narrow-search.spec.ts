import { expect, test } from '@playwright/test';

for (const width of [320, 390]) {
  test(`search remains readable between accessible panel controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route('https://api.mapbox.com/search/geocode/v6/forward**', (route) => (
      route.fulfill({ json: { type: 'FeatureCollection', features: [] } })
    ));
    await page.goto('./');
    const input = page.getByRole('combobox', { name: 'Search places and addresses' });
    const inputBounds = await input.boundingBox();
    expect(inputBounds!.width).toBeGreaterThanOrEqual(100);
    expect(inputBounds!.height).toBeGreaterThanOrEqual(44);
    for (const name of ['Open layers', 'Open properties', 'Search locations']) {
      const button = page.getByRole('button', { name, exact: true });
      const bounds = await button.boundingBox();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    await input.fill('San Francisco');
    await expect(input).toHaveValue('San Francisco');
    expect(await input.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Open layers' }).click();
    await expect(page.getByRole('dialog', { name: 'Layers sidebar' })).toBeVisible();
    await page.getByRole('button', { name: 'Close layers' }).click();
    await page.getByRole('button', { name: 'Open properties' }).click();
    await expect(page.getByRole('dialog', { name: 'Properties sidebar' })).toBeVisible();
    await page.getByRole('button', { name: 'Close properties' }).click();
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
