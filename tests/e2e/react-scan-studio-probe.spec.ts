import { expect, test, type Page } from '@playwright/test';
import { attachInventory, expectOwners, finishProbe, NATIVE_MAP_OWNERS, openScanEditor, startProbe, waitForRenderQuiet } from './react-scan-helpers';
import type { ReactScanProbeResult } from '../../src/dev/reactScanProbe';
import { chooseOption } from './select-support';

function expectOnlyControls(result: ReactScanProbeResult, components: string[], labels: string[]) {
  const events = result.events.filter((event) => components.includes(event.component));
  expect(new Set(events.map(({ controlLabel }) => controlLabel))).toEqual(new Set(labels));
  expect(new Set(events.map(({ instanceId }) => instanceId)).size).toBe(labels.length);
}

const STUDIO_FIELDS = ['StudioToggle', 'StudioSelect', 'StudioColor', 'StudioNumber'];

test.skip(process.env.VITE_REACT_SCAN !== 'true', 'Run with npm run audit:renders.');
test.afterEach(async ({ page }, info) => attachInventory(page, info));

async function enablePoster(page: Page) {
  await page.getByRole('tab', { name: 'Layout' }).click();
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await page.getByLabel('Show title', { exact: true }).check();
  await page.getByLabel('Title text', { exact: true }).fill('Vienna field guide');
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
    const originalPoi = document.layers.find(({ id }) => id === 'poi-cafe');
    if (!originalPoi) throw new Error('Photo fixture point is missing.');
    document.layers.unshift({ ...structuredClone(originalPoi), id: 'second-photo-poi', name: 'Second photo point',
      geometry: { type: 'Point', coordinates: [16.39, 48.2] } });
    document.studio.photos.stops.push({ ...document.studio.photos.stops[0], id: 'photo-2', layerId: 'second-photo-poi', caption: 'Stable second photo' });
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
    expectOwners(result, [field === 'Top margin' ? 'PageAppearance' : 'PosterControls', 'StudioPosterPreview'], [
      ...NATIVE_MAP_OWNERS, 'PhotoStoryControls', 'DecorationControls', 'TemplateGallery', 'WallPreviewDialog',
      ...(field === 'Title text' ? ['PageAppearance', 'PageDimensions'] : []),
    ]);
    expect(result.mapMutations).toEqual([]);
    expectOnlyControls(result, ['TextControl'], field === 'Title text' ? ['Title'] : []);
    expectOnlyControls(result, [...STUDIO_FIELDS, 'MarginField'], field === 'Top margin' ? ['Top margin'] : []);
  });
}

test('one photo caption leaves controls, other photo nodes, and native renderers stable', async ({ page }, info) => {
  await openScanEditor(page);
  await loadPhotoPoster(page);
  await page.getByRole('tab', { name: 'Layout' }).click();
  await page.getByRole('button', { name: 'Photos', exact: true }).click();
  const stableImage = page.getByLabel('Poster artwork', { exact: true }).locator('image').last();
  await stableImage.evaluate((node) => { node.dataset.scanIdentity = 'second-photo'; });
  await startProbe(page, 'First photo caption');
  await page.getByLabel('Stop 1 caption', { exact: true }).fill('A changed first caption');
  const result = await finishProbe(page, info, 'photo-caption');
  expectOwners(result, ['PhotoStoryControls', 'StudioPosterPreview'], [
    ...NATIVE_MAP_OWNERS, 'PosterControls', 'DecorationControls', 'TemplateGallery', 'WallPreviewDialog',
  ]);
  expect(result.mapMutations).toEqual([]);
  expectOnlyControls(result, STUDIO_FIELDS, []);
  await expect(stableImage).toHaveAttribute('data-scan-identity', 'second-photo');
});

test('decoration toggle leaves poster, photo, terrain and native map owners stable', async ({ page }, info) => {
  await openScanEditor(page);
  await enablePoster(page);
  await page.getByRole('button', { name: 'Map elements', exact: true }).click();
  await startProbe(page, 'Compass enabled');
  await page.getByLabel('Show compass', { exact: true }).check();
  const result = await finishProbe(page, info, 'decoration-toggle');
  expectOwners(result, ['DecorationControls', 'StudioPosterPreview'], [
    ...NATIVE_MAP_OWNERS, 'PosterControls', 'PhotoStoryControls', 'TemplateGallery', 'WallPreviewDialog',
  ]);
  expect(result.mapMutations).toEqual([]);
  // The compass ToggleSection mounts its dependent fields; no other decoration field renders.
  expectOnlyControls(result, STUDIO_FIELDS, ['Compass corner', 'Compass style', 'Compass size', 'Compass color']);
});

test('moving a photo POI preserves the other photo and unrelated route sources', async ({ page }, info) => {
  await openScanEditor(page);
  await loadPhotoPoster(page);
  await page.getByRole('button', { name: 'Select Coffee stop', exact: true }).click();
  const otherPhoto = page.getByLabel('Poster artwork', { exact: true }).locator('image').nth(1);
  await otherPhoto.evaluate((node) => { node.dataset.scanIdentity = 'unmoved-photo'; });
  const position = await otherPhoto.evaluate((node) => [node.getAttribute('x'), node.getAttribute('y')]);
  const marker = page.getByRole('button', { name: 'Move Coffee stop', exact: true });
  await marker.focus();
  await startProbe(page, 'Photo POI move');
  await marker.press('ArrowRight');
  const result = await finishProbe(page, info, 'photo-poi-move');
  expectOwners(result, ['StudioPosterPreview', 'PoiCoordinateControls'], ['PoiAppearanceControls', 'LocationSearch', 'StudioVideoControls']);
  expect(result.domMutations).toEqual([]);
  expect(result.mapMutations.filter(({ operation }) => operation === 'setData').map(({ target }) => target)).toEqual(['studio-source-8:poi-cafe']);
  await expect(otherPhoto).toHaveAttribute('data-scan-identity', 'unmoved-photo');
  expect(await otherPhoto.evaluate((node) => [node.getAttribute('x'), node.getAttribute('y')])).toEqual(position);
});

