import type { MarketingPageEntry } from './types';

export const page: MarketingPageEntry = {
  slug: 'route-map-poster',
  title: 'Route Map Posters from Strava and GPX',
  navLabel: 'Route map posters',
  description: 'Make a route map poster from a Strava, Garmin or Komoot GPX file. Set a line weight that prints well, mark the start and finish, and add an elevation profile.',
  group: 'outdoors',
  order: 1,
  primaryKeyword: 'route map poster',
  secondaryKeywords: ['strava route poster', 'marathon route poster', 'cycling route print', 'hiking route map poster', 'gpx elevation profile'],
  summaryForLlms: 'Guide to designing a printed running, cycling or hiking route poster from a GPX export: page size, route line width (0.3 mm per pixel in PDF, SVG and PSD), start and finish places, poster text and a separately downloaded elevation profile.',
  updated: '2026-10-19',
  published: '2026-10-19',
  related: ['gpx-map-maker', 'topographic-map-maker', '3d-terrain-map-stl', 'map-video-maker'],
};
