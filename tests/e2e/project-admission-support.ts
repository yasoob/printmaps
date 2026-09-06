import { buffer } from 'node:stream/consumers';
import { expect, type Page, type TestInfo } from '@playwright/test';
import type { ProjectDocument } from '../../src/domain/project';

export async function admissionFixture(page: Page, mode: 'empty' | 'layers' | 'positions' = 'empty'): Promise<ProjectDocument> {
  return page.evaluate(async (kind) => {
    const projectPath = '/src/domain/project.ts';
    const arcPath = '/src/domain/routeArcGeometry.ts';
    const { createNewProjectDocument, createDefaultLayerAppearance, createDefaultRouteAppearance } = await import(projectPath);
    const document = createNewProjectDocument();
    const poi = (index: number) => ({
      id: `existing-${index}`, name: `Existing ${index}`, type: 'poi', visible: true, locked: false, opacity: 100,
      appearance: createDefaultLayerAppearance('poi'), geometry: { type: 'Point', coordinates: [0, 0] },
    });
    if (kind === 'layers') document.layers.unshift(...Array.from({ length: 999 }, (_, index) => poi(index)));
    else if (kind === 'positions') {
      const { createArcGeometry } = await import(arcPath);
      document.camera = { ...document.camera, center: [16.375, 48.215], zoom: 13 };
      document.layers.unshift({
        id: 'budget-arc', name: 'Budget Arc', type: 'route', visible: false, locked: false, opacity: 100,
        route: { kind: 'arc', closed: false }, appearance: createDefaultRouteAppearance(8332),
        geometry: createArcGeometry(Array.from({ length: 8333 }, (_, index) => [index / 1000, 48])),
      }, {
        id: 'editable-area', name: 'Editable area', type: 'shape', visible: true, locked: false, opacity: 100,
        appearance: createDefaultLayerAppearance('shape'),
        geometry: { type: 'Polygon', coordinates: [[[16.37, 48.21], [16.38, 48.21], [16.38, 48.22], [16.37, 48.21]]] },
      }, ...Array.from({ length: 27 }, (_, index) => poi(index)));
    }
    return document;
  }, mode);
}

export async function openAdmissionProject(page: Page, document: ProjectDocument) {
  if (await page.locator('.layer-row').count() === 1) {
    await page.getByRole('button', { name: 'Portrait', exact: true }).click();
  }
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Open project', exact: true }).click();
  const chooser = await choosing;
  await chooser.setFiles({ name: 'admission.printmap.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) });
  await page.getByRole('button', { name: 'Replace project', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
}

export async function savedAdmissionRecord(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('print-map-studio', 1);
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    try {
      return await new Promise<{ document: ProjectDocument; revision: number }>((resolve, reject) => {
        const request = database.transaction('drafts').objectStore('drafts').get('current');
        request.addEventListener('success', () => resolve(request.result), { once: true });
        request.addEventListener('error', () => reject(request.error), { once: true });
      });
    } finally { database.close(); }
  });
}

export async function downloadAdmissionProject(page: Page, testInfo: TestInfo, name: string): Promise<ProjectDocument> {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Download project', exact: true }).click();
  const download = await downloading;
  await download.saveAs(testInfo.outputPath(`ux-fix-026-${name}.printmap.json`));
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Project download stream unavailable');
  const bytes = await buffer(stream);
  const text = bytes.toString('utf8');
  return page.evaluate(async (contents) => {
    const path = '/src/domain/projectFile.ts';
    const parser = await import(path);
    return parser.parseProjectFileText(contents);
  }, text);
}
