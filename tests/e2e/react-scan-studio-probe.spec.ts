import { expect, test, type Page } from '@playwright/test';
import { expectOwners, finishProbe, NATIVE_MAP_OWNERS, openScanEditor, startProbe, waitForRenderQuiet } from './react-scan-helpers';

test.skip(process.env.VITE_REACT_SCAN !== 'true', 'Run with npm run audit:renders.');

async function enablePoster(page: Page) {
  await page.getByText('Poster typography & paper', { exact: true }).click();
  await page.getByLabel('Enable poster composition', { exact: true }).check();
  await expect(page.getByLabel('Poster artwork', { exact: true })).toBeVisible();
  await waitForRenderQuiet(page);
}

async function loadPhotoPoster(page: Page) {
  const project = await page.evaluate(async () => {
    const path = '/tests/fixtures/studio.ts';
    const { studioProject } = await import(/* @vite-ignore */ path) as typeof import('../fixtures/studio');
    const document = studioProject();
    document.studio.terrain.enabled = false;
    document.studio.terrain.contours.enabled = false;
    document.studio.terrain.buildings.enabled = false;
    document.studio.photos.stops.push({ ...document.studio.photos.stops[0], id: 'photo-2', caption: 'Stable second photo' });
    return document;
  });
  await page.locator('input[accept*=".printmap.json"]').setInputFiles({
    name: 'scan.printmap.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.getByRole('button', { name: 'Replace project', exact: true }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true');
  await waitForRenderQuiet(page);
}

for (const composed of [false, true]) {
  test(`project rename leaves native map and poster isolated (composition ${composed ? 'on' : 'off'})`, async ({ page }, info) => {
    await openScanEditor(page);
    if (composed) await enablePoster(page);
    await page.getByRole('button', { name: 'Vienna field guide', exact: true }).click();
    const title = page.getByRole('textbox', { name: 'Project title' });
    await title.fill('Independent project identity');
    await startProbe(page, 'Project title commit');
    await title.press('Enter');
    await expect(page.getByRole('button', { name: 'Independent project identity', exact: true })).toBeVisible();
    const result = await finishProbe(page, info, 'title-commit');
    expectOwners(result, ['StudioProjectIdentity'], [...NATIVE_MAP_OWNERS, 'StudioCanvas', 'StudioPosterPreview', 'StudioCompositionControls']);
    expect(result.mapMutations).toEqual([]);
    await startProbe(page, 'Title autosave settle');
    await page.waitForTimeout(800);
    const settle = await finishProbe(page, info, 'title-settle');
    expectOwners(settle, [], [...NATIVE_MAP_OWNERS, 'StudioPosterPreview', 'StudioCompositionControls']);
    expect(settle.mapMutations).toEqual([]);
  });
}

for (const field of ['Title text', 'Top margin']) {
  test(`poster ${field} only changes poster owners`, async ({ page }, info) => {
    await openScanEditor(page);
    await enablePoster(page);
    await startProbe(page, `Poster ${field}`);
    const input = page.getByLabel(field, { exact: true });
    await input.fill(field === 'Title text' ? 'Only poster text changes' : '14');
    if (field === 'Top margin') await input.press('Enter');
    const result = await finishProbe(page, info, `poster-${field}`);
    expectOwners(result, ['PosterControls', 'StudioPosterPreview'], [
      ...NATIVE_MAP_OWNERS, 'PhotoStoryControls', 'DecorationControls', 'PosterGallery', 'WallPreviewDialog',
    ]);
    expect(result.mapMutations).toEqual([]);
  });
}

test('one photo caption leaves controls, other photo nodes, and native renderers stable', async ({ page }, info) => {
  await openScanEditor(page);
  await loadPhotoPoster(page);
  await page.getByText('Photo story', { exact: true }).click();
  const stableImage = page.getByLabel('Poster artwork', { exact: true }).locator('image').last();
  await stableImage.evaluate((node) => { node.setAttribute('data-scan-identity', 'second-photo'); });
  await startProbe(page, 'First photo caption');
  await page.getByLabel('Stop 1 caption', { exact: true }).fill('A changed first caption');
  const result = await finishProbe(page, info, 'photo-caption');
  expectOwners(result, ['PhotoStoryControls', 'StudioPosterPreview'], [
    ...NATIVE_MAP_OWNERS, 'PosterControls', 'DecorationControls', 'PosterGallery', 'WallPreviewDialog',
  ]);
  expect(result.mapMutations).toEqual([]);
  await expect(stableImage).toHaveAttribute('data-scan-identity', 'second-photo');
});

test('decoration toggle leaves poster, photo, terrain and native map owners stable', async ({ page }, info) => {
  await openScanEditor(page);
  await enablePoster(page);
  await page.getByText('Compass, scale, grid & QR', { exact: true }).click();
  await startProbe(page, 'Compass enabled');
  await page.getByLabel('Show compass', { exact: true }).check();
  const result = await finishProbe(page, info, 'decoration-toggle');
  expectOwners(result, ['DecorationControls', 'StudioPosterPreview'], [
    ...NATIVE_MAP_OWNERS, 'PosterControls', 'PhotoStoryControls', 'PosterGallery', 'WallPreviewDialog',
  ]);
  expect(result.mapMutations).toEqual([]);
});

test('terrain exaggeration updates native terrain without composition or sibling controls', async ({ page }, info) => {
  await openScanEditor(page);
  await enablePoster(page);
  await page.getByRole('button', { name: 'Terrain & 3D relief', exact: true }).click();
  await page.getByLabel('Show 3D terrain', { exact: true }).check();
  await startProbe(page, 'Terrain exaggeration');
  await page.getByRole('spinbutton', { name: 'Terrain exaggeration' }).fill('2');
  await page.getByRole('spinbutton', { name: 'Terrain exaggeration' }).press('Enter');
  const result = await finishProbe(page, info, 'terrain-exaggeration');
  expectOwners(result, ['TerrainProperties', 'MapCanvas'], ['StudioCompositionControls', 'StudioPosterPreview', 'PhotoStoryControls', 'PosterControls', 'StudioVideoControls']);
  expect(result.mapMutations.some(({ operation, surface }) => operation === 'setTerrain' && surface === 'editor')).toBe(true);
  expect(result.mapMutations.filter(({ operation }) => ['setData', 'addLayer', 'removeLayer', 'removeSource'].includes(operation))).toEqual([]);
});

test('video settings stay outside the live camera and composition', async ({ page }, info) => {
  await openScanEditor(page);
  await enablePoster(page);
  await page.getByRole('button', { name: 'Map video', exact: true }).click();
  await page.getByRole('button', { name: 'Export map video', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map video' });
  await expect(dialog).toBeVisible();
  const camera = await page.getByTestId('map-canvas').getAttribute('data-map-zoom');
  await startProbe(page, 'Video duration');
  await dialog.getByLabel('Duration').selectOption('15');
  const result = await finishProbe(page, info, 'video-settings');
  expectOwners(result, ['VideoExportSettings'], ['StudioCanvas', 'MapCanvas', 'StudioPosterPreview', 'StudioCompositionControls', 'StudioTerrainControls']);
  expect(result.mapMutations).toEqual([]);
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-zoom', camera!);
});

test('wall preferences do not rebuild composition controls or live map', async ({ page }, info) => {
  await openScanEditor(page);
  await enablePoster(page);
  await page.getByRole('button', { name: 'Preview on a wall', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.studio-wall-scene img')).toBeVisible();
  await startProbe(page, 'Wall frame preference');
  await dialog.getByLabel('Frame finish').selectOption('walnut');
  const result = await finishProbe(page, info, 'wall-preference');
  expectOwners(result, ['WallPreviewDialog'], [...NATIVE_MAP_OWNERS, 'StudioPosterPreview', 'StudioCompositionPanel', 'PosterControls', 'PhotoStoryControls', 'DecorationControls']);
  expect(result.mapMutations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
