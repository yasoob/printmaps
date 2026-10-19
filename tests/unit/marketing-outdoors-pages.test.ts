import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PAGE_PRESET_DEFINITIONS } from '../../src/domain/pagePresets';
import { MAX_POI_ADDRESS_CHARACTERS, MAX_POI_ADDRESS_ROWS, MAX_POI_SPREADSHEET_ROWS } from '../../src/domain/poiSpreadsheet';
import { MAX_PHOTO_EDGE_PIXELS, MAX_PHOTO_STOPS } from '../../src/domain/studioPhotoAssets';
import { millimetresToPixels } from '../../src/export/preflight';
import { media } from '../../src/marketing/media';
import { fullTitle, getPage } from '../../src/marketing/registry';
import { planVideoExport } from '../../src/video/plan';

const root = path.resolve(import.meta.dirname, '../..');
const slugs = [
  'route-map-poster',
  'topographic-map-maker',
  '3d-terrain-map-stl',
  'map-video-maker',
  'travel-time-map',
  'real-estate-location-map',
] as const;
type Slug = (typeof slugs)[number];

const source = (slug: Slug) => readFileSync(path.join(root, 'src/pages', `${slug}.astro`), 'utf8');
const pixels = (widthMm: number, heightMm: number) =>
  `${millimetresToPixels(widthMm, 300, 'round')} × ${millimetresToPixels(heightMm, 300, 'round')}`;

const BANNED = [
  /\bunlock/i, /\belevate[sd]?\b/i, /seamless/i, /effortless/i, /empower/i, /game.changer/i, /dive into/i, /delve/i,
  /in today's/i, /whether you're/i, /look no further/i, /the perfect/i, /stunning/i, /breathtaking/i, /to life\b/i,
  /next.level/i, /journey/i, /tapestry/i, /curated/i, /robust/i, /cutting.edge/i, /\bensure/i, /\bhighlight/i,
  /crucial/i, /leverage/i, /vibrant/i, /\bboasts?\b/i, /—/, /!/, /open.source/i,
];
const LIMITATION_PHRASES = [/can't/i, /cannot/i, /doesn't/i, /does not support/i, /not supported/i, /unsupported/i, /unavailable/i, /\blacks?\b/i];

describe('outdoors, data and motion marketing pages', () => {
  it.each(slugs)('%s has a registry entry with search-friendly metadata', (slug) => {
    const entry = getPage(slug);
    expect(entry).toBeDefined();
    expect(fullTitle(entry!.title).length).toBeLessThanOrEqual(60);
    expect(entry!.description.length).toBeGreaterThanOrEqual(140);
    expect(entry!.description.length).toBeLessThanOrEqual(160);
    expect(entry!.title.toLowerCase()).toContain(entry!.primaryKeyword.replace(/s$/, ''));
  });

  it.each(slugs)('%s renders through the registry with one heading and known media', (slug) => {
    const page = source(slug);
    expect(page).toContain(`from '../marketing/pages/${slug}'`);
    expect(page.match(/\bheading="/g)).toHaveLength(1);
    for (const [, key] of page.matchAll(/media\['([^']+)'\]/g)) expect(Object.keys(media)).toContain(key);
  });

  it.each(slugs)('%s copy avoids banned and limitation phrasing', (slug) => {
    const page = source(slug);
    for (const pattern of [...BANNED, ...LIMITATION_PHRASES]) expect(page, String(pattern)).not.toMatch(pattern);
  });

  it('video sizes match the export planner', () => {
    const page = source('map-video-maker');
    const a3 = PAGE_PRESET_DEFINITIONS.find(({ id }) => id === 'A3')!;
    const portraitA3 = { widthMm: a3.shortEdgeMm, heightMm: a3.longEdgeMm };
    for (const aspect of ['16:9', '9:16', '1:1', '4:5', 'page'] as const) {
      for (const quality of ['standard', 'high'] as const) {
        const plan = planVideoExport({ motion: 'orbit', durationSeconds: 10, fps: 30, aspect, quality }, portraitA3);
        expect(page).toContain(`'${plan.width} × ${plan.height}'`);
      }
    }
  });

  it('page and flyer sizes match the print pixel maths', () => {
    expect(source('route-map-poster')).toContain(`${pixels(297, 420)} pixels`);
    const realEstate = source('real-estate-location-map');
    for (const [width, height] of [[215.9, 279.4], [210, 297], [148, 210], [139.7, 215.9], [101.6, 152.4], [180, 110]]) {
      expect(realEstate).toContain(`'${pixels(width, height)}'`);
    }
  });

  it('place and photo limits match the domain constants', () => {
    const realEstate = source('real-estate-location-map');
    expect(realEstate).toContain(`up to ${MAX_POI_SPREADSHEET_ROWS} rows`);
    expect(realEstate).toContain(`handles ${MAX_POI_ADDRESS_ROWS} rows`);
    expect(realEstate).toContain(`up to ${MAX_POI_ADDRESS_CHARACTERS} characters`);
    expect(realEstate).toContain(`up to ${MAX_PHOTO_STOPS} photo stops`);
    expect(realEstate).toContain(`${MAX_PHOTO_EDGE_PIXELS} pixels per side`);
  });
});
