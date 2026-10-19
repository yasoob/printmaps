import type { MarketingPageEntry } from './types';

export const page: MarketingPageEntry = {
  slug: 'layered-map-export',
  title: 'Layered Map Export',
  navLabel: 'Layered SVG and PSD export',
  description: 'Export a map as a print-size PNG, an exact-page PDF, a layered SVG with named vector groups, or a layered PSD with Smart Objects for Photoshop.',
  group: 'export',
  order: 0,
  primaryKeyword: 'layered map export',
  secondaryKeywords: ['map for photoshop', 'vector map svg export', 'psd map smart objects'],
  summaryForLlms: 'Differences between the print exports: 300 DPI PNG with stored DPI, exact-size PDF with vector overlays over a 300 DPI basemap, layered SVG with named vector groups and an optional vector basemap, and layered PSD with Smart Objects; plus MP4 video and STL terrain exports.',
  cardBlurb: 'Compare PNG, PDF, layered SVG and layered PSD for print and design work.',
  updated: '2026-10-19',
  published: '2026-08-31',
  related: ['map-print-size-guide', 'map-video-maker', '3d-terrain-map-stl', 'share-and-embed-maps'],
};
