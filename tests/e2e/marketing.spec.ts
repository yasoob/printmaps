import { expect, test } from '@playwright/test';

const marketingRoutes = [
  {
    path: '../',
    title: 'Print Map Studio',
    heading: 'Beautiful maps. Ready to print.',
    canonical: 'https://printmaps.yasoob.me/',
  },
] as const;

test('marketing routes render crawlable content and metadata without editor code', async ({ page }) => {
  const editorRequests: string[] = [];
  page.on('request', (request) => {
    if (/maplibre|mountApp|\/src\/app\/|\/src\/main\.(?:ts|tsx)/i.test(request.url())) {
      editorRequests.push(request.url());
    }
  });

  for (const route of marketingRoutes) {
    await page.goto(route.path);
    await expect(page).toHaveTitle(route.title);
    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /map/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', route.canonical);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  expect(editorRequests).toEqual([]);
});

test('FAQ structured data matches the visible questions', async ({ page }) => {
  await page.goto('../#faq');
  const faq = page.getByRole('region', { name: 'Frequently asked questions.' });
  const visibleQuestions = await faq.locator('summary h3').allTextContents();
  const structuredData = await page.locator('script[type="application/ld+json"]').textContent();
  expect(structuredData).not.toBeNull();
  const parsed = JSON.parse(structuredData!);
  const faqPage = parsed['@graph'].find((entry: { '@type': string }) => entry['@type'] === 'FAQPage');
  expect(faqPage.mainEntity.map((entry: { name: string }) => entry.name)).toEqual(visibleQuestions);
  await expect(faq.locator('details')).toHaveCount(20);
});

test('mobile homepage CTA leads to the relocated editor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('../');
  await expect(page.locator('header').getByRole('link', { name: 'Open Editor', exact: true })).toBeVisible();
  await expect(page.locator('#main-content > section')).toHaveCount(5);
  const capabilities = page.getByRole('region', { name: 'Add what matters.' });
  await expect(capabilities.getByRole('heading', { name: 'Add what matters.' })).toBeVisible();
  await expect(capabilities.getByRole('link', { name: 'Isochrones' })).toBeVisible();
  const features = page.getByRole('region', { name: 'The complete map workflow' });
  await expect(features).toBeVisible();
  const exportTab = features.getByRole('tab', { name: /Export for print/ });
  await exportTab.click();
  await expect(exportTab).toHaveAttribute('aria-selected', 'true');
  await expect(features.getByRole('tabpanel', { name: /Export for print/ })).toBeVisible();
  await expect(features.locator('[data-feature-tour]')).toHaveAttribute('data-autoplay-paused', 'true');
  await expect(page.getByRole('region', { name: 'Maps for every kind of project.' })).toBeVisible();
  const secondFaq = page.getByRole('region', { name: 'Frequently asked questions.' }).locator('details').nth(1);
  await secondFaq.locator('summary').click();
  await expect(secondFaq).toHaveAttribute('open', '');
  const iconStates = secondFaq.locator('[data-accordion-icon] > span');
  await expect(iconStates.nth(0)).toBeHidden();
  await expect(iconStates.nth(1)).toBeVisible();
  await expect(iconStates.nth(1)).toHaveText('-');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.locator('[data-hero-image-link]').click();
  await expect(page).toHaveURL(/\/editor\/$/);
  await expect(page.locator('.studio-shell')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
  await expect(page.getByRole('link', { name: 'Print Map Studio home' })).toHaveAttribute('href', '/');
});
