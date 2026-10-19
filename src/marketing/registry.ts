import { media, type MarketingImage } from './media';
import type {
  MarketingPageEntry,
  MarketingPageGroup,
  MarketingPageKind,
  MarketingPageModule,
} from './pages/types';
import { SITE_NAME, SITE_URL } from './product';

export type { MarketingPageEntry, MarketingPageGroup, MarketingPageKind } from './pages/types';

export const MAX_TITLE_LENGTH = 60;
export const MIN_DESCRIPTION_LENGTH = 140;
export const MAX_DESCRIPTION_LENGTH = 160;

export const GROUPS: readonly { id: MarketingPageGroup; label: string; menu: 'features' | 'guides' | null }[] = [
  { id: 'make', label: 'Map posters', menu: 'features' },
  { id: 'outdoors', label: 'Routes and terrain', menu: 'features' },
  { id: 'export', label: 'Export and share', menu: 'features' },
  { id: 'business', label: 'For work', menu: 'features' },
  { id: 'guide', label: 'Guides', menu: 'guides' },
  { id: 'compare', label: 'Comparisons', menu: 'guides' },
  { id: 'project', label: 'Project', menu: null },
];

/**
The homepage is not a registry entry; it shares the title and description rules.
*/
export const HOME_PAGE = {
  slug: '',
  title: 'Free Map Poster Maker for Printable Maps | Print Map Studio',
  description: 'Make a printable map or map poster in your browser. Pick a place and an exact paper size, add routes and photos, then export PNG, PDF, SVG or PSD. Free.',
  updated: '2026-10-19',
} as const;

const modules = import.meta.glob<MarketingPageModule>(['./pages/*.ts', '!./pages/types.ts'], { eager: true });

function slugFromPath(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.ts$/, '');
}

function loadPages(): MarketingPageEntry[] {
  const entries = Object.entries(modules).map(([path, module]) => {
    const entry = module.page;
    if (!entry) throw new Error(`${path} must export a \`page\` MarketingPageEntry.`);
    if (entry.slug !== slugFromPath(path)) {
      throw new Error(`${path} declares slug "${entry.slug}"; the slug must match the file name.`);
    }
    return entry;
  });
  entries.sort((a, b) => groupIndex(a.group) - groupIndex(b.group) || a.order - b.order || a.slug.localeCompare(b.slug));
  return entries;
}

export const marketingPages: readonly MarketingPageEntry[] = loadPages();

function groupIndex(group: MarketingPageGroup): number {
  return GROUPS.findIndex((candidate) => candidate.id === group);
}

export function getPage(slug: string): MarketingPageEntry | undefined {
  return marketingPages.find((entry) => entry.slug === slug);
}

export function requirePage(slug: string): MarketingPageEntry {
  const entry = getPage(slug);
  if (!entry) throw new Error(`No marketing page registered for "${slug}".`);
  return entry;
}

export function pagePath(entry: Pick<MarketingPageEntry, 'slug'>): string {
  return entry.slug ? `/${entry.slug}/` : '/';
}

export function pageUrl(entry: Pick<MarketingPageEntry, 'slug'>): string {
  return `${SITE_URL}${pagePath(entry)}`;
}

/**
First registered slug wins, so links can point at a page that may not exist yet.
*/
export function firstPagePath(...slugs: readonly string[]): string | undefined {
  for (const slug of slugs) {
    const entry = getPage(slug);
    if (entry) return pagePath(entry);
  }
  return undefined;
}

export function fullTitle(title: string): string {
  const withSuffix = `${title} | ${SITE_NAME}`;
  return withSuffix.length <= MAX_TITLE_LENGTH ? withSuffix : title;
}

export function pageKind(entry: MarketingPageEntry): MarketingPageKind {
  if (entry.kind) return entry.kind;
  if (entry.group === 'guide') return 'guide';
  if (entry.group === 'compare') return 'comparison';
  if (entry.group === 'project') return 'info';
  return 'landing';
}

export function pagesInGroup(group: MarketingPageGroup): readonly MarketingPageEntry[] {
  return marketingPages.filter((entry) => entry.group === group);
}

export type NavigationGroup = {
  id: MarketingPageGroup;
  label: string;
  pages: readonly MarketingPageEntry[];
};

export function navigationGroups(menu?: 'features' | 'guides'): readonly NavigationGroup[] {
  return GROUPS
    .filter((group) => (menu ? group.menu === menu : true))
    .map((group) => ({
      id: group.id,
      label: group.label,
      pages: pagesInGroup(group.id).filter((entry) => !menu || !entry.hideFromNav),
    }))
    .filter((group) => group.pages.length > 0);
}

const OG_FALLBACK: MarketingImage = {
  src: '/social-preview.png',
  width: 1200,
  height: 630,
  alt: 'Print Map Studio artwork with a colourful layered map',
};

const mediaByKey: Readonly<Record<string, MarketingImage | undefined>> = media;

export function ogImageFor(slug: string, explicitKey?: string): MarketingImage {
  return (explicitKey ? mediaByKey[explicitKey] : undefined)
    ?? mediaByKey[`og.${slug || 'index'}`]
    ?? OG_FALLBACK;
}

/**
 * Related pages: explicit `related` slugs first, then pages from the same group, then
 * one page from each other content group, rotated by the page's position so links
 * spread across the site instead of always pointing at the same few pages.
 */
export function relatedPages(entry: MarketingPageEntry, limit = 4): readonly MarketingPageEntry[] {
  const picked: MarketingPageEntry[] = [];
  const add = (candidate: MarketingPageEntry | undefined) => {
    if (!candidate || candidate.slug === entry.slug || picked.includes(candidate) || picked.length >= limit) return;
    picked.push(candidate);
  };

  const explicitRelated = entry.related ?? [];
  for (const slug of explicitRelated) add(getPage(slug));
  if (entry.related) return picked;

  for (const candidate of pagesInGroup(entry.group)) {
    if (picked.length >= Math.min(2, limit)) break;
    add(candidate);
  }

  const contentGroups = GROUPS.filter((group) => group.menu && group.id !== entry.group);
  const offset = Math.max(0, marketingPages.indexOf(entry));
  for (let index = 0; index < contentGroups.length && picked.length < limit; index += 1) {
    const group = contentGroups[(index + offset) % contentGroups.length];
    if (!group) continue;
    const pool = pagesInGroup(group.id);
    add(pool[offset % Math.max(1, pool.length)]);
  }

  for (const candidate of marketingPages) {
    if (pageKind(candidate) !== 'info') add(candidate);
  }
  return picked;
}
