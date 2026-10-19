import { readFile } from 'node:fs/promises';
import { firefox, type Browser, type Page } from 'playwright';

export const BASE_URL = process.env.MEDIA_BASE_URL ?? 'http://127.0.0.1:4480';

export type Viewport = { width: number; height: number };

export async function launchBrowser(): Promise<Browser> {
  return firefox.launch({ headless: process.env.MEDIA_HEADED !== '1' });
}

export type PageSetup = (page: Page) => Promise<void>;

export async function newEditorPage(browser: Browser, viewport: Viewport = { width: 1440, height: 900 }, setup?: PageSetup): Promise<Page> {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: 'reduce', locale: 'en-GB' });
  const page = await context.newPage();
  await installProviderMocks(page);
  await setup?.(page);
  page.on('pageerror', (error) => console.warn(`  page error: ${error.message.slice(0, 200)}`));
  await page.goto(`${BASE_URL}/editor/`);
  await waitForMap(page);
  await page.locator('.maplibregl-ctrl-attrib:not([open])').waitFor({ state: 'attached', timeout: 15_000 });
  return page;
}

export async function waitForMap(page: Page, settleMs = 2500) {
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 90_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(settleMs);
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 90_000 });
}

export async function loadScene(page: Page, id: string) {
  const project = await page.evaluate(async (sceneId) => {
    const modulePath = '/tests/marketing-media/scenes.ts';
    const scenes = await import(/* @vite-ignore */ modulePath);
    return scenes.buildScene(sceneId);
  }, id);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Open project', exact: true }).click();
  await (await chooser).setFiles({ name: `${id}.printmap.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  const replace = page.getByRole('button', { name: 'Replace project', exact: true });
  const title = page.locator('header').getByText(project.title, { exact: true });
  const deadline = Date.now() + 30_000;
  while (await title.count() === 0) {
    if (Date.now() > deadline) throw new Error(`The ${id} project did not open.`);
    if (await replace.isVisible()) await replace.click();
    await page.waitForTimeout(250);
  }
  await waitForMap(page, 4000);
  const firstLayer = project.layers[0]?.name;
  if (firstLayer && (page.viewportSize()?.width ?? 1440) >= 900) await page.getByRole('button', { name: `Select ${firstLayer}`, exact: true }).waitFor({ state: 'attached', timeout: 15_000 });
  await tidy(page);
  return project;
}

/** Remove transient UI: focus rings, hover states and the expanded map credit. */
export async function tidy(page: Page) {
  await page.mouse.move(4, 896);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    const attribution = document.querySelector('.maplibregl-ctrl-attrib');
    if (attribution?.hasAttribute('open')) attribution.removeAttribute('open');
    attribution?.classList.remove('maplibregl-compact-show');
  });
  await page.waitForTimeout(300);
}

export async function downloadExport(page: Page, format: 'PNG' | 'PDF' | 'Layered SVG' | 'Layered PSD', path: string) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('tab', { name: 'Print', exact: true }).click();
  await dialog.getByRole('radio', { name: new RegExp(`^${format}`) }).click();
  const pending = page.waitForEvent('download', { timeout: 240_000 });
  await dialog.getByRole('button', { name: new RegExp(`^Download ${format}`) }).click();
  const download = await pending;
  await download.saveAs(path);
  await dialog.waitFor({ state: 'detached', timeout: 30_000 }).catch(async () => {
    await page.keyboard.press('Escape');
  });
  return readFile(path);
}

type Position = [number, number];
const fixtures = new URL('../../tests/marketing-media/data/', import.meta.url);

/** Known search results for the demo flows; the real service needs a Mapbox token. */
const GEOCODE: Record<string, { label: string; coordinates: Position }> = {
  'dam square': { label: 'Dam Square, Amsterdam, Netherlands', coordinates: [4.8932, 52.3731] },
  'clifton down station, bristol': { label: 'Clifton Down station, Whiteladies Road, Bristol', coordinates: [-2.61144, 51.46443] },
  'christ church primary school, clifton': { label: 'Christ Church Primary School, Royal Park, Bristol', coordinates: [-2.61651, 51.45685] },
  'brandon hill, bristol': { label: 'Brandon Hill, Great George Street, Bristol', coordinates: [-2.60718, 51.4541] },
  'whiteladies road, bristol': { label: 'Whiteladies Road, Clifton, Bristol', coordinates: [-2.60735, 51.46272] },
  'clifton suspension bridge, bristol': { label: 'Clifton Suspension Bridge, Bridge Road, Bristol', coordinates: [-2.62781, 51.45497] },
};

async function valhalla(center: Position, profile: string, minutes: number) {
  const costing = profile === 'walking' ? 'pedestrian' : (profile === 'cycling' ? 'bicycle' : 'auto');
  const body = { locations: [{ lon: center[0], lat: center[1] }], costing, contours: [{ time: minutes }], polygons: true, denoise: 0.5, generalize: 30 };
  const response = await fetch(`https://valhalla1.openstreetmap.de/isochrone?json=${encodeURIComponent(JSON.stringify(body))}`, { headers: { 'User-Agent': 'PrintMapStudioMarketingMedia/1.0' } });
  return response.json();
}

export async function installProviderMocks(page: Page) {
  const isochrones = JSON.parse(await readFile(new URL('isochrones.json', fixtures), 'utf8'));
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', async (route) => {
    const query = (new URL(route.request().url()).searchParams.get('q') ?? '').toLowerCase().trim();
    const match = GEOCODE[query];
    const features = match ? [{ id: `address.${query.replaceAll(/\W+/g, '-')}`, type: 'Feature', geometry: { type: 'Point', coordinates: match.coordinates }, properties: { full_address: match.label } }] : [];
    await route.fulfill({ json: { type: 'FeatureCollection', features } });
  });
  await page.route('https://api.mapbox.com/isochrone/v1/mapbox/**', async (route) => {
    const url = new URL(route.request().url());
    const [profile, position] = url.pathname.split('/').slice(-2);
    const center = position.split(',').map(Number) as Position;
    const minutes = Number(url.searchParams.get('contours_minutes'));
    const cached = isochrones.amsterdam.find((entry: { minutes: number; center: Position }) => entry.minutes === minutes
      && Math.abs(entry.center[0] - center[0]) < 0.001 && Math.abs(entry.center[1] - center[1]) < 0.001);
    const geometry = cached ? { type: 'Polygon', coordinates: cached.coordinates } : (await valhalla(center, profile, minutes)).features[0].geometry;
    await route.fulfill({ json: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { contour: minutes }, geometry }] } });
  });
}

