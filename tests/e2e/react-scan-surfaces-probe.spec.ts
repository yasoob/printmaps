import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { attachInventory, expectOwners, finishProbe, openScanEditor, startProbe, waitForRenderQuiet } from './react-scan-helpers';

test.skip(process.env.VITE_REACT_SCAN !== 'true', 'Run with npm run audit:renders.');
test.afterEach(async ({ page }, info) => attachInventory(page, info));

async function helpProbe(page: Page, info: TestInfo, label: string, { owner, isTouch }: { owner: string; isTouch: boolean }) {
  const button = page.getByRole('button', { name: label, exact: true });
  await button.scrollIntoViewIfNeeded();
  await startProbe(page, label);
  if (isTouch) await button.tap();
  else await button.hover();
  await expect(page.locator('[role="tooltip"][data-open]')).toBeVisible();
  const result = await finishProbe(page, info, label);
  expectOwners(result, ['FeatureHelp'], [
    owner, 'MapCanvas', 'CanvasWorkspace', 'StudioCompositionControls', 'StudioTerrainControls', 'StudioVideoControls', 'StudioApp',
  ]);
  expect(result.domMutations).toEqual([]);
  expect(result.mapMutations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="tooltip"][data-open]')).toHaveCount(0);
}

for (const touch of [false, true]) {
  test.describe(touch ? 'touch help isolation' : 'hover help isolation', () => {
    test.use(touch ? { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } } : {});
    test('export video relief wall and share help do not rerender owners', async ({ page }, info) => {
      test.setTimeout(90_000);
      await openScanEditor(page);
      await page.getByRole('button', { name: 'Export', exact: true }).click();
      let dialog = page.getByRole('dialog', { name: 'Export map', exact: true });
      await dialog.getByRole('radio', { name: /Layered SVG/ }).click();
      await helpProbe(page, info, 'Basemap rendering help', { owner: 'ExportDialog', isTouch: touch });
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      if (touch) await page.getByRole('button', { name: 'Open properties' }).tap();
      await page.getByRole('button', { name: 'Map video', exact: true }).click();
      await page.getByRole('button', { name: 'Export map video', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Export map video', exact: true });
      await helpProbe(page, info, 'Video recording help', { owner: 'VideoExportDialog', isTouch: touch });
      await helpProbe(page, info, 'Video aspect help', { owner: 'VideoExportSettings', isTouch: touch });
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Terrain & 3D relief', exact: true }).click();
      await page.getByRole('button', { name: 'Export 3D terrain STL', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Export 3D terrain relief' });
      await helpProbe(page, info, 'Terrain STL help', { owner: 'ReliefExportDialog', isTouch: touch });
      await helpProbe(page, info, 'Elevation data and credits', { owner: 'ReliefExportDialog', isTouch: touch });
      await startProbe(page, 'Relief dimensions');
      await dialog.getByRole('button', { name: 'Fit dimensions to print frame', exact: true }).click();
      await expect(dialog.getByRole('status')).toContainText('Dimensions match');
      const fit = await finishProbe(page, info, 'relief-settings');
      expectOwners(fit, ['ReliefExportDialog', 'ReliefSettingsControls'], ['MapCanvas', 'StudioCompositionControls', 'StudioPosterPreview', 'StudioVideoControls']);
      expect(fit.mapMutations).toEqual([]);
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Preview on a wall', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'On your wall' });
      await expect(dialog.locator('.studio-wall-scene img')).toBeVisible();
      await helpProbe(page, info, 'Wall preview help', { owner: 'WallPreviewDialog', isTouch: touch });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      if (touch) await page.getByRole('button', { name: 'Close properties' }).tap();
      await page.getByRole('button', { name: 'Share', exact: true }).click();
      await helpProbe(page, info, 'Share snapshot help', { owner: 'ShareDialog', isTouch: touch });
      await helpProbe(page, info, 'Share privacy help', { owner: 'ShareDialog', isTouch: touch });
      await helpProbe(page, info, 'Embed preview help', { owner: 'ShareDialog', isTouch: touch });
    });
  });
}

test('country silhouette picker and atomic application mount real lazy controls', async ({ page }, info) => {
  test.setTimeout(60_000);
  await openScanEditor(page);
  await page.getByText('Country & region silhouette', { exact: true }).click();
  await startProbe(page, 'Country picker open');
  await page.getByRole('button', { name: 'Choose country or region', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Country', exact: true })).toBeVisible();
  let result = await finishProbe(page, info, 'silhouette-picker');
  expectOwners(result, ['AdministrativeAreaPicker'], ['MapCanvas', 'PosterControls', 'PhotoStoryControls', 'DecorationControls']);
  await page.getByRole('combobox', { name: 'Country', exact: true }).fill('Austria');
  await page.getByRole('option', { name: 'Austria Country', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add area', exact: true })).toBeEnabled();
  await startProbe(page, 'Apply country silhouette');
  await page.getByRole('button', { name: 'Add area', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select Austria silhouette', exact: true })).toBeVisible();
  await expect(page.getByLabel('Poster artwork')).toBeVisible();
  await waitForRenderQuiet(page);
  result = await finishProbe(page, info, 'silhouette-application');
  expectOwners(result, ['MapCanvas', 'StudioPosterPreview'], ['StudioVideoControls']);
  expect(result.mapMutations.some(({ operation, target }) => operation === 'addSource' && target?.includes('silhouette'))).toBe(true);
});

test('real video recording progress leaves the live map camera and renderer untouched', async ({ page }, info) => {
  test.setTimeout(60_000);
  await page.route('**/styles/*.json', (route) => route.fulfill({ json: {
    version: 8, sources: { fixture: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: 'Render audit fixture' } },
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f3eee3' } }, { id: 'fixture', type: 'circle', source: 'fixture' }],
  } }));
  await openScanEditor(page);
  await page.getByRole('button', { name: 'Map video', exact: true }).click();
  await page.getByRole('button', { name: 'Export map video', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map video' });
  await dialog.getByLabel('Duration', { exact: true }).selectOption('5');
  const originalCamera = await page.evaluate(() => globalThis.window.__PRINT_MAP_REACT_SCAN__?.cameras.find(({ surface }) => surface === 'editor'));
  const history = await page.locator('button[aria-label="Undo"]').isEnabled();
  await startProbe(page, 'Video recording progress');
  const downloaded = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download MP4', exact: true }).click();
  await downloaded;
  const result = await finishProbe(page, info, 'video-progress');
  expectOwners(result, ['VideoExportSession', 'VideoExportMessages'], ['StudioCanvas', 'MapCanvas', 'StudioPosterPreview', 'HistoryActions', 'StudioCompositionControls']);
  expect(result.components.VideoExportSettings?.callbacks).toBe(2);
  expect(result.components.VideoExportActions?.callbacks).toBe(2);
  expect(result.components.FeatureHelp?.callbacks ?? 0).toBeLessThanOrEqual(2);
  expect(result.mapMutations.filter(({ surface }) => surface === 'editor')).toEqual([]);
  expect(result.mapMutations.some(({ operation, surface }) => operation === 'jumpTo' && surface === 'video')).toBe(true);
  expect(await page.evaluate(() => globalThis.window.__PRINT_MAP_REACT_SCAN__?.cameras.find(({ surface }) => surface === 'editor'))).toEqual(originalCamera);
  expect(await page.locator('button[aria-label="Undo"]').isEnabled()).toBe(history);
});
