import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const isHeadlessWebGlDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
);

test('Greek first-order catalogue creates a durable area with print parity', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isHeadlessWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('combobox', { name: 'Administrative level' }).selectOption('region');
  await page.getByRole('combobox', { name: 'Region country' }).selectOption('GRC');
  const regions = page.getByRole('group', { name: 'Greece regions' });
  await expect(regions.getByRole('checkbox')).toHaveCount(14);
  await expect(regions.getByRole('checkbox', { name: 'Mount Athos' })).toBeVisible();
  await expect(regions.getByRole('checkbox', { name: 'Crete' })).toBeVisible();
  await regions.getByRole('checkbox', { name: 'Attica' }).check();
  await page.getByRole('button', { name: 'Add selected area' }).click();
  await expect(page.getByRole('button', { name: 'Select Attica' })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', /admin-gr-a1:/);
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/greece-region-catalogue-20260826.png' });
  }

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Download project' }).click();
  const save = await savePromise;
  const savePath = testInfo.outputPath('greece-region.printmap.json');
  await save.saveAs(savePath);
  const savedProject = JSON.parse(await readFile(savePath, 'utf8'));
  const region = savedProject.layers.find(({ id }: { id: string }) => id === 'admin-gr-a1');
  expect(savedProject.schemaVersion).toBe(21);
  expect(region).toMatchObject({ name: 'Attica', geometry: { type: 'MultiPolygon' } });
  expect(region.geometry.coordinates).toHaveLength(11);

  await page.getByRole('button', { name: 'Export' }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export map' });
  await exportDialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const svgPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const svgDownload = await svgPromise;
  const svgPath = testInfo.outputPath('greece-region.layered.svg');
  await svgDownload.saveAs(svgPath);
  const svg = await readFile(svgPath, 'utf8');
  const atticaGroup = svg.match(/<g[^>]*data-layer-name="Attica"[^>]*>.*?<\/g>/)?.[0];
  expect(atticaGroup).toContain('data-layer-name="Attica"');
  expect((atticaGroup?.match(/\bM /g) ?? []).length).toBeGreaterThanOrEqual(11);
  expect(consoleProblems).toEqual([]);
});
