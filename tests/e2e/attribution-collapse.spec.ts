import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`map credit shows at startup and collapses on interaction at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 30_000 });
    const attribution = page.locator('.maplibregl-ctrl-attrib');
    await expect(attribution).toHaveAttribute('open');
    await expect(attribution).toContainText('OpenStreetMap');
    const canvas = page.locator('.maplibregl-canvas');
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 20, { steps: 6 });
    await page.mouse.up();
    await expect(attribution).not.toHaveAttribute('open');
    await page.locator('.maplibregl-ctrl-attrib-button').click();
    await expect(attribution).toHaveAttribute('open');
    await expect(attribution).toContainText('OpenStreetMap');
  });
}

test('map credit collapses by itself after five seconds', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 30_000 });
  const attribution = page.locator('.maplibregl-ctrl-attrib');
  await expect(attribution).toHaveAttribute('open');
  await expect(attribution).not.toHaveAttribute('open', { timeout: 8000 });
});
