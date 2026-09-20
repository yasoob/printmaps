import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function downloadedProject(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Download project', exact: true }).click();
  const download = await pending;
  const path = await download.path();
  if (!path) throw new Error('The project download did not produce a file.');
  return readFile(path, 'utf8');
}

test('canonical poster artwork follows the editor print frame and survives mobile resize and project download', async ({ page }) => {
  await page.goto('./');
  const project = await page.evaluate(async () => {
    const modulePath = '/tests/fixtures/studio.ts';
    const { studioProject } = await import(modulePath) as typeof import('../fixtures/studio');
    const document = studioProject();
    document.studio.terrain.enabled = false;
    document.studio.terrain.contours.enabled = false;
    document.studio.terrain.buildings.enabled = false;
    return document;
  });
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Open project', exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'studio.printmap.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.getByRole('button', { name: 'Replace project', exact: true }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 30_000 });
  const artwork = page.getByLabel('Poster artwork', { exact: true });
  await expect(artwork.getByText(project.studio.poster.title.text, { exact: true })).toBeVisible();
  await expect(artwork.locator('image')).toHaveCount(2);
  await expect(artwork.locator('svg')).toBeVisible();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => {
      const [frame, overlay] = await Promise.all([
        page.locator('.print-frame').boundingBox(),
        artwork.boundingBox(),
      ]);
      if (!frame || !overlay) return Infinity;
      return Math.max(Math.abs(frame.x - overlay.x), Math.abs(frame.y - overlay.y),
        Math.abs(frame.width - overlay.width), Math.abs(frame.height - overlay.height));
    }).toBeLessThan(1);
    await expect(page.locator('.studio-poster-preview-error')).toHaveCount(0);
  }
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Download project', exact: true }).click();
  const download = await downloadPromise;
  const savedPath = await download.path();
  expect(savedPath).not.toBeNull();
  if (!savedPath) throw new Error('The project download did not produce a file.');
  const saved = JSON.parse(await readFile(savedPath, 'utf8'));
  expect(saved.studio).toEqual(project.studio);
  expect(saved.layers).toEqual(project.layers);
});

test('real editor controls create a photo poster, keep wall preview ephemeral, and expose mobile video settings', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.goto('./');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 30_000 });
  const panel = page.getByRole('region', { name: 'Poster composition' });
  await panel.getByText('Templates & starter gallery', { exact: true }).click();
  await panel.getByRole('button', { name: /^City edition/ }).click();
  await panel.getByText('Poster typography & paper', { exact: true }).click();
  await panel.getByLabel('Title text', { exact: true }).fill('Vienna memory');
  await expect(page.getByLabel('Poster artwork').getByText('Vienna memory', { exact: true })).toBeVisible();
  await panel.getByText('Photo story', { exact: true }).click();
  await panel.getByLabel('Attach photo to').selectOption('poi-cafe');
  const photo = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 32;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo fixture canvas is unavailable.');
    context.fillStyle = '#ff0000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png').split(',', 2)[1];
  });
  await panel.getByLabel('Upload story photo').setInputFiles({
    name: 'memory.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64'),
  });
  await expect(page.getByLabel('Poster artwork').locator('image')).toHaveCount(1);
  const beforeWall = await downloadedProject(page);
  await panel.getByRole('button', { name: 'Preview on a wall' }).click();
  const wall = page.getByRole('dialog');
  await expect(wall.locator('.studio-wall-scene img')).toBeVisible();
  await expect.poll(() => wall.locator('.studio-wall-scene img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('integrated-wall-preview.png') });
  await page.keyboard.press('Escape');
  await expect(wall).toHaveCount(0);
  expect(await downloadedProject(page)).toBe(beforeWall);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open properties' }).click();
  await page.getByRole('button', { name: 'Map video', exact: true }).click();
  await page.getByRole('button', { name: 'Export map video' }).click();
  const video = page.getByRole('dialog', { name: 'Export map video' });
  await expect(video).toBeVisible();
  await video.getByLabel('Duration').selectOption('15');
  await expect(video.getByLabel('Duration')).toHaveValue('15');
  const panelZ = await page.locator('.right-sidebar').evaluate((element) => Number(getComputedStyle(element).zIndex));
  const dialogZ = await video.evaluate((element) => Number(getComputedStyle(element).zIndex));
  expect(dialogZ).toBeGreaterThan(panelZ);
  await page.screenshot({ path: testInfo.outputPath('integrated-video-mobile.png') });
  await page.keyboard.press('Escape');
  await expect(video).toHaveCount(0);
});
