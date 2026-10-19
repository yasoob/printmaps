import type { MarketingImage } from './media';
import { pageKind, pageUrl, type MarketingPageEntry } from './registry';
import { CREATOR_NAME, CREATOR_URL, GITHUB_URL, SITE_NAME, SITE_URL } from './product';

type JsonLdNode = Record<string, unknown>;

export const PERSON_ID = `${CREATOR_URL}/#person`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const APPLICATION_ID = `${SITE_URL}/#application`;

export function personNode(): JsonLdNode {
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: CREATOR_NAME,
    url: CREATOR_URL,
    sameAs: ['https://github.com/yasoob'],
  };
}

export function websiteNode(description: string): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description,
    inLanguage: 'en',
    publisher: { '@id': PERSON_ID },
  };
}

export function applicationNode(description: string, screenshot: MarketingImage): JsonLdNode {
  return {
    '@type': 'WebApplication',
    '@id': APPLICATION_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/editor/`,
    sameAs: [GITHUB_URL],
    applicationCategory: 'DesignApplication',
    applicationSubCategory: 'Map design software',
    operatingSystem: 'Web browser',
    browserRequirements: 'Requires a current browser with JavaScript and WebGL enabled',
    inLanguage: 'en',
    isAccessibleForFree: true,
    description,
    screenshot: {
      '@type': 'ImageObject',
      url: `${SITE_URL}${screenshot.src}`,
      width: screenshot.width,
      height: screenshot.height,
      caption: screenshot.alt,
    },
    author: { '@id': PERSON_ID },
    creator: { '@id': PERSON_ID },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'A2-A6, US Letter and custom millimetre page sizes',
      '12 map styles with a palette editor',
      'Routes, places, custom markers, areas and travel-time areas',
      'GPX, KML and GeoJSON import',
      'Poster titles, layout presets and country or region shaped map frames',
      'Photos pinned to places, compass, scale bar, coordinate grid and location QR code',
      '3D terrain and contour lines',
      'PNG, PDF, layered SVG and layered PSD export',
      'MP4 map video and STL terrain relief export',
      'Read-only share links and iframe embeds',
      'Local browser autosave and portable project files',
    ],
  };
}

export type Breadcrumb = { name: string; url: string };

export function breadcrumbNode(url: string, items: readonly Breadcrumb[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function breadcrumbsFor(entry: MarketingPageEntry): readonly Breadcrumb[] {
  return [
    { name: 'Home', url: `${SITE_URL}/` },
    { name: entry.navLabel, url: pageUrl(entry) },
  ];
}

type PageGraphOptions = {
  entry: MarketingPageEntry;
  title: string;
  description: string;
  image: MarketingImage;
};

/**
Structured data for a registry page: Person, WebSite, the page, its breadcrumb, and a TechArticle for guides.
*/
export function pageGraph({ entry, title, description, image }: PageGraphOptions): JsonLdNode {
  const url = pageUrl(entry);
  const kind = pageKind(entry);
  const imageUrl = `${SITE_URL}${image.src}`;
  const webPage: JsonLdNode = {
    '@type': kind === 'info' && entry.slug === 'about' ? 'AboutPage' : 'WebPage',
    '@id': `${url}#webpage`,
    name: title,
    url,
    description,
    inLanguage: 'en',
    isPartOf: { '@id': WEBSITE_ID },
    breadcrumb: { '@id': `${url}#breadcrumb` },
    primaryImageOfPage: { '@type': 'ImageObject', url: imageUrl, width: image.width, height: image.height },
    dateModified: entry.updated,
    ...(kind !== 'info' && { about: { '@id': APPLICATION_ID } }),
  };
  const graph: JsonLdNode[] = [
    personNode(),
    websiteNode(`${SITE_NAME} is a free browser-based editor for print-ready maps and map posters.`),
    webPage,
    breadcrumbNode(url, breadcrumbsFor(entry)),
  ];
  if (kind === 'guide') {
    graph.push({
      '@type': 'TechArticle',
      '@id': `${url}#article`,
      headline: title,
      description,
      url,
      inLanguage: 'en',
      image: imageUrl,
      mainEntityOfPage: { '@id': `${url}#webpage` },
      author: { '@id': PERSON_ID },
      publisher: { '@id': PERSON_ID },
      datePublished: entry.published ?? entry.updated,
      dateModified: entry.updated,
      about: { '@id': APPLICATION_ID },
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
