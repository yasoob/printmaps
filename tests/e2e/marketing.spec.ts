import { expect, test } from '@playwright/test';

const marketingRoutes = [
  {
    path: '../',
    title: 'Free Printable Map Maker - Print Map Studio',
    heading: 'Beautiful maps. Ready to print.',
    canonical: 'https://printmaps.yasoob.me/',
  },
  {
    path: '../printable-map-maker/',
    title: 'Printable Map Maker | Print Map Studio',
    heading: 'Build a printable map at the exact page size.',
    canonical: 'https://printmaps.yasoob.me/printable-map-maker/',
  },
  {
    path: '../gpx-map-maker/',
    title: 'GPX Map Maker | Print Map Studio',
    heading: 'Turn a GPX file into a print-ready map.',
    canonical: 'https://printmaps.yasoob.me/gpx-map-maker/',
  },
  {
    path: '../layered-map-export/',
    title: 'Layered Map Export | Print Map Studio',
    heading: 'Download the map in the format you need.',
    canonical: 'https://printmaps.yasoob.me/layered-map-export/',
  },
  {
    path: '../about/',
    title: 'About | Print Map Studio',
    heading: 'A map editor built for print.',
    canonical: 'https://printmaps.yasoob.me/about/',
  },
  {
    path: '../privacy/',
    title: 'Privacy | Print Map Studio',
    heading: 'What stays on your device and what leaves it.',
    canonical: 'https://printmaps.yasoob.me/privacy/',
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

test('homepage ships the selected hero without review controls', async ({ page }) => {
  await page.goto('../');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByText('Free · browser-based · no account')).toBeVisible();
  await expect(page.getByRole('link', { name: "Open the editor - it's free" })).toBeVisible();
  await expect(page.getByText('Free to use')).toHaveCount(0);
  await expect(page.getByText('Layered PSD', { exact: true })).toHaveCount(0);
});

test('homepage schema identifies the creator and indexable application URL', async ({ page }) => {
  await page.goto('../');
  const structuredData = await page.locator('script[type="application/ld+json"]').textContent();
  expect(structuredData).not.toBeNull();
  const graph = JSON.parse(structuredData!)['@graph'];
  expect(graph.find((entry: { '@type': string }) => entry['@type'] === 'Person')).toMatchObject({
    name: 'Yasoob Khalid',
    url: 'https://yasoob.me',
  });
  expect(graph.find((entry: { '@type': string }) => entry['@type'] === 'SoftwareApplication')).toMatchObject({
    operatingSystem: 'Web',
    url: 'https://printmaps.yasoob.me',
  });
});

test('explore pages use contextual product screenshots', async ({ page }) => {
  const pages = [
    {
      path: '../printable-map-maker/',
      hero: /design-desktop\.webp$/,
      details: [
        /printable-page-frame\.webp$/,
        /custom-colors\.webp$/,
        /map-features\.webp$/,
        /labels-and-text\.webp$/,
      ],
    },
    {
      path: '../gpx-map-maker/',
      hero: /content-desktop\.webp$/,
      details: [
        /imported-layers-overview\.webp$/,
        /route-appearance\.webp$/,
        /route-advanced\.webp$/,
        /waypoint-style\.webp$/,
        /gpx-print-frame\.webp$/,
      ],
    },
    {
      path: '../layered-map-export/',
      hero: /psd-workflow-editor\.webp$/,
      details: [
        /export-flat-map\.webp$/,
        /export-pdf-summary\.webp$/,
        /export-project-download\.webp$/,
      ],
    },
  ] as const;

  for (const item of pages) {
    await page.goto(item.path);
    const hero = page.locator('main picture img').first();
    await expect(hero).toBeVisible();
    await expect(hero).toHaveAttribute('src', item.hero);
    await expect(hero).toHaveAttribute('fetchpriority', 'high');
    await expect(page.locator('main figure')).toHaveCount(item.details.length);
    const formatRow = page.getByRole('list', { name: 'Available export formats' });
    await expect(formatRow).toHaveCount(1);
    await expect(formatRow.locator('img')).toHaveCount(4);
    for (const format of ['PNG', 'PDF', 'SVG', 'PSD']) {
      await expect(formatRow.getByAltText(`${format} file format`)).toBeVisible();
    }
    for (const [index, expectedSource] of item.details.entries()) {
      const detail = page.locator('main figure img').nth(index);
      await expect(detail).toHaveAttribute('src', expectedSource);
      await expect(detail).toHaveAttribute('loading', 'lazy');
      await expect(detail).toHaveAttribute('alt', /Print Map Studio/i);
    }
  }
});

test('layered export shows the Photoshop handoff', async ({ page }) => {
  await page.goto('../layered-map-export/');
  const handoff = page.getByRole('group', { name: 'Layered PSD handoff from Print Map Studio to Photoshop' });
  await expect(handoff.locator('img')).toHaveCount(2);
  await expect(handoff.getByAltText(/Print Map Studio editor/)).toBeVisible();
  await expect(handoff.getByAltText(/exported map open in Adobe Photoshop/)).toBeVisible();
  await expect(handoff).toContainText('open the layered PSD in Photoshop');
  await expect(page.getByRole('tablist', { name: 'Photoshop visual concepts' })).toHaveCount(0);
});

test('feature highlights use two mobile columns and four desktop columns', async ({ page }) => {
  const pages = [
    {
      path: '../printable-map-maker/',
      labels: [
        'Set the page size before you design features',
        'Pick a style and control the labels features',
        'Add routes, places, and boundaries features',
      ],
    },
    {
      path: '../gpx-map-maker/',
      labels: [
        'Import a recorded track features',
        'Style the route and its context features',
        'Set the print area and page size features',
      ],
    },
    {
      path: '../layered-map-export/',
      labels: [
        'PNG for a finished image features',
        'PDF for exact-size printing features',
        'Layered SVG for flexible editing features',
        'Layered PSD for Photoshop features',
        'Export without uploading your project features',
      ],
    },
  ];

  for (const item of pages) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(item.path);
    for (const label of item.labels) {
      const highlights = page.getByRole('list', { name: label });
      await expect(highlights.getByRole('listitem')).toHaveCount(4);
      expect(await highlights.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(4);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    for (const label of item.labels) {
      const highlights = page.getByRole('list', { name: label });
      expect(await highlights.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(2);
    }
  }
});

test('mobile homepage CTA leads to the relocated editor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('../');
  await expect(page.locator('header').getByRole('link', { name: 'Open Editor', exact: true })).toBeVisible();
  await expect(page.locator('#main-content > section')).toHaveCount(5);
  const capabilities = page.getByRole('region', { name: 'Add what matters.' });
  await expect(capabilities.getByRole('heading', { name: 'Add what matters.' })).toBeVisible();
  await expect(capabilities.getByRole('link', { name: 'Isochrones' })).toBeVisible();
  const features = page.getByRole('region', { name: 'Design, add content, and export' });
  await expect(features).toBeVisible();
  const exportTab = features.getByRole('tab', { name: /Export for print/ });
  await exportTab.click();
  await expect(exportTab).toHaveAttribute('aria-selected', 'true');
  await expect(features.getByRole('tabpanel', { name: /Export for print/ })).toBeVisible();
  await expect(features.locator('[data-feature-tour]')).toHaveAttribute('data-autoplay-paused', 'true');
  await expect(page.getByRole('region', { name: 'Maps for print, publishing, and planning.' })).toBeVisible();
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
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');
  await expect(page.getByRole('link', { name: 'Print Map Studio home' })).toHaveAttribute('href', '/');
});
