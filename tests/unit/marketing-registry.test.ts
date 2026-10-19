import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { media } from '../../src/marketing/media';
import {
  fullTitle,
  GROUPS,
  HOME_PAGE,
  marketingPages,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  navigationGroups,
  ogImageFor,
  relatedPages,
} from '../../src/marketing/registry';

const byText = (a: string, b: string) => a.localeCompare(b);

function duplicates(values: readonly string[]): string[] {
  const lower = values.map((value) => value.toLowerCase());
  return lower.filter((value, index) => lower.indexOf(value) !== index);
}

const root = path.resolve(import.meta.dirname, '../..');
const pages = [
  { slug: HOME_PAGE.slug, title: HOME_PAGE.title, description: HOME_PAGE.description, rendered: HOME_PAGE.title },
  ...marketingPages.map((entry) => ({ ...entry, rendered: fullTitle(entry.title) })),
];

describe('marketing page registry', () => {
  it('loads every metadata file in src/marketing/pages', () => {
    const files = readdirSync(path.join(root, 'src/marketing/pages'))
      .filter((file) => file.endsWith('.ts') && file !== 'types.ts')
      .map((file) => file.replace(/\.ts$/, ''));
    files.sort(byText);
    const slugs = marketingPages.map((entry) => entry.slug);
    slugs.sort(byText);
    expect(slugs).toEqual(files);
  });

  it('has an Astro route for every entry', () => {
    for (const entry of marketingPages) {
      const route = path.join(root, 'src/pages', `${entry.slug}.astro`);
      const nestedRoute = path.join(root, 'src/pages', entry.slug, 'index.astro');
      expect(existsSync(route) || existsSync(nestedRoute), `missing route for ${entry.slug}`).toBe(true);
    }
  });

  it.each(pages.map((entry) => [entry.slug || '(home)', entry] as const))('%s has a title and description within limits', (_slug, entry) => {
    expect(entry.rendered.length, `title "${entry.rendered}"`).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    expect(entry.rendered.length, `title "${entry.rendered}"`).toBeGreaterThanOrEqual(15);
    expect(entry.description.length, `description "${entry.description}"`).toBeGreaterThanOrEqual(MIN_DESCRIPTION_LENGTH);
    expect(entry.description.length, `description "${entry.description}"`).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
    expect(entry.description).not.toMatch(/\s{2}|^\s|\s$/);
  });

  it('uses unique titles, descriptions, nav labels and primary keywords', () => {
    const titles = pages.map((entry) => entry.rendered);
    const descriptions = pages.map((entry) => entry.description);
    const navLabels = marketingPages.map((entry) => entry.navLabel);
    const keywords = marketingPages.map((entry) => entry.primaryKeyword);
    expect(duplicates(titles)).toEqual([]);
    expect(duplicates(descriptions)).toEqual([]);
    expect(duplicates(navLabels)).toEqual([]);
    expect(duplicates(keywords)).toEqual([]);
  });

  it('uses valid dates, groups, media keys and related slugs', () => {
    const slugs = new Set(marketingPages.map((entry) => entry.slug));
    for (const entry of marketingPages) {
      expect(entry.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(GROUPS.map((group) => group.id)).toContain(entry.group);
      const dates = entry.published ? [entry.updated, entry.published] : [entry.updated];
      for (const date of dates) {
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number.isNaN(Date.parse(date))).toBe(false);
      }
      if (entry.ogImage) expect(Object.keys(media)).toContain(entry.ogImage);
      const related = entry.related ?? [];
      for (const slug of related) expect(slugs.has(slug), `${entry.slug} relates to unknown ${slug}`).toBe(true);
      expect(entry.summaryForLlms.length).toBeGreaterThan(30);
    }
  });

  it('resolves social images that exist in public/ at 1200x630', () => {
    const entries = [{ slug: '', ogImage: undefined }, ...marketingPages];
    for (const entry of entries) {
      const image = ogImageFor(entry.slug, entry.ogImage);
      expect(existsSync(path.join(root, 'public', image.src)), `${image.src} for ${entry.slug || 'home'}`).toBe(true);
      expect([image.width, image.height]).toEqual([1200, 630]);
    }
  });

  it('gives every page its own short card blurb', () => {
    for (const entry of marketingPages) {
      expect(entry.cardBlurb, `${entry.slug} cardBlurb`).toBeTruthy();
      expect(entry.cardBlurb!.length, `${entry.slug} cardBlurb length`).toBeLessThanOrEqual(90);
    }
    expect(duplicates(marketingPages.map((entry) => entry.cardBlurb!))).toEqual([]);
  });

  it('computes related pages without self links or duplicates', () => {
    for (const entry of marketingPages) {
      const related = relatedPages(entry);
      expect(related.map((item) => item.slug)).not.toContain(entry.slug);
      expect(new Set(related).size).toBe(related.length);
    }
  });

  it('keeps project pages out of the header menus', () => {
    const menuSlugs = [...navigationGroups('features'), ...navigationGroups('guides')].flatMap((group) => group.pages.map((entry) => entry.slug));
    expect(menuSlugs).not.toContain('about');
    expect(menuSlugs).not.toContain('privacy');
  });
});
