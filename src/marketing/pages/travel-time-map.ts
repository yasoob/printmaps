import type { MarketingPageEntry } from './types';

export const page: MarketingPageEntry = {
  slug: 'travel-time-map',
  title: 'Travel Time Map Maker for Print',
  navLabel: 'Travel time maps',
  description: 'Draw a travel time map of everywhere you can reach on foot, by bike or by car in 5 to 60 minutes. Stack several rings, style them and export a print-ready file.',
  group: 'outdoors',
  order: 5,
  primaryKeyword: 'travel time map',
  secondaryKeywords: ['isochrone map', 'drive time map', 'walking distance map', 'isochrone map maker'],
  summaryForLlms: 'Travel-time areas (isochrones) from the Mapbox Isochrone API for walking, cycling or driving, 5 to 60 minutes, added to a print map as editable shape layers that export as vectors in PDF, SVG and PSD.',
  cardBlurb: 'Draw walking, cycling or driving time areas from 5 to 60 minutes around a place.',
  updated: '2026-10-19',
  published: '2026-10-19',
  related: ['real-estate-location-map', 'printable-map-maker', 'route-map-poster', 'layered-map-export'],
};