test('terrain exaggeration updates native terrain without composition or sibling controls', async ({ page }, info) => {
  await openScanEditor(page);
  await enablePoster(page);
  await page.getByRole('tab', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: 'Terrain', exact: true }).click();
  await page.getByLabel('Show 3D terrain', { exact: true }).check();
  await startProbe(page, 'Terrain exaggeration');
  await page.getByRole('spinbutton', { name: 'Terrain exaggeration' }).fill('2');
  await page.getByRole('spinbutton', { name: 'Terrain exaggeration' }).press('Enter');
  const result = await finishProbe(page, info, 'terrain-exaggeration');
  expectOwners(result, ['TerrainProperties', 'MapCanvas'], ['StudioCompositionControls', 'StudioPosterPreview', 'PhotoStoryControls', 'PosterControls', 'StudioVideoControls']);
  expect(result.mapMutations.some(({ operation, surface }) => operation === 'setTerrain' && surface === 'editor')).toBe(true);
  expect(result.mapMutations.filter(({ operation }) => ['setData', 'addLayer', 'removeLayer', 'removeSource'].includes(operation))).toEqual([]);
  expectOnlyControls(result, ['ValidatedNumberField'], ['Terrain exaggeration']);
});

test('video settings stay outside the live camera and composition', async ({ page }, info) => {
  await openScanEditor(page);
  await enablePoster(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('tab', { name: 'Video', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await expect(dialog).toBeVisible();
  const camera = await page.getByTestId('map-canvas').getAttribute('data-map-zoom');
  await startProbe(page, 'Video duration');
  await chooseOption(dialog, 'Duration', '15 seconds');
  const result = await finishProbe(page, info, 'video-settings');
  expectOwners(result, ['VideoExportSettings'], ['StudioCanvas', 'MapCanvas', 'StudioPosterPreview', 'StudioCompositionControls', 'StudioTerrainControls']);
  expect(result.mapMutations).toEqual([]);
  expectOnlyControls(result, ['VideoChoice'], ['Duration']);
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-zoom', camera!);
});

test('nearby poster photo and decoration fields keep all unchanged field instances silent', async ({ page }, info) => {
  await openScanEditor(page);
  await loadPhotoPoster(page);
  await page.getByRole('tab', { name: 'Layout' }).click();
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await startProbe(page, 'Subtitle font');
  await chooseOption(page, 'Subtitle font', 'Field notes mono');
  let result = await finishProbe(page, info, 'subtitle-font');
  expectOnlyControls(result, ['TextControl'], ['Subtitle']);
  expectOnlyControls(result, STUDIO_FIELDS, ['Subtitle font']);
  expect(result.mapMutations).toEqual([]);
  await page.getByRole('button', { name: 'Photos', exact: true }).click();
  await startProbe(page, 'Photo shape');
  await chooseOption(page, 'Photo shape', 'Square');
  result = await finishProbe(page, info, 'photo-shape');
  expectOnlyControls(result, STUDIO_FIELDS, ['Photo shape']);
  expect(result.mapMutations).toEqual([]);
  await page.getByRole('button', { name: 'Map elements', exact: true }).click();
  await startProbe(page, 'Compass corner');
  await chooseOption(page, 'Compass corner', 'Top left');
  result = await finishProbe(page, info, 'compass-corner');
  expectOnlyControls(result, STUDIO_FIELDS, ['Compass corner']);
  expect(result.mapMutations).toEqual([]);
});

test('terrain contour width leaves exaggeration, interval, color and toggles silent', async ({ page }, info) => {
  await openScanEditor(page);
  await page.getByRole('button', { name: 'Terrain', exact: true }).click();
  await page.getByLabel('Show 3D terrain', { exact: true }).check();
  await page.getByLabel('Show elevation contours', { exact: true }).check();
  await startProbe(page, 'Contour width');
  await page.getByLabel('Contour line width', { exact: true }).fill('2');
  await page.getByLabel('Contour line width', { exact: true }).press('Enter');
  const result = await finishProbe(page, info, 'contour-width');
  expectOnlyControls(result, ['ValidatedNumberField'], ['Contour line width']);
  expect(result.components.TerrainColor).toBeUndefined();
  expect(result.components.StudioCompositionControls).toBeUndefined();
  expect(result.mapMutations.filter(({ operation }) => ['addLayer', 'removeLayer', 'setData'].includes(operation))).toEqual([]);
});

test('wall preferences do not rebuild composition controls or live map', async ({ page }, info) => {
  await openScanEditor(page);
  await enablePoster(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map', exact: true });
  await dialog.getByRole('button', { name: 'Preview on wall', exact: true }).click();
  await expect(dialog.locator('.studio-wall-scene img')).toBeVisible();
  await startProbe(page, 'Wall frame preference');
  await chooseOption(dialog, 'Frame finish', 'Walnut');
  const result = await finishProbe(page, info, 'wall-preference');
  expectOwners(result, ['WallPreviewPanel'], [...NATIVE_MAP_OWNERS, 'StudioPosterPreview', 'StudioCompositionPanel', 'PosterControls', 'PhotoStoryControls', 'DecorationControls']);
  expect(result.mapMutations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
