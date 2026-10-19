import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Page } from 'playwright';
import type { Context, Job } from './capture.mts';
import { installVideoSampler, loadScene, newEditorPage, tidy } from './editor.mts';
import { BACKDROP, encode, labelledGrid, magick, presentObject } from './compose.mts';
import { openExport } from './ui.mts';
import { dialogBox, rawShot } from './editor-jobs.mts';
import { renderRelief } from './relief-render.mts';

const run = promisify(execFile);

const STYLES = [
  ['paper', 'Paper'], ['graphite', 'Graphite'], ['porcelain', 'Porcelain'], ['sandstone', 'Sandstone'],
  ['night-ink', 'Night Ink'], ['blueprint', 'Blueprint'], ['sea-glass', 'Sea Glass'], ['rosewater', 'Rosewater'],
  ['alpine', 'Alpine'], ['coastal', 'Coastal'], ['terracotta', 'Terracotta'], ['signal', 'Signal'],
] as const;

async function recordVideo(context: Context) {
  const frames: string[] = [];
  const page = await context.page(undefined, (current) => installVideoSampler(current, (frame) => {
    frames.push(frame);
  }));
  await loadScene(page, 'video-new-york');
  await openExport(page, 'Video');
  const dialogShot = await rawShot(context, page, 'video-dialog', await dialogBox(page));
  await encode(dialogShot, context.out('marketing/video/export-dialog-video-tab.webp'), { width: 1600 });
  const pending = page.waitForEvent('download', { timeout: 120_000 });
  await page.getByRole('dialog').getByRole('button', { name: 'Download MP4' }).click();
  await pending;
  const directory = context.raw('video-frames');
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  for (const [index, frame] of frames.entries()) {
    await writeFile(path.join(directory, `${String(index).padStart(4, '0')}.jpg`), Buffer.from(frame.split(',')[1], 'base64'));
  }
  return directory;
}

