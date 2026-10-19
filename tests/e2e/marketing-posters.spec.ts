import { expect, test } from '@playwright/test';

const posterPages = [
  {
    slug: 'city-map-poster',
    title: 'City Map Poster Maker for Any Town | Print Map Studio',
    heading: 'A city map poster you can read from across the room.',
    sectionHeading: 'How much city fits on an A3 sheet',
  },
  {
    slug: 'country-map-poster',
    title: 'Country Map Poster Shaped Like the Land | Print Map Studio',
    heading: 'A country map poster cut to the shape of the country.',
    sectionHeading: 'How the shaped frame works',
  },
  {
    slug: 'wedding-map-poster',
    title: 'Wedding Map Poster for Where You Met | Print Map Studio',
    heading: 'A wedding map poster of where it all happened.',
    sectionHeading: 'Two places, one map',
  },
  {
    slug: 'travel-map-with-photos',
    title: 'Travel Map with Photos Pinned to Places | Print Map Studio',
    heading: 'A travel map with your photos pinned where you took them.',
    sectionHeading: 'Pin each photo to the place you took it',
  },
  {
    slug: 'map-poster-templates',
    title: 'Map Poster Templates and Layout Presets | Print Map Studio',
    heading: 'Map poster templates that set the type, paper and colours for you.',
    sectionHeading: 'The five layouts and what each is for',
  },
] as const;

const bannedPhrases = [
  /\bunlock\b/i, /\belevate\b/i, /\bseamless/i, /\beffortless/i, /\bempower/i, /game-changer/i, /\bdelve/i,
  /look no further/i, /\bthe perfect\b/i, /\bstunning\b/i, /\bbreathtaking\b/i, /\bjourney\b/i, /\btapestry\b/i,
  /\bcurated\b/i, /\brobust\b/i, /cutting-edge/i, /next-level/i, /!/,
];

for (const posterPage of posterPages) {
  test.describe(posterPage.slug, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`../${posterPage.slug}/`);
    });

    test('has unique page metadata', async ({ page }) => {
      await expect(page).toHaveTitle(posterPage.title);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://printmaps.yasoob.me/${posterPage.slug}/`);
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description?.length ?? 0).toBeGreaterThanOrEqual(140);
      expect(description?.length ?? 0).toBeLessThanOrEqual(160);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(posterPage.heading);
    });

    test('teaches with its own sections and links onward', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 2, name: posterPage.sectionHeading })).toBeVisible();
      await expect(page.locator('main a[href="/editor/"]').first()).toBeVisible();
      const otherPosterLinks = posterPages
        .filter(({ slug }) => slug !== posterPage.slug)
        .map(({ slug }) => `main a[href="/${slug}/"]`)
        .join(', ');
      expect(await page.locator(otherPosterLinks).count()).toBeGreaterThan(0);
    });

    test('loads every image with alt text', async ({ page }) => {
      const images = page.locator('main img');
      expect(await images.count()).toBeGreaterThan(0);
      const allImages = await images.all();
      for (const image of allImages) {
        await image.scrollIntoViewIfNeeded();
        expect(await image.getAttribute('alt')).toBeTruthy();
        await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
      }
    });

    test('keeps copy free of banned phrases', async ({ page }) => {
      const text = await page.locator('main').textContent() ?? '';
      for (const phrase of bannedPhrases) expect(text, `matched ${phrase}`).not.toMatch(phrase);
    });

    test('fits a phone screen without sideways scrolling', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`../${posterPage.slug}/`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
  });
}