/**
 * Firefox has no MP4 MediaRecorder. For the video shots we report MP4 support and replace the
 * recorder with a sampler that hands each recorded canvas frame to Node; ffmpeg encodes the clip.
 */
export async function installVideoSampler(page: Page, onFrame: (dataUrl: string) => void) {
  await page.exposeFunction('__marketingMediaFrame', onFrame);
  await page.addInitScript(() => {
    type Listener = (event: Event) => void;
    class FrameSampler {
      static isTypeSupported(type: string) { return type.startsWith('video/mp4'); }
      state: RecordingState = 'inactive';
      mimeType = 'video/mp4';
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      private timer = 0;
      private listeners: Record<string, Listener[]> = {};
      private stream: MediaStream;
      constructor(stream: MediaStream) { this.stream = stream; }
      addEventListener(type: string, listener: Listener) { (this.listeners[type] ??= []).push(listener); }
      removeEventListener(type: string, listener: Listener) { this.listeners[type] = (this.listeners[type] ?? []).filter((candidate) => candidate !== listener); }
      start() {
        this.state = 'recording';
        const canvas = (this.stream as MediaStream & { canvas?: HTMLCanvasElement }).canvas;
        const send = (window as unknown as { __marketingMediaFrame: (frame: string) => void }).__marketingMediaFrame;
        this.timer = window.setInterval(() => { if (canvas) send(canvas.toDataURL('image/jpeg', 0.92)); }, 1000 / 15);
      }
      stop() {
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        window.clearInterval(this.timer);
        const box = (type: string, size: number) => { const bytes = new Uint8Array(size); new DataView(bytes.buffer).setUint32(0, size); bytes.set([...type].map((c) => c.codePointAt(0) ?? 0), 4); return bytes; };
        const blob = new Blob([box('ftyp', 16), box('moov', 8), box('mdat', 8)], { type: 'video/mp4' });
        this.ondataavailable?.({ data: blob } as BlobEvent);
        setTimeout(() => this.onstop?.(), 50);
      }
    }
    (window as unknown as { MediaRecorder: unknown }).MediaRecorder = FrameSampler;
  });
}