async function encodeClip(context: Context, directory: string) {
  const frames = (await readdir(directory)).filter((name) => name.endsWith('.jpg')).toSorted();
  if (frames.length < 30) throw new Error(`Only ${frames.length} video frames were captured.`);
  const input = ['-y', '-framerate', '15', '-i', path.join(directory, '%04d.jpg'), '-vf', 'scale=1200:-2:flags=lanczos,fps=30'];
  const mp4 = context.out('marketing/video/new-york-orbit-loop.mp4');
  await mkdir(path.dirname(mp4), { recursive: true });
  await run('ffmpeg', [...input, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  await encode(path.join(directory, frames[0]), context.out('marketing/video/new-york-orbit-poster-frame.webp'), { width: 1200 });
  const picks = [0, 0.2, 0.4, 0.6, 0.8].map((fraction) => path.join(directory, frames[Math.floor(fraction * (frames.length - 1))]));
  const strip = context.raw('video-strip.png');
  await magick([
    ...picks.flatMap((file) => ['(', file, '-resize', '560x', '-bordercolor', '#d9d5cc', '-border', '1', ')']),
    '-background', BACKDROP, '-splice', '24x0', '+append', '-chop', '24x0', '-bordercolor', BACKDROP, '-border', '48', strip,
  ]);
  await encode(strip, context.out('marketing/video/orbit-video-frame-strip.webp'), { width: 1600 });
}

async function styleGrid(context: Context) {
  const page = await context.page();
  await loadScene(page, 'style-sample');
  const tiles = [];
  for (const [id, label] of STYLES) {
    await page.getByRole('radio', { name: new RegExp(`^${label}:`) }).click();
    await page.locator(`[data-style-preset="${id}"][data-map-ready="true"]`).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(2500);
    await tidy(page);
    const file = context.raw(`style-${id}.png`);
    await page.locator('.print-frame').screenshot({ path: file, animations: 'disabled' });
    tiles.push({ file, label });
  }
  const grid = context.raw('styles-grid.png');
  await labelledGrid(tiles, grid, { columns: 4, tileWidth: 560, tileHeight: 396 });
  await encode(grid, context.out('marketing/styles/twelve-map-styles.webp'), { width: 1600 });
}

async function heroShots(context: Context) {
  const desktop = await context.page({ width: 1440, height: 832 });
  await loadScene(desktop, 'lisbon');
  await desktop.getByRole('tab', { name: 'Layout', exact: true }).click();
  await desktop.waitForTimeout(800);
  const desktopRaw = await rawShot(context, desktop, 'hero-desktop');
  await encode(desktopRaw, context.out('hero-assets/editor-new-york.webp'), { width: 1600, height: 924 });
  await encode(desktopRaw, context.out('marketing/hero/editor-lisbon-poster-layout.webp'), { width: 1600 });
  const tablet = await context.page({ width: 1024, height: 775 });
  await loadScene(tablet, 'lisbon');
  await encode(await rawShot(context, tablet, 'hero-tablet'), context.out('hero-assets/editor-tablet.webp'), { width: 1400, height: 1059 });
  const mobile = await context.page({ width: 390, height: 844 });
  await loadScene(mobile, 'lisbon');
  const mobileRaw = await rawShot(context, mobile, 'hero-mobile');
  await encode(mobileRaw, context.out('hero-assets/editor-mobile.webp'), { width: 780, height: 535 });
  await encode(mobileRaw, context.out('marketing/hero/editor-lisbon-mobile.webp'), { width: 780 });
}

async function stlRelief(context: Context) {
  const page = await context.page();
  await loadScene(page, 'matterhorn');
  const dialog = await openExport(page, '3D model');
  await dialog.getByRole('button', { name: /Fit dimensions to print frame/ }).click();
  await page.waitForTimeout(1500);
  const shot = await rawShot(context, page, 'export-3d', await dialogBox(page));
  await encode(shot, context.out('marketing/stl/export-dialog-3d-model-tab.webp'), { width: 1600 });
  const stl = context.raw('matterhorn-relief.stl');
  const pending = page.waitForEvent('download', { timeout: 240_000 });
  await dialog.getByRole('button', { name: 'Download STL' }).click();
  await (await pending).saveAs(stl);
  const renderer = await newEditorPage(context.browser);
  try {
    const dataUrl = await renderRelief(renderer, stl, { width: 3000, height: 2000 });
    const render = context.raw('relief-render.png');
    await writeFile(render, Buffer.from(dataUrl.split(',')[1], 'base64'));
    await presentObject(render, context.out('marketing/stl/matterhorn-stl-relief-preview.webp'));
  } finally {
    await renderer.context().close();
  }
}

export type OgCard = { slug: string; title: string; kicker: string; visual: string; rawFile: string };

async function ogCard(page: Page, card: OgCard, output: string) {
  const image = `data:image/png;base64,${(await readFile(card.visual)).toString('base64')}`;
  const logo = `data:image/png;base64,${(await readFile(new URL('../../public/logo.png', import.meta.url))).toString('base64')}`;
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<!doctype html><html><head><style>
    * { box-sizing: border-box; margin: 0; }
    body { width: 1200px; height: 630px; overflow: hidden; background: ${BACKDROP}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1d1d1f; }
    .card { display: grid; grid-template-columns: 520px 1fr; height: 100%; }
    .copy { padding: 64px 0 56px 68px; display: flex; flex-direction: column; }
    .brand { display: flex; align-items: center; gap: 14px; font-size: 24px; font-weight: 600; letter-spacing: -0.01em; }
    .brand img { width: 52px; height: 52px; object-fit: contain; }
    .kicker { margin-top: auto; font-size: 22px; font-weight: 600; color: #8a3b1e; letter-spacing: 0.02em; text-transform: uppercase; }
    h1 { margin-top: 14px; font-size: 58px; line-height: 1.04; font-weight: 700; letter-spacing: -0.03em; }
    .url { margin-top: 28px; font-size: 22px; color: #5d5a54; }
    .visual { position: relative; overflow: hidden; }
    .visual img { position: absolute; inset: 40px 0 40px 24px; width: calc(100% - 24px); height: calc(100% - 80px); object-fit: cover; object-position: center; border-radius: 14px 0 0 14px; box-shadow: 0 18px 50px rgba(43, 36, 24, .22); }
  </style></head><body><div class="card"><div class="copy">
    <div class="brand"><img src="${logo}" alt="">Print Map Studio</div>
    <div class="kicker">${card.kicker}</div><h1>${card.title}</h1><div class="url">printmaps.yasoob.me</div>
  </div><div class="visual"><img src="${image}" alt=""></div></div></body></html>`);
  await page.waitForTimeout(300);
  const raw = card.rawFile;
  await mkdir(path.dirname(output), { recursive: true });
  await page.screenshot({ path: raw });
  await encode(raw, output, { width: 1200, height: 630, quality: 90 });
}

async function ogCards(context: Context) {
  const raw = (name: string) => context.raw(name);
  const cards: Omit<OgCard, 'rawFile'>[] = [
    { slug: 'index', kicker: 'Free map poster maker', title: 'Make maps worth printing', visual: raw('hero-desktop.png') },
    { slug: 'printable-map-maker', kicker: 'Printable map maker', title: 'Exact page sizes, PDF, SVG and PSD', visual: raw('poster-kyoto.png') },
    { slug: 'gpx-map-maker', kicker: 'GPX map maker', title: 'Turn a GPS track into a print', visual: raw('poster-ventoux.png') },
    { slug: 'layered-map-export', kicker: 'Layered export', title: 'SVG, PSD, PDF and PNG from one map', visual: raw('export-print.png') },
    { slug: 'about', kicker: 'About', title: 'An open-source map editor for print', visual: raw('editor-map-tab.png') },
    { slug: 'privacy', kicker: 'Privacy', title: 'Your maps stay in your browser', visual: raw('poster-copenhagen.png') },
    { slug: 'product-facts', kicker: 'Product facts', title: 'What the editor can and can’t do', visual: raw('editor-layout-tab.png') },
    { slug: 'city-map-poster', kicker: 'City map posters', title: 'A poster of any town, ready to print', visual: raw('poster-lisbon.png') },
    { slug: 'country-map-poster', kicker: 'Country map posters', title: 'A map shaped like the country', visual: raw('poster-italy.png') },
    { slug: 'wedding-map-poster', kicker: 'Wedding map posters', title: 'The place you met, on paper', visual: raw('poster-wedding.png') },
    { slug: 'travel-map-with-photos', kicker: 'Travel maps with photos', title: 'Pin your trip photos to the map', visual: raw('poster-road-trip.png') },
    { slug: 'map-poster-templates', kicker: 'Map poster templates', title: 'One map, five ready layouts', visual: raw('templates-gallery.png') },
    { slug: 'route-map-poster', kicker: 'Route map posters', title: 'Runs, rides and hikes worth framing', visual: raw('poster-thames.png') },
    { slug: 'topographic-map-maker', kicker: 'Topographic maps', title: 'Contour lines and 3D terrain', visual: raw('poster-matterhorn.png') },
    { slug: '3d-terrain-map-stl', kicker: '3D terrain STL', title: 'Download terrain for your 3D printer', visual: raw('relief-render.png') },
    { slug: 'map-video-maker', kicker: 'Map video maker', title: 'Orbit clips of your poster as MP4', visual: raw('video-frames/0000.jpg') },
    { slug: 'travel-time-map', kicker: 'Travel time maps', title: 'Show how far you get in 10 minutes', visual: raw('poster-amsterdam.png') },
    { slug: 'real-estate-location-map', kicker: 'Real estate maps', title: 'Location maps for listings and flyers', visual: raw('poster-clifton.png') },
    { slug: 'printmaps-net-alternative', kicker: 'Printmaps.net alternative', title: 'Free, with PDF and layered files', visual: raw('compare-export.png') },
    { slug: 'map-print-size-guide', kicker: 'Print size guide', title: 'Paper sizes, DPI and pixels for maps', visual: raw('sizes.png') },
    { slug: 'share-and-embed-maps', kicker: 'Share and embed', title: 'Read-only links and iframe embeds', visual: raw('share-dialog.png') },
  ];
  const page = await context.page();
  for (const card of cards) {
    const output = context.out(`marketing/og/${card.slug}.jpg`);
    await ogCard(page, { ...card, rawFile: raw(`og-${card.slug}.png`) }, output);
    if (card.slug === 'index') await encode(raw('og-index.png'), context.out('social-preview.png'), { width: 1200, height: 630 });
  }
}

async function embedExample(context: Context) {
  const page = await context.page({ width: 1200, height: 860 });
  await loadScene(page, 'lisbon');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const code = await page.getByRole('textbox', { name: 'Embed HTML' }).inputValue();
  const source = /src="([^"]+)"/.exec(code)?.[1];
  if (!source) throw new Error('No embed URL in the share dialog.');
  await page.goto('about:blank');
  await page.setContent(`<!doctype html><html><head><style>
    body { margin: 0; background: #fbfaf7; font-family: Georgia, 'Times New Roman', serif; color: #23201b; }
    main { max-width: 760px; margin: 0 auto; padding: 56px 32px; }
    .eyebrow { font: 600 13px/1 'Helvetica Neue', Arial, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #8a3b1e; }
    h1 { font-size: 40px; line-height: 1.15; margin: 14px 0 16px; font-weight: 600; }
    p { font-size: 19px; line-height: 1.6; margin: 0 0 22px; color: #3d3931; }
    iframe { display: block; width: 100%; height: 480px; border: 0; border-radius: 10px; box-shadow: 0 1px 0 #e4dfd4, 0 12px 30px rgba(43, 36, 24, .10); }
    .caption { font: 14px/1.4 'Helvetica Neue', Arial, sans-serif; color: #6b665c; margin-top: 12px; }
  </style></head><body><main>
    <div class="eyebrow">Travel notes</div>
    <h1>Three slow days in Lisbon</h1>
    <p>We stayed near Graça and walked everywhere. The map below is the one we printed for the hallway; pan around to see where the trams climb.</p>
    <iframe src="${source}" title="Lisbon map" loading="eager"></iframe>
    <div class="caption">Embedded from Print Map Studio as a read-only map.</div>
  </main></body></html>`);
  await page.frameLocator('iframe').locator('[data-map-ready="true"]').first().waitFor({ timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(6000);
  const raw = context.raw('embed-example.png');
  await page.screenshot({ path: raw });
  await encode(raw, context.out('marketing/share/embedded-map-in-a-blog-post.webp'), { width: 1600 });
}

/**
 * Phone-sized art direction for wide editor screenshots: the inspector column plus a strip of
 * the map beside it, instead of the whole window shrunk to an unreadable size.
 */
const MOBILE_CROPS: [raw: string, publicPath: string][] = [
  ['country-controls', 'marketing/country/country-outline-map-frame-controls-mobile.webp'],
  ['photos-controls', 'marketing/photos/photo-story-controls-mobile.webp'],
  ['topo-3d', 'marketing/topo/matterhorn-3d-terrain-with-contours-mobile.webp'],
  ['route-elevation', 'marketing/route/mont-ventoux-elevation-panel-mobile.webp'],
  ['isochrone-controls', 'marketing/travel-time/travel-time-area-controls-mobile.webp'],
  ['realestate-places', 'marketing/real-estate/bulk-places-address-lookup-mobile.webp'],
  ['sizes', 'marketing/sizes/page-size-presets-mobile.webp'],
  ['editor-map-tab', 'marketing/editor/map-tab-style-gallery-mobile.webp'],
  ['editor-layout-tab', 'marketing/editor/layout-tab-poster-text-mobile.webp'],
  ['editor-route', 'marketing/editor/route-layer-selected-mobile.webp'],
];

async function mobileCrops(context: Context) {
  for (const [name, publicPath] of MOBILE_CROPS) {
    const raw = context.raw(`${name}.png`);
    const { stdout } = await run('magick', ['identify', '-format', '%w %h', raw]);
    const [width, height] = stdout.trim().split(' ').map(Number);
    const cropWidth = Math.round(height * 0.62);
    await encode(raw, context.out(publicPath), { crop: { x: width - cropWidth, y: 0, width: cropWidth, height }, width: 800 });
  }
}

export const extraJobs: Job[] = [
  { id: 'mobile-crops', run: mobileCrops },
  { id: 'embed', run: embedExample },
  { id: 'video', run: async (context) => encodeClip(context, await recordVideo(context)) },
  { id: 'video-encode', run: (context) => encodeClip(context, context.raw('video-frames')) },
  { id: 'stl', run: stlRelief },
  { id: 'styles-grid', run: styleGrid },
  { id: 'hero', run: heroShots },
  {
    id: 'posters-extra',
    async run(context) {
      for (const scene of ['kyoto', 'copenhagen', 'new-york']) await context.poster(scene);
    },
  },
  { id: 'og', run: ogCards },
];
