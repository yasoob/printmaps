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
    owner, 'ExportWorkspace', 'ExportWorkspaceContent', 'VideoWorkspacePanel', 'ReliefWorkspacePanel', 'WallWorkspacePanel',
    'MapCanvas', 'CanvasWorkspace', 'StudioCompositionControls', 'StudioTerrainControls', 'StudioVideoControls', 'StudioApp',
  ]);
  expect(result.domMutations).toEqual([]);
  expect(result.mapMutations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="tooltip"][data-open]')).toHaveCount(0);
}

for (const touch of [false, true]) {
  test.describe(touch ? 'touch help isolation' : 'hover help isolation', () => {
    test.use(touch ? { hasTouch: true, viewport: { width: 390, height: 844 } } : {});
    test('export video relief wall and share help do not rerender owners', async ({ page }, info) => {
      test.setTimeout(90_000);
      await openScanEditor(page);
      await page.getByRole('button', { name: 'Export', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Export map', exact: true });
      await expect(dialog.getByRole('img', { name: 'Preview of your poster' })).toBeVisible({ timeout: 20_000 });
      await dialog.getByRole('radio', { name: /Layered SVG/ }).click();
      await helpProbe(page, info, 'Basemap rendering help', { owner: 'ExportDialog', isTouch: touch });
      await dialog.getByRole('tab', { name: 'Video', exact: true }).click();
      await helpProbe(page, info, 'Video recording help', { owner: 'VideoExportSession', isTouch: touch });
      await helpProbe(page, info, 'Video aspect help', { owner: 'VideoExportSettings', isTouch: touch });
      await dialog.getByRole('tab', { name: '3D model', exact: true }).click();
      await helpProbe(page, info, 'Terrain STL help', { owner: 'ReliefExportPanel', isTouch: touch });
      await startProbe(page, 'Relief dimensions');
      await dialog.getByRole('button', { name: 'Fit dimensions to print frame', exact: true }).click();
      await expect(dialog.getByRole('status')).toContainText('Dimensions match');
      const fit = await finishProbe(page, info, 'relief-settings');
      expectOwners(fit, ['ReliefExportPanel', 'ReliefSettingsControls'], ['MapCanvas', 'StudioCompositionControls', 'StudioPosterPreview', 'StudioVideoControls']);
      expect(fit.mapMutations).toEqual([]);
      await dialog.getByRole('tab', { name: 'Print', exact: true }).click();
      await dialog.getByRole('button', { name: 'Preview on wall', exact: true }).click();
      await expect(dialog.locator('.studio-wall-scene img')).toBeVisible();
      await helpProbe(page, info, 'Wall preview help', { owner: 'WallPreviewPanel', isTouch: touch });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
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
  await page.getByRole('tab', { name: 'Layout' }).click();
  await page.getByRole('button', { name: 'Map frame', exact: true }).click();
  await startProbe(page, 'Country picker open');
  await page.getByRole('radio', { name: 'Country / region', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Country', exact: true })).toBeVisible();
  let result = await finishProbe(page, info, 'silhouette-picker');
  expectOwners(result, ['AdministrativeAreaPicker'], ['MapCanvas', 'PosterControls', 'PhotoStoryControls', 'DecorationControls']);
  await page.getByRole('combobox', { name: 'Country', exact: true }).fill('Austria');
  await page.getByRole('option', { name: 'Austria Country', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add area', exact: true })).toBeEnabled();
  await startProbe(page, 'Apply country silhouette');
  await page.getByRole('button', { name: 'Add area', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select Austria silhouette', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('radio', { name: 'Rectangle', exact: true })).toBeVisible();
  await waitForRenderQuiet(page);
  result = await finishProbe(page, info, 'silhouette-application');
  expectOwners(result, ['MapCanvas', 'StudioCompositionControls'], ['StudioVideoControls']);
  expect(result.mapMutations.some(({ operation, target }) => operation === 'addSource' && target?.includes('silhouette'))).toBe(true);
});

test('real video recording progress leaves the live map camera and renderer untouched', async ({ page }, info) => {
  test.setTimeout(60_000);
  await page.route('**/styles/*.json', (route) => route.fulfill({ json: {
    version: 8, sources: { fixture: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: 'Render audit fixture' } },
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f3eee3' } }, { id: 'fixture', type: 'circle', source: 'fixture' }],
  } }));
  await openScanEditor(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map', exact: true });
  await expect(dialog.getByRole('img', { name: 'Preview of your poster' })).toBeVisible({ timeout: 20_000 });
  await dialog.getByRole('tab', { name: 'Video', exact: true }).click();
  await dialog.getByLabel('Duration', { exact: true }).selectOption('5');
  const download = dialog.getByRole('button', { name: 'Download MP4', exact: true });
  if (await download.isDisabled()) {
    await expect(dialog.getByRole('alert')).toContainText(/MP4|canvas/);
    test.skip(true, await dialog.getByRole('alert').textContent() ?? 'Native MP4 recording is unsupported.');
  }
  const originalCamera = await page.evaluate(() => globalThis.window.__PRINT_MAP_REACT_SCAN__?.cameras.find(({ surface }) => surface === 'editor'));
  const history = await page.locator('button[aria-label="Undo"]').isEnabled();
  await startProbe(page, 'Video recording progress');
  const downloaded = page.waitForEvent('download');
  await download.click();
  await downloaded;
  const result = await finishProbe(page, info, 'video-progress');
  expectOwners(result, ['VideoExportSession', 'VideoExportMessages'], ['StudioCanvas', 'MapCanvas', 'StudioPosterPreview', 'HistoryActions', 'StudioCompositionControls']);
  expect(result.components.VideoExportSettings?.callbacks).toBe(2);
  expect(result.components.VideoExportActions?.callbacks).toBe(2);
  expect(result.components.FeatureHelp?.callbacks ?? 0).toBeLessThanOrEqual(2);
  expect(result.components.VideoExportHelp).toBeUndefined();
  for (const owner of ['ExportWorkspace', 'StudioModeTabs', 'ExportWorkspaceContent', 'VideoWorkspacePanel', 'DialogContent', 'StudioDialogHeader']) {
    expect(result.components[owner]?.callbacks, `${owner} only changes when busy starts or ends`).toBe(2);
  }
  expect(result.mapMutations.filter(({ surface }) => surface === 'editor')).toEqual([]);
  expect(result.mapMutations.some(({ operation, surface }) => operation === 'jumpTo' && surface === 'video')).toBe(true);
  expect(await page.evaluate(() => globalThis.window.__PRINT_MAP_REACT_SCAN__?.cameras.find(({ surface }) => surface === 'editor'))).toEqual(originalCamera);
  expect(await page.locator('button[aria-label="Undo"]').isEnabled()).toBe(history);
});

test('simulated video controller progress preserves settings and help render boundaries', async ({ page }, info) => {
  test.setTimeout(60_000);
  await page.route('**/src/video/capability.ts', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: 'export function getVideoCapability() { return { supported: true, mimeType: "video/mp4" }; }',
  }));
  await page.route('**/src/video/exportVideoDocument.ts', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export function exportVideoDocument({signal,onProgress}) {
      let frame = 0;
      return new Promise((resolve,reject) => {
        const timer = setInterval(() => onProgress({phase:"recording",fraction:Math.min(++frame/100,0.99),presentedFrames:frame,missedFrameSlots:0}),30);
        signal.addEventListener("abort",()=>{clearInterval(timer);reject(signal.reason)},{once:true});
      });
    }`,
  }));
  await openScanEditor(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map', exact: true });
  await expect(dialog.getByRole('img', { name: 'Preview of your poster' })).toBeVisible({ timeout: 20_000 });
  await dialog.getByRole('tab', { name: 'Video', exact: true }).click();
  const originalCamera = await page.evaluate(() => globalThis.window.__PRINT_MAP_REACT_SCAN__?.cameras.find(({ surface }) => surface === 'editor'));
  const history = await page.locator('button[aria-label="Undo"]').isEnabled();
  const downloads: string[] = [];
  page.on('download', (download) => { downloads.push(download.suggestedFilename()); });
  await startProbe(page, 'Simulated video controller progress');
  await dialog.getByRole('button', { name: 'Download MP4', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('frames presented');
  await page.waitForTimeout(750);
  await dialog.getByRole('button', { name: 'Cancel recording' }).click();
  await expect(dialog.getByRole('status')).toContainText('No file downloaded');
  const result = await finishProbe(page, info, 'simulated-video-progress');
  expectOwners(result, ['VideoExportSession', 'VideoExportMessages'], [
    'StudioCanvas', 'MapCanvas', 'StudioPosterPreview', 'HistoryActions', 'StudioCompositionControls', 'VideoExportHelp',
  ]);
  expect(result.components.VideoExportSettings?.callbacks).toBe(2);
  expect(result.components.VideoExportActions?.callbacks).toBe(2);
  expect(result.components.FeatureHelp?.callbacks ?? 0).toBeLessThanOrEqual(2);
  for (const owner of ['ExportWorkspace', 'StudioModeTabs', 'ExportWorkspaceContent', 'VideoWorkspacePanel', 'DialogContent', 'StudioDialogHeader']) {
    expect(result.components[owner]?.callbacks, `${owner} only changes when busy starts or ends`).toBe(2);
  }
  expect(result.domMutations).toEqual([]);
  expect(result.mapMutations).toEqual([]);
  expect(await page.evaluate(() => globalThis.window.__PRINT_MAP_REACT_SCAN__?.cameras.find(({ surface }) => surface === 'editor'))).toEqual(originalCamera);
  expect(await page.locator('button[aria-label="Undo"]').isEnabled()).toBe(history);
  expect(downloads).toEqual([]);
  info.annotations.push({ type: 'simulated-controller', description: 'Render isolation and cancellation only; no MP4 encoder or fake video file.' });
});
