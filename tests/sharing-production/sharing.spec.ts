import { expect, test } from '@playwright/test';

test('production shell never loads analytics for shared and invalid links; mobile sharing fits the viewport', async ({ page }) => {
  const analytics: string[] = [];
  await page.route(/google-analytics|googletagmanager/, async (route) => {
    analytics.push(route.request().url());
    await route.fulfill({ contentType: 'text/javascript', body: '' });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const link = await page.getByLabel('Read-only link').inputValue();
  await expect(page.getByRole('dialog', { name: 'Share this map' })).toBeInViewport();
  await expect(page.getByLabel('Embed height (pixels)')).toBeInViewport();
  expect(analytics).toHaveLength(1);

  for (const target of [link, link.replace('#share=', '#embed='), './#share=invalid', './#embed=invalid']) {
    analytics.length = 0;
    await page.goto(target);
    await expect(page.locator('main')).toBeVisible();
    expect(await page.evaluate(() => typeof window.gtag)).toBe('undefined');
    await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
    expect(analytics).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  }
});
