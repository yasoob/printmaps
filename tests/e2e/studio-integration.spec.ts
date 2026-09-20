import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

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
