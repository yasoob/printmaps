import { homeUpdated, pageUpdated } from './contentDates';
import { marketingPages, pageUrl } from './registry';
import { SITE_URL } from './product';

type SitemapEntry = Readonly<{ loc: string; lastmod: string }>;

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
Every indexable URL on the site, from the page registry, dated by its last content commit.
The editor shares the newest date.
*/
function newestDate(dates: readonly string[]): string {
  let newest = '';
  for (const date of dates) {
    if (date > newest) newest = date;
  }
  return newest;
}

export function sitemapEntries(): SitemapEntry[] {
  const pages = marketingPages.map((entry) => ({ loc: pageUrl(entry), lastmod: pageUpdated(entry) }));
  const home = homeUpdated();
  const newest = newestDate([home, ...pages.map((entry) => entry.lastmod)]);
  const entries = [
    { loc: `${SITE_URL}/`, lastmod: home },
    { loc: `${SITE_URL}/editor/`, lastmod: newest },
    ...pages,
  ];
  entries.sort((first, second) => first.loc.localeCompare(second.loc));
  return entries;
}

/**
A single, plain sitemap (no index, no extension namespaces) so search consoles read it without surprises.
*/
export function sitemapXml(): string {
  const urls = sitemapEntries()
    .map(({ loc, lastmod }) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
Kept for consoles that already have the old index submitted; it now points at the single sitemap.
*/
export function sitemapIndexXml(): string {
  const lastmod = newestDate(sitemapEntries().map((entry) => entry.lastmod));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap>\n    <loc>${SITE_URL}/sitemap.xml</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>\n</sitemapindex>\n`;
}
