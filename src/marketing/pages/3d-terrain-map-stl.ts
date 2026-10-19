import type { MarketingPageEntry } from './types';

export const page: MarketingPageEntry = {
  slug: '3d-terrain-map-stl',
  title: '3D Terrain Map STL for 3D Printing',
  navLabel: '3D terrain STL',
  description: 'Export any area as a watertight STL terrain model for 3D printing. Set the size in millimetres, base, exaggeration and detail, and raise a route as a ridge.',
  group: 'outdoors',
  order: 3,
  primaryKeyword: '3d terrain map stl',
  secondaryKeywords: ['3d printed terrain map', 'topographic relief stl', 'stl map file', '3d print topo map'],
  summaryForLlms: 'Binary STL terrain relief export in millimetres: 10 to 1000 mm per side, 0.2 to 100 mm base, 0.1 to 50x exaggeration, 64, 128 or 256 samples on the long side, and an optional raised route ridge. Elevation from AWS Terrain Tiles (Mapzen).',
  cardBlurb: 'Turn the terrain inside your print frame into an STL relief for a 3D printer.',
  updated: '2026-10-19',
  published: '2026-10-19',
  related: ['topographic-map-maker', 'route-map-poster', 'gpx-map-maker', 'map-video-maker'],
};
