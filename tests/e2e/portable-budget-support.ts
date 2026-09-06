import { buffer } from 'node:stream/consumers';
import { expect, type Download, type Page, type TestInfo } from '@playwright/test';
import type { ProjectDocument } from '../../src/domain/project';

export async function portableFixture(page: Page, kind: 'full' | 'boundary' = 'full'): Promise<ProjectDocument> {
  return page.evaluate(async (mode) => {
    const path = '/tests/fixtures/portableBudget.ts';
    const fixture = await import(path);
    return mode === 'full' ? fixture.byteBudgetProject() : fixture.boundaryProject();
  }, kind);
}

export async function portableBoundarySource(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const path = '/tests/fixtures/portableBudget.ts';
    const fixture = await import(path);
    return fixture.largeBoundaryGeoJson();
  });
}

export async function portableDownload(download: Download, testInfo: TestInfo, name: string) {
  await download.saveAs(testInfo.outputPath(`ux-fix-029-${name}.printmap.json`));
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Portable download stream unavailable');
  const contents = await buffer(stream);
  return { bytes: contents.byteLength, text: contents.toString('utf8'), document: JSON.parse(contents.toString('utf8')) as ProjectDocument };
}

export async function downloadPortable(page: Page, testInfo: TestInfo, name: string) {
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Download project', exact: true }).click();
  return portableDownload(await waiting, testInfo, name);
}

export async function stagePortable(page: Page, document: ProjectDocument) {
  const waiting = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Open project', exact: true }).click();
  const chooser = await waiting;
  await chooser.setFiles({ name: 'portable.printmap.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) });
  return page.getByRole('dialog', { name: 'Replace current project?' });
}

export async function openPortable(page: Page, document: ProjectDocument) {
  const dialog = await stagePortable(page, document);
  await dialog.getByRole('button', { name: 'Replace project', exact: true }).click();
  await expect(page.locator('[aria-label="Autosave status"]')).toHaveText('All changes saved locally', { timeout: 30_000 });
}

export async function importSingleGeoJson(page: Page, value: unknown) {
  const waiting = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Import map data', exact: true }).click();
  const chooser = await waiting;
  await chooser.setFiles({ name: 'boundaries.geojson', mimeType: 'application/geo+json', buffer: Buffer.from(JSON.stringify(value)) });
  await page.getByRole('dialog', { name: 'Import map data' }).getByRole('button', { name: 'Import 1 file', exact: true }).click();
}

export async function stageGeoJson(page: Page, value: unknown) {
  const waiting = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Import map data', exact: true }).click();
  const chooser = await waiting;
  const contents = Buffer.from(JSON.stringify(value));
  await chooser.setFiles(['boundaries.geojson', 'additional.geojson'].map((name) => ({ name, mimeType: 'application/geo+json', buffer: contents })));
  const dialog = page.getByRole('dialog', { name: 'Import map data' });
  await expect(dialog.getByRole('button', { name: 'Import 2 files' })).toBeEnabled();
  await dialog.getByRole('radio', { name: 'Keep current view' }).check();
  return dialog;
}

export async function assertFreshPortable(page: Page, text: string) {
  return page.evaluate(async (contents) => {
    const path = '/src/domain/projectFile.ts';
    const { parseProjectFileText } = await import(path);
    const parsed = parseProjectFileText(contents);
    return { title: parsed.title, layers: parsed.layers.length };
  }, text);
}

export async function assertUnobstructedSearch(page: Page) {
  const search = page.getByRole('combobox', { name: 'Search places and addresses' });
  await search.click();
  await expect(search).toBeFocused();
}

export async function portableCameraSnapshot(page: Page) {
  return page.evaluate(() => {
    const map = window.recoveryAudit.map!;
    return {
      center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(),
      rendererCount: window.recoveryAudit.maps.length,
    };
  });
}

export async function loseOversizedCameraMove(page: Page) {
  return page.evaluate(async () => {
    const map = window.recoveryAudit.map!;
    const extension = map.getCanvas().getContext('webgl2')!.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Context loss extension unavailable');
    const zoom = Number(map.getZoom().toFixed(6));
    const lost = new Promise<{ center: number[]; zoom: number; bearing: number; pitch: number }>((resolve) => {
      map.once('webglcontextlost', () => resolve({
        center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(),
      }));
    });
    const onMove = () => {
      if (Number(map.getZoom().toFixed(6)) === zoom) return;
      map.off('move', onMove);
      extension.loseContext();
    };
    map.on('move', onMove);
    map.easeTo({ center: [16.123456, 48.123456], zoom: 13.123456, bearing: 30, pitch: 20, duration: 60_000, essential: true });
    return lost;
  });
}
