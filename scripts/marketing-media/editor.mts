import { readFile } from 'node:fs/promises';
import { firefox, type Browser, type Page } from 'playwright';

export const BASE_URL = process.env.MEDIA_BASE_URL ?? 'http://127.0.0.1:4480';

export type Viewport = { width: number; height: number };

export async function launchBrowser(): Promise<Browser> {
  return firefox.launch({ headless: process.env.MEDIA_HEADED !== '1' });
}

export async function newEditorPage(browser: Browser, viewport: Viewport = { width: 1440, height: 900 }): Promise<Page> {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: 'reduce', locale: 'en-GB' });
  const page = await context.newPage();
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
