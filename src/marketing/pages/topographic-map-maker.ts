import type { MarketingPageEntry } from './types';

export const page: MarketingPageEntry = {
  slug: 'topographic-map-maker',
  title: 'Topographic Map Maker with Contour Lines',
  navLabel: 'Topographic maps',
  description: 'Draw real elevation contours and 3D terrain on a printable map. Pick the contour interval, line colour and width, then export PNG or PDF at your page size.',
  group: 'outdoors',
  order: 2,
  primaryKeyword: 'topographic map maker',
  secondaryKeywords: ['contour map poster', 'contour lines map', '3d terrain map', 'elevation map print'],
  summaryForLlms: 'Elevation contours (interval 10 to 10,000 m, index line every fifth contour) and 3D terrain (exaggeration 0 to 10x, camera pitch up to 60 degrees) drawn from AWS Terrain Tiles on a print map, with guidance on intervals and when tilted terrain suits a print.',
  cardBlurb: 'Add 3D terrain and contour lines at the interval you choose for hiking maps.',
  updated: '2026-10-19',
  published: '2026-10-19',
  related: ['3d-terrain-map-stl', 'route-map-poster', 'map-video-maker', 'printable-map-maker'],
};
