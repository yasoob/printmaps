import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { markerParityProject, openProject } from './advanced-route-test-support';
import { downloadProject, mapSnapshot, openInstrumentedMap } from './map-recovery-support';

declare global {
  interface Window {
    exportLifecycleEvents: { event: string; ready: boolean; loaded: boolean; time: number }[];
    exportRestoreHeld: boolean;
    releaseExportRestoration: () => void;
  }
}

async function observeExportLifecycle(page: Page) {
  await page.evaluate(() => {
    Object.assign(window, { exportLifecycleEvents: [] });
    const map = window.recoveryAudit.map!;
    for (const event of ['dataloading', 'render', 'idle', 'error'] as const) {
      map.on(event, () => {
        window.exportLifecycleEvents.push({
          event, ready: map.getContainer().dataset.mapReady === 'true',
          loaded: map.loaded(), time: performance.now(),
        });
      });
    }
  });
}

async function waitForDownload(page: Page) {
  try {
    return await page.waitForEvent('download');
  } catch {
    return null;
  }
}

async function exportFile(page: Page, testInfo: TestInfo, format: 'Layered SVG' | 'PDF' | 'Layered PSD') {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('radio', { name: new RegExp(format) }).click();
  const downloading = waitForDownload(page);
  await dialog.getByRole('button', { name: `Download ${format === 'PDF' ? format : format.replace('Layered', 'layered')}`, exact: true }).click();
  await expect(dialog.getByRole('status', { name: 'Export status' })).toContainText(/Download started|Export failed/, { timeout: 60_000 });
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  const download = await downloading;
  if (!download) throw new Error('The export did not produce a download.');
  const extension = format === 'PDF' ? 'pdf' : (format === 'Layered PSD' ? 'psd' : 'svg');
  const path = testInfo.outputPath(`ux-fix-024-export-restored.${extension}`);
  await download.saveAs(path);
  await dialog.getByRole('button', { name: 'Close export' }).click();
  return readFile(path);
}

async function holdRestorationIdle(page: Page) {
  await page.evaluate(() => {
    const map = window.recoveryAudit.map!;
    const setLayout = map.setLayoutProperty;
    const fire = map.fire;
    let heldIdle: Parameters<typeof fire> | undefined;
    Object.assign(window, { exportRestoreHeld: false });
    map.setLayoutProperty = function (this: MapLibreMap, ...args: Parameters<typeof setLayout>) {
      if (args[0].startsWith('studio-layer-') && args[1] === 'visibility' && args[2] === 'visible') {
        Object.assign(window, { exportRestoreHeld: true });
      }
      return Reflect.apply(setLayout, this, args);
    } as typeof setLayout;
    map.fire = function (this: MapLibreMap, ...args: Parameters<typeof fire>) {
      const event = args[0] as string | { type: string };
      if (typeof event !== 'string' && window.exportRestoreHeld && event.type === 'idle') {
        heldIdle = args;
        return this;
      }
      return Reflect.apply(fire, this, args);
    } as typeof fire;
    Object.assign(window, {
      releaseExportRestoration: () => {
        map.setLayoutProperty = setLayout;
        map.fire = fire;
        Object.assign(window, { exportRestoreHeld: false });
        if (heldIdle) Reflect.apply(fire, map, heldIdle);
      },
    });
  });
}

test.afterEach(async ({ page }, testInfo) => {
  const evidence = await page.evaluate(() => ({
    errors: window.recoveryRuntimeErrors ?? [], events: window.exportLifecycleEvents ?? [],
  }));
  await writeFile(testInfo.outputPath('ux-fix-024-export-lifecycle.json'), JSON.stringify(evidence, null, 2));
  expect(evidence.errors).toEqual([]);
});

for (const format of ['PDF', 'Layered PSD'] as const) {
  test(`restores the live source before ${format} native rendering after SVG export`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await openInstrumentedMap(page);
    await openProject(page, markerParityProject());
    await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true');
    const document = await downloadProject(page);
    const before = await mapSnapshot(page);
    await observeExportLifecycle(page);
    const svg = await exportFile(page, testInfo, 'Layered SVG');
    expect(svg.toString('utf8')).toContain('data-route-pictogram="air"');
    const exported = await exportFile(page, testInfo, format);
    expect(exported.toString('latin1').slice(0, 4)).toBe(format === 'PDF' ? '%PDF' : '8BPS');
    await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true');
    const after = await mapSnapshot(page);
    expect(after).toMatchObject({
      center: before.center, zoom: before.zoom, geometry: before.geometry, rendererCount: before.rendererCount,
    });
    expect(await downloadProject(page)).toEqual(document);
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath('ux-fix-024-export-restored.png') });
  });
}

test('cancellation waits for restored readiness without downloading an isolated frame', async ({ page }, testInfo) => {
  await openInstrumentedMap(page);
  const document = await downloadProject(page);
  await observeExportLifecycle(page);
  await holdRestorationIdle(page);
  let downloads = 0;
  page.on('download', () => { downloads += 1; });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('radio', { name: /Layered SVG/ }).click();
  await page.getByRole('button', { name: 'Download layered SVG' }).click();
  await expect.poll(() => page.evaluate(() => window.exportRestoreHeld && window.recoveryAudit.map!.loaded())).toBe(true);
  await expect(page.getByTestId('map-canvas')).not.toHaveAttribute('data-map-ready');
  await expect(page.getByRole('button', { name: 'Preparing…', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel export', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Export status' })).toHaveText('Cancelling export…');
  await page.screenshot({ path: testInfo.outputPath('ux-fix-024-export-restoration-held.png') });
  await page.evaluate(() => window.releaseExportRestoration());
  await expect(page.getByRole('status', { name: 'Export status' })).toHaveText('Export cancelled.');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true');
  expect(downloads).toBe(0);
  await page.getByRole('button', { name: 'Close export' }).click();
  expect(await downloadProject(page)).toEqual(document);
});

test('context loss while exporting stays actionable and recovery does not revive the failed job', async ({ page }, testInfo) => {
  await openInstrumentedMap(page);
  const document = await downloadProject(page);
  const before = await mapSnapshot(page);
  await observeExportLifecycle(page);
  let downloads = 0;
  page.on('download', () => { downloads += 1; });
  await page.evaluate(() => {
    const map = window.recoveryAudit.map!;
    map.once('dataloading', () => {
      const extension = map.getCanvas().getContext('webgl2')!.getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('WebGL context-loss extension unavailable.');
      extension.loseContext();
    });
  });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('radio', { name: /PDF/ }).click();
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Export status' })).toContainText('retry the map');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Close export' }).click();
  await page.getByRole('button', { name: 'Retry map' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const after = await mapSnapshot(page);
  expect(after).toMatchObject({ center: before.center, zoom: before.zoom, geometry: before.geometry, rendererCount: 2 });
  expect(downloads).toBe(0);
  expect(await downloadProject(page)).toEqual(document);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-024-export-context-recovered.png') });
});
