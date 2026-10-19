import type { MediaKey } from '../media';

/**
 * Navigation groups. `project` pages (about, privacy, product facts) appear in the footer
 * but not in the Features or Guides menus.
 */
export type MarketingPageGroup =
  | 'make'
  | 'outdoors'
  | 'export'
  | 'business'
  | 'compare'
  | 'guide'
  | 'project';

/**
 * Controls structured data: `guide` pages get a TechArticle node, `info` pages an
 * AboutPage, everything else a WebPage. Defaults from the group.
 */
export type MarketingPageKind = 'landing' | 'guide' | 'comparison' | 'info';

/**
 * Metadata for one marketing page. Add one file per page at
 * `src/marketing/pages/<slug>.ts` that exports `page`; the registry picks it up
 * automatically for navigation, footer, related links, sitemap lastmod and /llms.txt.
 */
export type MarketingPageEntry = {
  /**
  URL segment without slashes, e.g. `city-map-poster`. Must match the file name.
  */
  slug: string;
  /**
   * Page title without the site name. Rendered as `${title} | Print Map Studio` when
   * that fits in 60 characters, otherwise as `title` alone (which must then be ≤ 60).
   */
  title: string;
  /**
  Short label for menus and the footer, e.g. `City map posters`.
  */
  navLabel: string;
  /**
  Meta description, 140-160 characters, unique across the site.
  */
  description: string;
  group: MarketingPageGroup;
  /**
  Sort order inside the group (ascending).
  */
  order: number;
  primaryKeyword: string;
  secondaryKeywords?: readonly string[];
  /**
  One or two plain factual sentences for /llms.txt. No marketing language.
  */
  summaryForLlms: string;
  /**
  Last meaningful content change, `YYYY-MM-DD`. Drives sitemap lastmod and dateModified.
  */
  updated: string;
  /**
  First publication date, `YYYY-MM-DD`. Used for guide articles.
  */
  published?: string;
  /**
  Media key for the 1200×630 social image. Defaults to `og.<slug>` when that key exists.
  */
  ogImage?: MediaKey;
  kind?: MarketingPageKind;
  /**
  Slugs to show as related pages instead of the computed set.
  */
  related?: readonly string[];
  /**
  Keep the page out of the header menus (it still appears in the footer and llms.txt).
  */
  hideFromNav?: boolean;
};

export type MarketingPageModule = {
  page: MarketingPageEntry;
};
