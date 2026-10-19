/**
 * Regenerates every marketing screenshot, poster image and OG card from the real editor.
 *
 *   VITE_REACT_SCAN=false VITE_MAPBOX_PUBLIC_ACCESS=pk.marketing-media.capture \
 *     npx astro dev --host 127.0.0.1 --port 4480
 *   node scripts/marketing-media/capture.mts [job ...] [--fresh]
 *
 * Demo projects live in tests/marketing-media/scenes.ts. Raw captures are cached in
 * $MEDIA_WORK_DIR (default: the OS temp dir) and finished files are written to public/.
 */
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Browser, Page } from 'playwright';
import { downloadExport, launchBrowser, loadScene, newEditorPage, type PageSetup, type Viewport } from './editor.mts';
import { encode, presentPoster, presentPosterRow } from './compose.mts';
import { editorJobs } from './editor-jobs.mts';
import { extraJobs } from './extra-jobs.mts';
import { legacyJobs } from './legacy-jobs.mts';

export const WORK = process.env.MEDIA_WORK_DIR ?? path.join(tmpdir(), 'print-map-marketing-media');
export const PUBLIC = new URL('../../public/', import.meta.url).pathname;
const isFresh = process.argv.includes('--fresh');

export type Context = {
  browser: Browser;
  page: (viewport?: Viewport, setup?: PageSetup) => Promise<Page>;
  raw: (name: string) => string;
  out: (publicPath: string) => string;
  poster: (scene: string, prepare?: (page: Page) => Promise<void>) => Promise<string>;
};

export type Job = { id: string; run: (context: Context) => Promise<void> };

async function exists(file: string) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

const written: string[] = [];

function createContext(browser: Browser): Context {
  let current: Page | undefined;
  const context: Context = {
    browser,
    async page(viewport, setup) {
      await current?.context().close();
      current = await newEditorPage(browser, viewport, setup);
      return current;
    },
    raw: (name) => path.join(WORK, 'raw', name),
    out(publicPath) {
      const file = path.join(WORK, 'out', publicPath);
      written.push(publicPath);
      return file;
    },
    async poster(scene, prepare) {
      const file = context.raw(`poster-${scene}.png`);
      if (!isFresh && await exists(file)) return file;
      const page = await context.page();
      await loadScene(page, scene);
      await prepare?.(page);
      await downloadExport(page, 'PNG', file);
      return file;
    },
  };
  return context;
}

const posterJobs: Job[] = [
  {
    id: 'city',
    async run(context) {
      const poster = await context.poster('lisbon');
      await presentPoster(poster, context.out('marketing/city/lisbon-city-map-poster.webp'));
      await encode(poster, context.out('marketing/city/lisbon-poster-street-detail.webp'), {
        crop: { x: 1250, y: 2550, width: 2000, height: 1250 }, width: 1600, height: 1000,
      });
    },
  },
  {
    id: 'templates-examples',
    async run(context) {
      const posters = [await context.poster('lisbon'), await context.poster('lisbon-quiet'), await context.poster('lisbon-dark')];
      await presentPosterRow(posters, context.out('marketing/templates/lisbon-three-poster-layouts.webp'));
    },
  },
  {
    id: 'wedding',
    async run(context) {
      const poster = await context.poster('wedding');
      await presentPoster(poster, context.out('marketing/wedding/edinburgh-wedding-map-poster.webp'));
      await encode(poster, context.out('marketing/wedding/two-places-joined-by-an-arc.webp'), {
        crop: { x: 450, y: 1425, width: 2600, height: 2000 }, width: 1600, height: 1231,
      });
    },
  },
  {
    id: 'road-trip',
    async run(context) {
      const poster = await context.poster('road-trip');
      await presentPoster(poster, context.out('marketing/photos/utah-road-trip-photo-map-poster.webp'));
    },
  },
  {
    id: 'route',
    async run(context) {
      await presentPoster(await context.poster('thames'), context.out('marketing/route/london-marathon-route-poster.webp'));
      await presentPoster(await context.poster('ventoux'), context.out('marketing/route/mont-ventoux-cycling-route-poster.webp'));
    },
  },
  {
    id: 'isochrone',
    async run(context) {
      await presentPoster(await context.poster('amsterdam'), context.out('marketing/travel-time/amsterdam-walking-time-map.webp'));
    },
  },
  {
    id: 'realestate',
    async run(context) {
      const poster = await context.poster('clifton');
      await presentPoster(poster, context.out('marketing/real-estate/clifton-location-map-flyer.webp'));
      const { width, height } = { width: 2480, height: 3508 };
      await encode(poster, context.out('marketing/real-estate/location-qr-code-detail.webp'), {
        crop: { x: width - 1500, y: height - 1100, width: 1500, height: 1000 }, width: 1200, height: 800,
      });
    },
  },
  {
    id: 'topo',
    async run(context) {
      await presentPoster(await context.poster('matterhorn'), context.out('marketing/topo/matterhorn-contour-map.webp'));
    },
  },
];

const jobs: Job[] = [...posterJobs, ...editorJobs, ...legacyJobs, ...extraJobs];

const requested = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
const selected = requested.length > 0 ? jobs.filter((job) => requested.some((name) => job.id === name || job.id.startsWith(`${name}:`))) : jobs;
if (selected.length === 0) throw new Error(`No job matches ${requested.join(', ')}. Jobs: ${jobs.map((job) => job.id).join(', ')}`);

await mkdir(path.join(WORK, 'raw'), { recursive: true });
const browser = await launchBrowser();
const failures: string[] = [];
try {
  const context = createContext(browser);
  for (const job of selected) {
    const started = Date.now();
    try {
      await job.run(context);
      console.log(`✓ ${job.id} (${Math.round((Date.now() - started) / 1000)}s)`);
    } catch (error) {
      failures.push(job.id);
      console.error(`✗ ${job.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} finally {
  await browser.close();
}

for (const publicPath of new Set(written)) {
  const source = path.join(WORK, 'out', publicPath);
  if (!await exists(source)) continue;
  await mkdir(path.dirname(path.join(PUBLIC, publicPath)), { recursive: true });
  await copyFile(source, path.join(PUBLIC, publicPath));
}
console.log(`Published ${new Set(written).size} files to public/.`);
if (failures.length > 0) {
  console.error(`Failed jobs: ${failures.join(', ')}`);
  process.exitCode = 1;
}
