import { expect, test, type Page } from '@playwright/test';

const SITE = 'https://printmaps.yasoob.me';

type PageReport = {
  path: string;
  title: string;
  description: string;
};

async function registryPaths(page: Page): Promise<string[]> {
  const response = await page.request.get('/llms.txt');
  expect(response.status()).toBe(200);
  const text = await response.text();
  const urls = [...text.matchAll(/\]\((https:\/\/printmaps\.yasoob\.me\/[^)]*)\)/g)].map((match) => match[1]!);
  const paths = urls.map((url) => new URL(url).pathname).filter((path) => path !== '/editor/' && !path.endsWith('.txt'));
  return [...new Set(paths)];
}

test('llms.txt lists every page linked from the footer', async ({ page }) => {
  const paths = await registryPaths(page);
  expect(paths).toContain('/');
  expect(paths.length).toBeGreaterThanOrEqual(6);
  await page.goto('/');
  const footerPaths = await page.locator('footer nav a[href^="/"]').evaluateAll((links) => links
    .map((link) => link.getAttribute('href')!)
    .filter((href) => href !== '/editor/'));
  for (const path of footerPaths) expect(paths).toContain(path);

  const full = await page.request.get('/llms-full.txt');
  expect(full.status()).toBe(200);
  expect(await full.text()).toContain('## Product facts');
});

async function checkMetadata(page: Page, path: string): Promise<PageReport> {
  await expect(page.locator('h1'), `${path} has one h1`).toHaveCount(1);
  const title = await page.title();
  expect(title.length, `${path} title "${title}"`).toBeLessThanOrEqual(60);
  expect(title.length, `${path} title "${title}"`).toBeGreaterThanOrEqual(15);
  const description = await page.locator('meta[name="description"]').getAttribute('content') ?? '';
  expect(description.length, `${path} description`).toBeGreaterThanOrEqual(140);
  expect(description.length, `${path} description`).toBeLessThanOrEqual(160);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE}${path}`);
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  return { path, title, description };
}

async function checkSocialImage(page: Page, path: string): Promise<void> {
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(ogImage, `${path} og:image`).toMatch(/^https:\/\/printmaps\.yasoob\.me\//);
  const ogResponse = await page.request.get(new URL(ogImage!).pathname);
  expect(ogResponse.status(), `${path} og:image ${ogImage}`).toBe(200);
  expect(ogResponse.headers()['content-type']).toMatch(/^image\//);
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
}

async function checkStructuredData(page: Page, path: string): Promise<void> {
  const structuredData = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(structuredData.length, `${path} JSON-LD`).toBeGreaterThan(0);
  const types = structuredData.flatMap((json) => {
    const parsed = JSON.parse(json) as { '@graph'?: { '@type': string }[]; '@type'?: string };
    return parsed['@graph']?.map((node) => node['@type']) ?? [parsed['@type']];
  });
  if (path !== '/') expect(types, `${path} breadcrumb schema`).toContain('BreadcrumbList');
  expect(types).not.toContain('HowTo');
}

async function checkImages(page: Page, path: string): Promise<void> {
  const images = await page.locator('main img, header img, footer img').evaluateAll((elements) => elements.map((image) => ({
    src: image.getAttribute('src'),
    alt: image.getAttribute('alt'),
    sized: Boolean(image.getAttribute('width') && image.getAttribute('height')),
  })));
  for (const image of images) {
    expect(image.alt, `${path} ${image.src} alt`).not.toBeNull();
    expect(image.sized, `${path} ${image.src} dimensions`).toBe(true);
  }

  // Lazy and hidden-panel images load only on demand; force them so broken sources fail here.
  const broken = await page.locator('img').evaluateAll(async (elements) => {
    const results = await Promise.all((elements as HTMLImageElement[]).map(async (image) => {
      image.loading = 'eager';
      try {
        await image.decode();
      } catch {
        // A failed decode leaves naturalWidth at 0, which is reported below.
      }
      return image.naturalWidth > 0 ? null : image.currentSrc || image.getAttribute('src');
    }));
    return results.filter(Boolean);
  });
  expect(broken, `${path} has images that fail to load`).toEqual([]);
}

async function checkAnchor(page: Page, path: string, href: string): Promise<void> {
  if (href.length > 1) await expect(page.locator(href), `${path} anchor ${href}`).toHaveCount(1);
}

async function checkInternalLink(page: Page, path: string, href: string, statuses: Map<string, number>): Promise<void> {
  const target = href.split('#', 1)[0]!;
  if (!statuses.has(target)) {
    const response = await page.request.get(target);
    statuses.set(target, response.status());
  }
  expect.soft(statuses.get(target), `${path} links to ${href}`).toBeLessThan(400);
  if (target !== '/editor/' && !target.includes('.')) expect(target, `${path} link ${href} uses a trailing slash`).toMatch(/\/$/);
}

async function checkLinks(page: Page, path: string, statuses: Map<string, number>): Promise<void> {
  const hrefs = await page.locator('a[href]').evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
  for (const href of hrefs) {
    if (href.startsWith('#')) await checkAnchor(page, path, href);
    else if (href.startsWith('/')) await checkInternalLink(page, path, href, statuses);
  }
}

function duplicates(values: readonly string[]): string[] {
  const lower = values.map((value) => value.toLowerCase());
  return lower.filter((value, index) => lower.indexOf(value) !== index);
}

test('every registry page passes on-page SEO checks', async ({ page }) => {
  test.setTimeout(180_000);
  const paths = await registryPaths(page);
  const reports: PageReport[] = [];
  const statuses = new Map<string, number>();

  for (const path of paths) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    reports.push(await checkMetadata(page, path));
    await checkSocialImage(page, path);
    await checkStructuredData(page, path);
    await checkImages(page, path);
    await checkLinks(page, path, statuses);
  }

  expect(duplicates(reports.map((report) => report.title))).toEqual([]);
  expect(duplicates(reports.map((report) => report.description))).toEqual([]);
});

test('no registry page scrolls sideways on a 390px phone', async ({ page }) => {
  test.setTimeout(120_000);
  const paths = await registryPaths(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of paths) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} overflows horizontally at 390px`).toBeLessThanOrEqual(0);
  }
});

test('header menus open from the keyboard and close with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/printable-map-maker/');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const summary = nav.locator('summary', { hasText: 'Features' });
  await summary.focus();
  await page.keyboard.press('Enter');
  const menu = nav.locator('details[data-nav-menu]').first();
  await expect(menu).toHaveAttribute('open', '');
  await expect(menu.getByRole('link', { name: 'GPX map maker' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileMenu = page.locator('details[data-nav-menu]', { has: page.locator('summary[aria-label="Menu"]') });
  await mobileMenu.locator('summary').click();
  const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(mobileNav.getByRole('link', { name: 'Printable map maker' })).toHaveAttribute('aria-current', 'page');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('404 page is not indexable and links back into the site', async ({ page }) => {
  await page.goto('/404/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('main').getByRole('link', { name: 'Open the editor' })).toHaveAttribute('href', '/editor/');
});

test('skip link stays hidden until it receives keyboard focus', async ({ page }) => {
  await page.goto('/');
  const skipLink = page.getByRole('link', { name: 'Skip to content' });
  await expect(skipLink).not.toBeFocused();
  const hiddenBox = await skipLink.boundingBox();
  expect(hiddenBox?.width ?? 0).toBeLessThanOrEqual(1);
  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();
  const focusedBox = await skipLink.boundingBox();
  expect(focusedBox?.width ?? 0).toBeGreaterThan(40);
});
