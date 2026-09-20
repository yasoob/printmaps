/* eslint-disable unicorn/prefer-add-event-listener -- IndexedDB test reads use one-shot request handlers. */
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function localDraft(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('print-map-studio', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction('drafts', 'readonly').objectStore('drafts').get('current');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return JSON.stringify(record);
  });
}

async function saveLocalChange(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave ready');
  await page.getByRole('button', { name: 'Portrait' }).click();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
}

test('share snapshot is read-only, refresh/download/navigation preserve local autosave, and remix requires confirmation', async ({ page }) => {
  await saveLocalChange(page);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const link = await page.getByLabel('Read-only link').inputValue();
  await expect(page.getByLabel('Embed HTML')).toHaveValue(/<iframe .*width="100%"/);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Landscape' }).click();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  const saved = await localDraft(page);
  const requests: string[] = [];
  page.on('request', (request) => { requests.push(request.url()); });
  await page.goto(link);
  await expect(page.getByText('Read-only shared map', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Draw route', exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-interaction-mode', 'readonly');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const canvas = await page.locator('.maplibregl-canvas').boundingBox();
  expect(canvas).not.toBeNull();
  await page.mouse.move(canvas!.x + 100, canvas!.y + 100);
  await page.mouse.down();
  await page.mouse.move(canvas!.x + 180, canvas!.y + 130, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.keyboard.press('Delete');
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => localDraft(page)).toBe(saved);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Remix this map' })).toBeVisible();
  expect(await localDraft(page)).toBe(saved);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download project', exact: true }).click();
  const download = await downloadPromise;
  const downloaded = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(downloaded.page.orientation).toBe('portrait');
  expect(downloaded.camera.center).toEqual([16.3725, 48.2084]);
  expect(downloaded.camera.zoom).toBe(11.2);
  expect(requests.some((url) => url.includes('#share=') || url.includes('googletagmanager'))).toBe(false);

  await page.getByRole('button', { name: 'Remix this map' }).click();
  const dialog = page.getByRole('dialog', { name: 'Replace current project?' });
  await expect(dialog).toBeVisible();
  expect(await localDraft(page)).toBe(saved);
  const backupPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download current project' }).click();
  const backup = await backupPromise;
  const backupText = await readFile((await backup.path())!, 'utf8');
  expect(JSON.parse(backupText).page.orientation).toBe('landscape');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Landscape' })).toHaveAttribute('aria-pressed', 'true');
  expect(await localDraft(page)).toBe(saved);

  await page.goto(link);
  await page.getByRole('button', { name: 'Remix this map' }).click();
  await page.getByRole('button', { name: 'Replace project', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  expect(new URL(page.url()).hash).toBe('');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
});

test('malformed and oversized fragments never modify a local project', async ({ page }) => {
  await saveLocalChange(page);
  const saved = await localDraft(page);
  for (const hash of ['#share=broken', '#embed=v99.invalid', `#share=${'a'.repeat(65_537)}`]) {
    await page.goto(`./${hash}`);
    await expect(page.getByRole('heading', { name: 'This shared map could not be opened' })).toBeVisible();
    expect(await localDraft(page)).toBe(saved);
    await page.reload();
    expect(await localDraft(page)).toBe(saved);
  }
  await page.getByRole('link', { name: 'Open my local project' }).click();
  await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
});

test('embed renders at narrow iframe size with fixed navigation and attribution without autosave access', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const link = await page.getByLabel('Read-only link').inputValue();
  const payload = new URL(link).hash.slice('#share='.length);
  const errors: string[] = [];
  page.on('pageerror', (error) => { errors.push(error.message); });
  await page.addInitScript(() => {
    indexedDB.open = () => { throw new Error('Shared mode must not open IndexedDB'); };
  });
  await page.route('**/embed-host', async (route) => {
    await route.fulfill({ contentType: 'text/html', body: `<html><body><iframe title="Map preview" width="320" height="420" src="/editor/#embed=${payload}&navigation=0"></iframe></body></html>` });
  });
  await page.goto('../embed-host');
  const frame = page.frameLocator('iframe');
  await expect(frame.getByText('Read-only shared map', { exact: true })).toBeVisible();
  await expect(frame.getByTestId('map-canvas')).toHaveAttribute('data-map-area-locked', 'true');
  await expect(frame.getByRole('link', { name: 'Made with Print Map Studio' })).toBeVisible();
  await expect(frame.getByText(/OpenStreetMap contributors/, { exact: false }).last()).toBeVisible();
  await expect(frame.getByRole('link', { name: 'Open full map' })).toHaveAttribute('href', /#share=/);
  await expect(frame.getByRole('button', { name: 'Remix this map' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('shared schema-26 poster renders photo attachments and decorations from the same snapshot', async ({ page }) => {
  await page.goto('./');
  const text = await page.evaluate(async () => {
    const fixturePath = '/tests/fixtures/studio.ts';
    const { studioProject } = await import(/* @vite-ignore */ fixturePath);
    const project = studioProject();
    project.studio.terrain.enabled = false;
    project.studio.terrain.contours.enabled = false;
    project.studio.terrain.buildings.enabled = false;
    return JSON.stringify(project);
  });
  await page.locator('input[accept*=".printmap.json"]').setInputFiles({
    name: 'shared-poster.printmap.json', mimeType: 'application/json', buffer: Buffer.from(text),
  });
  await page.getByRole('button', { name: 'Replace project', exact: true }).click();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const link = await page.getByLabel('Read-only link').inputValue();
  await page.goto(link);
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const artwork = page.getByLabel('Poster artwork');
  await expect(artwork).toContainText('Display title, not the project title');
  await expect(artwork).toContainText('A caption');
  await expect(artwork).toContainText('A photo');
  await expect(artwork.locator('image')).toHaveCount(2);
  await expect(artwork.locator('image').first()).toHaveAttribute('href', /^data:image\/png;base64,/);
  await expect(artwork).toContainText('at map center');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download project', exact: true }).click();
  const download = await downloadPromise;
  const downloaded = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(downloaded).toEqual(JSON.parse(text));
});
