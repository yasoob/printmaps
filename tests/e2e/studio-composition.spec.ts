import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`layout controls retain typography at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/tests/e2e/fixtures/studioComposition.html');
    await expect(page.getByRole('region', { name: 'Layout settings' })).toBeVisible();
    await page.getByRole('button', { name: 'Change layout', exact: true }).click();
    await page.getByRole('button', { name: /City edition/ }).click();
    await expect(page.getByTestId('poster-frame').locator('text').first()).toHaveText('Vienna field guide');
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Title text', exact: true }).fill('Our favorite city');
    await expect(page.getByTestId('poster-frame').locator('text').first()).toHaveText('Our favorite city');
    await page.getByRole('button', { name: 'Change layout', exact: true }).click();
    await page.getByRole('button', { name: /^Quiet lines/ }).click();
    await expect(page.getByRole('textbox', { name: 'Title text', exact: true })).toHaveValue('Our favorite city');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
}

test('SVG and canvas use the same physical composition, including the real QR artwork', async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/studioComposition.html');
  await expect(page.getByRole('region', { name: 'Layout settings' })).toBeVisible();
  const result = await page.evaluate(() => window.studioAcceptance.compareRenderers());
  expect(result.difference).toBeLessThan(2);
  expect(result.imageCount).toBe(3);
  expect(result.hasSoftMask).toBe(true);
});

test('tile composition is seam-free and PDF keeps poster typography as vector commands', async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/studioComposition.html');
  await expect(page.getByRole('region', { name: 'Layout settings' })).toBeVisible();
  const result = await page.evaluate(() => window.studioAcceptance.comparePngTiles());
  expect(result.attribution).toBe(true);
  expect(result.error).toBeLessThan(0.1);
  expect(result.pdf).toContain('(Tile-safe poster) Tj');
  expect(result.pdf).toContain('/Name (Poster composition)');
});
