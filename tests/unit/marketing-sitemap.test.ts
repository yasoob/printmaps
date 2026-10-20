import { readFileSync } from 'node:fs';
import { HOME_PAGE, marketingPages } from '../../src/marketing/registry';
import { sitemapEntries, sitemapIndexXml, sitemapXml } from '../../src/marketing/sitemap';

const SITE = 'https://printmaps.yasoob.me';

describe('sitemap', () => {
  it('lists the homepage, the editor and every registered page exactly once', () => {
    const locations = sitemapEntries().map((entry) => entry.loc);
    const expected = [`${SITE}/`, `${SITE}/editor/`, ...marketingPages.map((entry) => `${SITE}/${entry.slug}/`)];
    expect(new Set(locations).size).toBe(locations.length);
    expect(new Set(locations)).toEqual(new Set(expected));
    expect(locations).toHaveLength(expected.length);
    expect(locations.some((loc) => loc.includes('404'))).toBe(false);
  });

  it('uses date-only lastmod values from the registry', () => {
    for (const entry of sitemapEntries()) expect(entry.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sitemapEntries().find((entry) => entry.loc === `${SITE}/`)?.lastmod).toBe(HOME_PAGE.updated);
  });

  it('writes a plain urlset without extension namespaces', () => {
    const xml = sitemapXml();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')).toBe(true);
    expect(xml).not.toMatch(/xmlns:(news|video|image|xhtml)/);
    expect(xml.match(/<url>/g)).toHaveLength(sitemapEntries().length);
  });

  it('keeps the old index pointing at the single sitemap, and robots.txt advertises it', () => {
    expect(sitemapIndexXml()).toContain(`<loc>${SITE}/sitemap.xml</loc>`);
    expect(readFileSync('public/robots.txt', 'utf8')).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });
});
