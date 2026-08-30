import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { waitForAutosaveReady } from './autosave-fixture';

const isExpectedWebGlDiagnostic = (message: string, browserName: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
  || (browserName === 'firefox' && message.includes('WebGL context was lost.'))
);

test('chooses original map presets through the responsive thumbnail gallery', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isExpectedWebGlDiagnostic(message.text(), testInfo.project.name)) {
      consoleProblems.push(message.text());
    }
  });

  await page.goto('./');
  await waitForAutosaveReady(page);
  const map = page.getByTestId('map-canvas');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const gallery = page.getByRole('radiogroup', { name: 'Map style presets' });
  await expect(gallery.getByRole('radio')).toHaveCount(12);
  await expect(gallery.getByRole('radio', { name: /^Paper:/ })).toHaveAttribute('aria-checked', 'true');
  expect(await gallery.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(3);

  const thumbnailMetrics = await gallery.locator('img').evaluateAll((images) => images.map((element) => {
    const image = element as HTMLImageElement;
    return { complete: image.complete, height: image.naturalHeight, width: image.naturalWidth };
  }));
  expect(thumbnailMetrics).toEqual(Array.from({ length: 12 }, () => ({ complete: true, height: 144, width: 216 })));

  const nightInk = gallery.getByRole('radio', { name: /^Night Ink:/ });
  const blueprint = gallery.getByRole('radio', { name: /^Blueprint:/ });
  await nightInk.focus();
  await nightInk.press('ArrowRight');
  await expect(blueprint).toBeFocused();
  await expect(map).toHaveAttribute('data-style-preset', 'paper');
  await blueprint.press('Enter');
  await expect(map).toHaveAttribute('data-style-preset', 'blueprint');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Select Blueprint basemap' })).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(map).toHaveAttribute('data-style-preset', 'paper');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await nightInk.click();
  await expect(map).toHaveAttribute('data-style-preset', 'night-ink');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });

  const projectDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Download project' }).click();
  const projectDownload = await projectDownloadPromise;
  const projectPath = await projectDownload.path();
  expect(projectPath).not.toBeNull();
  const project = JSON.parse(await readFile(projectPath!, 'utf8'));
  expect(project).toMatchObject({ schemaVersion: 24, style: { preset: 'night-ink' } });

  await page.getByRole('button', { name: 'Export' }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export map' });
  await exportDialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const svgDownloadPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const svgDownload = await svgDownloadPromise;
  const svgPath = await svgDownload.path();
  expect(svgPath).not.toBeNull();
  expect(await readFile(svgPath!, 'utf8')).toContain('data-layer-name="Night Ink basemap"');
  await exportDialog.getByRole('button', { name: 'Cancel' }).click();
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'docs/screenshots/latest-desktop.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open properties' }).click();
  const propertiesDialog = page.getByRole('dialog', { name: 'Properties sidebar' });
  await expect(propertiesDialog).toHaveAttribute('aria-modal', 'true');
  expect(await gallery.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(2);
  expect(await page.evaluate(() => document.body.scrollWidth - innerWidth)).toBe(0);
  expect(await propertiesDialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0);
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'docs/screenshots/latest-mobile.png' });
  expect(consoleProblems).toEqual([]);
});
