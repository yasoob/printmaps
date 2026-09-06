import { buffer } from 'node:stream/consumers';
import { expect, test, type Download, type Page } from '@playwright/test';
import type { ProjectDocument } from '../../src/domain/project';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave ready');
});

async function newProject(page: Page): Promise<ProjectDocument> {
  return page.evaluate(async () => {
    const modulePath = '/src/domain/project.ts';
    const { createNewProjectDocument } = await import(modulePath);
    return createNewProjectDocument();
  });
}

async function requestOpen(page: Page, document: ProjectDocument) {
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Open project', exact: true }).click();
  const chooser = await choosing;
  await chooser.setFiles({
    name: `${document.id}.printmap.json`, mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(document)),
  });
}

async function downloadedDocument(download: Download): Promise<ProjectDocument> {
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Project download stream unavailable');
  const contents = await buffer(stream);
  return JSON.parse(contents.toString('utf8'));
}

async function storedDocument(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('print-map-studio', 1);
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    try {
      return await new Promise<ProjectDocument | null>((resolve, reject) => {
        const request = database.transaction('drafts').objectStore('drafts').get('current');
        request.addEventListener('success', () => resolve(request.result?.document ?? null), { once: true });
        request.addEventListener('error', () => reject(request.error), { once: true });
      });
    } finally {
      database.close();
    }
  });
}

async function loadSavedDocument(page: Page, document: ProjectDocument) {
  await page.evaluate(async (saved) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('print-map-studio', 1);
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('drafts', 'readwrite');
        transaction.objectStore('drafts').put({
          recordVersion: 1, revision: 1, savedAt: new Date().toISOString(), document: saved,
        }, 'current');
        transaction.addEventListener('complete', () => resolve(), { once: true });
        transaction.addEventListener('error', () => reject(transaction.error), { once: true });
      });
    } finally {
      database.close();
    }
  }, document);
  await page.reload();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave ready');
}

test('backs up completed work without replacing it and requires deliberate consent to clear history', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Portrait', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  const original = await storedDocument(page);
  const next = { ...await newProject(page), title: 'Next map' };
  await requestOpen(page, next);
  const dialog = page.getByRole('dialog', { name: 'Replace current project?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await expect(dialog).toContainText('Vienna field guide');
  await expect(dialog).toContainText('Next map');
  const downloading = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download current project' }).click();
  const download = await downloading;
  await download.saveAs(testInfo.outputPath('ux-fix-025-current-project.printmap.json'));
  expect(await downloadedDocument(download)).toEqual(original);
  expect(await storedDocument(page)).toEqual(original);
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('ux-fix-025-backup-before-replacement.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Select Route 01' })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  expect(await storedDocument(page)).toEqual(original);
  await requestOpen(page, next);
  await dialog.getByRole('button', { name: 'Replace project', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next map', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeFocused();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Next map', exact: true })).toBeVisible();
  expect(await storedDocument(page)).toEqual(next);
});

test('a browser download failure retains the project and permits a retry or cancel', async ({ page }) => {
  await requestOpen(page, { ...await newProject(page), title: 'Next map' });
  await expect(page.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await page.evaluate(() => {
    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = () => {
      URL.createObjectURL = createObjectURL;
      throw new Error('Controlled browser download failure.');
    };
  });
  await page.getByRole('button', { name: 'Download current project' }).click();
  await expect(page.getByRole('alert')).toHaveText('Controlled browser download failure.');
  await expect(page.getByRole('dialog', { name: 'Replace current project?' })).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download current project' }).click();
  const downloaded = await downloadedDocument(await downloading);
  expect(downloaded.title).toBe('Vienna field guide');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('button', { name: 'Vienna field guide', exact: true })).toBeVisible();
});

test('protects a restored basemap-only design without undo history', async ({ page }, testInfo) => {
  const saved = await newProject(page);
  saved.camera.zoom = 14;
  saved.style.textScalePercent = 130;
  await loadSavedDocument(page, saved);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await requestOpen(page, { ...await newProject(page), title: 'Replacement' });
  await expect(page.getByRole('dialog', { name: 'Replace current project?' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('ux-fix-025-restored-design.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Keep editing' }).click();
  expect(await storedDocument(page)).toEqual(saved);
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Text scale' })).toHaveValue('130');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-zoom', '14');
});

test('does not interrupt first open over pristine defaults', async ({ page }) => {
  await loadSavedDocument(page, await newProject(page));
  await requestOpen(page, { ...await newProject(page), title: 'First map' });
  await expect(page.getByRole('button', { name: 'First map', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a late older file read cannot replace the latest pending choice', async ({ page }) => {
  await page.evaluate(() => {
    const read = File.prototype.text;
    File.prototype.text = async function (this: File) {
      if (this.name === 'older.printmap.json') {
        await new Promise<void>((resolve) => window.addEventListener('release-project-read', () => resolve(), { once: true }));
      }
      return read.call(this);
    };
  });
  await requestOpen(page, { ...await newProject(page), id: 'older', title: 'Older choice' });
  await requestOpen(page, { ...await newProject(page), id: 'newer', title: 'Newer choice' });
  const dialog = page.getByRole('dialog', { name: 'Replace current project?' });
  await expect(dialog).toContainText('Newer choice');
  await page.evaluate(() => window.dispatchEvent(new Event('release-project-read')));
  await dialog.getByRole('button', { name: 'Replace project', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Newer choice', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('replacement choices and safe keyboard focus fit a narrow viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await requestOpen(page, { ...await newProject(page), title: 'Next map' });
  const dialog = page.getByRole('dialog', { name: 'Replace current project?' });
  const keep = dialog.getByRole('button', { name: 'Keep editing' });
  await expect(keep).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Download current project' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Replace project', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Download current project' })).toBeFocused();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-025-mobile-choice.png'), animations: 'disabled' });
  await keep.click();
  await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeFocused();
});
