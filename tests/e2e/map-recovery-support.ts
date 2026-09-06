import { buffer } from 'node:stream/consumers';
import { expect, type Page } from '@playwright/test';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { expandToolSettings } from './authoring-panel-support';
import { calculateMapScale } from '../../src/app/components/mapScaleMath';

declare global {
  interface Window {
    recoveryRuntimeErrors: string[];
    recoveryAudit: {
      map: MapLibreMap | null;
      maps: MapLibreMap[];
      errors: unknown[];
    };
  }
}

export const tilePattern = /tiles\.openfreemap\.org\/.*\/\d+\/\d+\/\d+\.pbf/;

export async function openInstrumentedMap(page: Page) {
  await page.addInitScript(() => {
    performance.setResourceTimingBufferSize(5000);
    Object.assign(window, { recoveryRuntimeErrors: [] });
    window.addEventListener('error', (event) => {
      if (event.error) window.recoveryRuntimeErrors.push(event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
      window.recoveryRuntimeErrors.push(String(event.reason));
    });
  });
  await page.goto('./');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((entry) => entry.name)
      .find((name) => /\/maplibre-gl\.(?:mjs|js)\?/.test(name));
    if (!url) throw new Error('Loaded MapLibre module unavailable.');
    const library = await import(url);
    const prototype = (library.Map ?? library.default.Map).prototype;
    const fire = prototype.fire;
    Object.assign(window, { recoveryAudit: { map: null, maps: [], errors: [] } });
    prototype.fire = function (this: MapLibreMap, event: {
      type?: string; error?: { name?: string; message?: string; status?: number; url?: string };
      sourceId?: string; tile?: { state?: string; tileID?: { canonical?: unknown } };
    }, ...args: unknown[]) {
      if (this.getContainer()?.dataset.testid === 'map-canvas') {
        const audit = window.recoveryAudit;
        audit.map = this;
        if (!audit.maps.includes(this)) audit.maps.push(this);
        if (event.type === 'error') audit.errors.push({
          sourceId: event.sourceId, error: event.error ? {
            name: event.error.name, message: event.error.message,
            status: event.error.status, url: event.error.url,
          } : null, tile: event.tile?.tileID?.canonical, state: event.tile?.state,
        });
      }
      return fire.call(this, event, ...args);
    };
  });
  await page.locator('.maplibregl-canvas').hover({ position: { x: 5, y: 5 } });
  await expect.poll(() => page.evaluate(() => Boolean(window.recoveryAudit.map))).toBe(true);
}

export async function mapSnapshot(page: Page) {
  return page.evaluate(() => {
    const map = window.recoveryAudit.map!;
    const container = map.getContainer();
    return {
      center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(),
      selected: container.dataset.selectedLayer,
      geometry: container.dataset.mapLayerGeometry,
      order: container.dataset.mapLayerOrder,
      ready: container.dataset.mapReady,
      nativeLoaded: map.loaded(),
      rendererCount: window.recoveryAudit.maps.length,
      errors: window.recoveryAudit.errors,
    };
  });
}

export async function loseRenderer(page: Page) {
  await page.evaluate(() => {
    const extension = window.recoveryAudit.map!.getCanvas().getContext('webgl2')!.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('WebGL context-loss extension unavailable.');
    extension.loseContext();
  });
  await expect(page.getByRole('button', { name: 'Retry map' })).toBeEnabled();
  await expect(page.getByTestId('map-canvas')).not.toHaveAttribute('data-map-ready');
}

export async function downloadProject(page: Page) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Download project' }).click();
  const download = await downloading;
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Project download stream unavailable.');
  const contents = await buffer(stream);
  return JSON.parse(contents.toString('utf8'));
}

export async function revealRouteCoordinates(page: Page) {
  await expandToolSettings(page, 'route');
  const sources = page.locator('.route-point-sources');
  if (await sources.getAttribute('open') === null) await sources.locator('summary').click();
}

export async function addCoordinate(page: Page, tool: 'area' | 'route', longitude: string, latitude: string) {
  if (tool === 'route') await revealRouteCoordinates(page);
  await page.getByRole('textbox', { name: `New ${tool} point longitude` }).fill(longitude);
  await page.getByRole('textbox', { name: `New ${tool} point latitude` }).fill(latitude);
  await page.getByRole('button', { name: tool === 'area' ? 'Add area point' : 'Add coordinates', exact: true }).click();
  if (tool === 'route') await expect(page.getByRole('button', { name: 'Show route settings' })).toBeVisible();
}

const normalizeCameraPrecision = (value: number) => Number(value.toFixed(6));

export function normalizedViewport(viewport: { center: readonly number[]; zoom: number; bearing: number; pitch: number }) {
  return {
    center: viewport.center.map((coordinate) => normalizeCameraPrecision(coordinate)),
    zoom: normalizeCameraPrecision(viewport.zoom),
    bearing: normalizeCameraPrecision(viewport.bearing),
    pitch: normalizeCameraPrecision(viewport.pitch),
  };
}

export async function expectCoherentCamera(page: Page) {
  const native = await mapSnapshot(page);
  const document = await downloadProject(page);
  expect(normalizedViewport(native)).toEqual(normalizedViewport(document.camera));
  await expect(page.getByLabel('Bearing', { exact: true })).toHaveValue(String(document.camera.bearing));
  await expect(page.getByLabel('Pitch', { exact: true })).toHaveValue(String(document.camera.pitch));
  const scale = calculateMapScale(native.center[1], native.zoom);
  await expect(page.locator('.map-scale')).toHaveAttribute('aria-label', `Map scale: ${scale.label}`);
  await expect(page.locator('.map-scale')).toHaveAttribute('style', `width: ${Number(scale.widthPx.toFixed(2))}px;`);
  return { native, document, scale };
}

export async function loseAnimatingRenderer(page: Page) {
  return page.evaluate(async () => {
    const map = window.recoveryAudit.map!;
    const lost = new Promise<{ center: number[]; zoom: number; bearing: number; pitch: number }>((resolve) => {
      map.once('webglcontextlost', () => resolve({
        center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(),
      }));
    });
    map.easeTo({ center: [18.2, 49.1], zoom: 12.8, bearing: 40, pitch: 25, duration: 2000, essential: true });
    await new Promise((resolve) => { setTimeout(resolve, 350); });
    const extension = map.getCanvas().getContext('webgl2')!.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('WebGL context-loss extension unavailable.');
    extension.loseContext();
    return lost;
  });
}

export async function failNextWebGlProbe(page: Page) {
  await page.evaluate(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof getContext>) {
      if (args[0] === 'webgl2' && !this.isConnected) {
        HTMLCanvasElement.prototype.getContext = getContext;
        return null;
      }
      return Reflect.apply(getContext, this, args);
    } as typeof getContext;
  });
}
