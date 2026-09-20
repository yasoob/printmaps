import { expect, test } from '@playwright/test';
import { attachInventory, expectOwners, finishProbe, openScanEditor, startProbe, waitForRenderQuiet } from './react-scan-helpers';

test.skip(process.env.VITE_REACT_SCAN !== 'true', 'Run with npm run audit:renders.');
test.afterEach(async ({ page }, info) => attachInventory(page, info));

for (const embedded of [false, true]) {
  test(`shared ${embedded ? 'embed' : 'viewer'} camera is isolated from document and editor`, async ({ page }, info) => {
    await openScanEditor(page);
    await page.getByRole('tab', { name: 'Layout' }).click();
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await page.getByLabel('Show title', { exact: true }).check();
    await page.getByLabel('Title text', { exact: true }).fill('Vienna field guide');
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const link = await page.getByLabel('Read-only link').inputValue();
    const hash = `${embedded ? '#embed=' : '#share='}${new URL(link).hash.slice('#share='.length)}`;
    await page.addInitScript(() => {
      indexedDB.open = () => { throw new Error('Shared render audit must not access local autosave.'); };
    });
    await page.goto(`/tests/e2e/react-scan-viewer.html${hash}`);
    await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 30_000 });
    await expect(page.getByLabel('Poster artwork')).toBeVisible();
    await waitForRenderQuiet(page);
    const readCenter = () => page.evaluate(() => globalThis.window.__PRINT_MAP_REACT_SCAN__?.cameras.find(({ surface }) => surface === 'shared')?.center);
    const center = await readCenter();
    expect(center).toBeDefined();
    const canvas = await page.locator('.maplibregl-canvas').boundingBox();
    expect(canvas).not.toBeNull();
    await startProbe(page, 'Read-only pan preview');
    await page.mouse.move(canvas!.x + canvas!.width / 2, canvas!.y + canvas!.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvas!.x + canvas!.width / 2 + 65, canvas!.y + canvas!.height / 2 + 35, { steps: 5 });
    await page.mouse.up();
    await expect.poll(readCenter).not.toEqual(center);
    await waitForRenderQuiet(page);
    const result = await finishProbe(page, info, 'readonly-pan');
    expectOwners(result, ['SharedCompositionOverlay', 'StudioPosterPreview'], [
      'SharedProjectApp', 'SharedProjectView', 'SharedMapPreview', 'MapCanvas',
      'App', 'StudioApp', 'HistoryActions', 'ProjectAutosaveProvider',
    ]);
    expect(result.domMutations).toEqual([]);
    expect(result.mapMutations.filter(({ operation }) => ['setData', 'addLayer', 'removeLayer', 'setPaintProperty'].includes(operation))).toEqual([]);
    await startProbe(page, 'Read-only pan settle');
    await page.waitForTimeout(700);
    const settle = await finishProbe(page, info, 'readonly-settle');
    expect(settle.components).toEqual({});
    expect(settle.mapMutations).toEqual([]);
  });
}

test('share dialog generation and help stay outside live map and composition', async ({ page }, info) => {
  await openScanEditor(page);
  await startProbe(page, 'Share dialog open');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByLabel('Read-only link')).not.toHaveValue('');
  const result = await finishProbe(page, info, 'share-open');
  expectOwners(result, ['ShareControl', 'ShareDialog'], ['MapCanvas', 'CanvasWorkspace', 'StudioCompositionControls', 'ProjectPropertiesPanel']);
  expect(result.mapMutations).toEqual([]);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeFocused();
});
