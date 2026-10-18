import path from 'node:path';
import { expect, test } from '@playwright/test';
import { attachInventory, expectOwners, finishProbe, openScanEditor, startProbe, waitForRenderQuiet } from './react-scan-helpers';
import { openAdvanced, convertRoute } from './advanced-route-test-support';
import { addCoordinate, loseRenderer, openInstrumentedMap } from './map-recovery-support';
import { expandToolSettings } from './authoring-panel-support';
import { openConflict, reviewConflict } from './autosave-conflict-support';
import { chooseOption } from './select-support';

test.skip(process.env.VITE_REACT_SCAN !== 'true', 'Run with npm run audit:renders.');
test.afterEach(async ({ page }, info) => attachInventory(page, info));

test('import batch styling and replacement review remain local before commit', async ({ page }, info) => {
  await openScanEditor(page);
  await page.locator('input[accept^=".geojson"]').setInputFiles([
    path.resolve('tests/fixtures/import/supported.geojson'),
    path.resolve('tests/fixtures/import/wave2/namespaced.kml'),
  ]);
  const dialog = page.getByRole('dialog', { name: 'Import map data' });
  await expect(dialog.getByRole('group', { name: 'Style imported routes' })).toBeVisible();
  await startProbe(page, 'Import style draft');
  await dialog.getByRole('textbox', { name: 'Import route width' }).fill('7');
  let result = await finishProbe(page, info, 'import-style');
  expectOwners(result, ['MapDataImportPortals'], ['MapCanvas', 'LayerNavigation', 'ProjectProperties', 'ReplacementNote']);
  expect(result.mapMutations).toEqual([]);
  await dialog.getByRole('button', { name: 'Import 2 files', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Map data import status' })).toContainText('Imported 2 files');
  await page.getByRole('button', { name: 'Dismiss map data import status', exact: true }).click();
  await page.getByRole('button', { name: 'Select Route 01', exact: true }).click();
  await page.getByRole('button', { name: 'Layer menu', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Replace layer data', exact: true }).click();
  const replacementChooser = await chooser;
  await replacementChooser.setFiles(path.resolve('tests/fixtures/import/supported.geojson'));
  const replacement = page.getByRole('dialog', { name: 'Replace Route 01 data' });
  await expect(replacement).toBeVisible();
  await startProbe(page, 'Replacement review cancel');
  await replacement.getByRole('button', { name: 'Cancel', exact: true }).click();
  result = await finishProbe(page, info, 'replacement-cancel');
  expectOwners(result, ['MapDataImportPortals'], ['MapCanvas']);
  expect(result.mapMutations).toEqual([]);
});

test('POI address review, correction and discard isolate native map and route tools', async ({ page }, info) => {
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', (route) => route.fulfill({ json: {
    type: 'FeatureCollection', features: [0, 1].map((index) => ({
      id: `match-${index}`, geometry: { type: 'Point', coordinates: [16.37 + index * 0.01, 48.21] },
      properties: { full_address: `Audit address ${index + 1}, Vienna` },
    })),
  } }));
  await openScanEditor(page);
  await page.getByRole('button', { name: 'Place (P)', exact: true }).click();
  await page.getByRole('button', { name: 'Paste POI list', exact: true }).click();
  await page.getByRole('radio', { name: 'Addresses', exact: true }).check();
  await startProbe(page, 'POI list draft');
  await page.getByRole('textbox', { name: 'POI spreadsheet rows', exact: true }).fill('My cafe\tVienna');
  let result = await finishProbe(page, info, 'poi-list-draft');
  expectOwners(result, ['PoiSpreadsheetPanel'], ['MapCanvas', 'MapCanvasWithLayerPreview', 'RouteDrawingPanel', 'ShapeDrawingPanel', 'ProjectProperties']);
  await page.getByRole('button', { name: 'Look up addresses', exact: true }).click();
  await expect(page.getByText('First suggestion (not selected): Audit address 1, Vienna')).toBeVisible();
  await page.getByText('Review or correct row 1', { exact: true }).click();
  await startProbe(page, 'POI reviewed match');
  await chooseOption(page, 'Matched location for row 1', 'Audit address 2, Vienna');
  result = await finishProbe(page, info, 'poi-review-choice');
  expectOwners(result, ['PoiAddressReview'], ['MapCanvas', 'RouteDrawingPanel', 'ShapeDrawingPanel', 'ProjectProperties']);
  expect(result.mapMutations).toEqual([]);
  await page.getByRole('button', { name: 'Cancel list', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Discard unadded POI lists?' })).toBeVisible();
  await startProbe(page, 'POI keep editing');
  await page.getByRole('button', { name: 'Keep editing lists', exact: true }).click();
  result = await finishProbe(page, info, 'poi-keep-editing');
  expectOwners(result, ['PoiSpreadsheetPanel'], ['MapCanvas']);
});

test('arc controls, travel markers and draft discard expose their own conditional owners', async ({ page }, info) => {
  await openScanEditor(page);
  await page.getByRole('button', { name: 'Select Route 01', exact: true }).click();
  await openAdvanced(page);
  await convertRoute(page, 'arc');
  await page.getByRole('combobox', { name: 'Route marker pictogram' }).selectOption('air');
  await page.mouse.move(700, 10);
  await startProbe(page, 'Arc inspector local selection');
  await page.getByRole('combobox', { name: 'Route anchor' }).selectOption('1');
  let result = await finishProbe(page, info, 'arc-selection');
  expectOwners(result, ['RouteVertexControls'], ['MapCanvas', 'RouteMarkerControls', 'RouteExtensionControls']);
  await page.getByRole('button', { name: 'Route (R)', exact: true }).click();
  await addCoordinate(page, 'route', '16.35', '48.2');
  await addCoordinate(page, 'route', '16.4', '48.22');
  await expandToolSettings(page, 'route');
  await page.getByText('Draft points (2)', { exact: true }).click();
  await startProbe(page, 'Route draft discard decision');
  await page.getByRole('button', { name: 'Cancel route', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  result = await finishProbe(page, info, 'route-discard-dialog');
  expectOwners(result, ['RouteDiscardDialog'], ['StudioCompositionControls', 'StudioTerrainControls']);
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
});

test('area drawing and travel time local options leave unrelated inspector and route controls stable', async ({ page }, info) => {
  await openScanEditor(page);
  await page.getByRole('button', { name: 'Area (S)', exact: true }).click();
  await page.getByRole('tab', { name: 'Draw custom area', exact: true }).click();
  await addCoordinate(page, 'area', '16.35', '48.2');
  await startProbe(page, 'Area coordinate draft');
  await page.getByRole('textbox', { name: 'New area point longitude' }).fill('16.4');
  let result = await finishProbe(page, info, 'area-draft-input');
  expectOwners(result, ['ShapePointInputs'], ['MapCanvas', 'RouteDrawingPanel', 'ProjectProperties']);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Area (S)', exact: true }).click();
  await page.getByRole('tab', { name: 'Travel time', exact: true }).click();
  await startProbe(page, 'Travel-time profile');
  await page.getByRole('radio', { name: 'Cycling', exact: true }).click();
  result = await finishProbe(page, info, 'isochrone-options');
  expectOwners(result, ['IsochronePanel'], ['ProjectProperties', 'RouteDrawingPanel', 'PoiAuthoringControls']);
  expect(result.mapMutations.filter(({ operation }) => operation === 'setData')).toEqual([]);
});

test('style customization controls, layer drag overlay and recovery have explicit boundaries', async ({ page }, info) => {
  await openScanEditor(page);
  await page.getByRole('button', { name: /Customize colors/ }).click();
  await startProbe(page, 'Style customizer disclosure');
  await page.getByRole('button', { name: /Back/ }).click();
  let result = await finishProbe(page, info, 'style-back');
  expectOwners(result, ['ProjectProperties'], ['MapCanvas', 'CanvasWorkspace']);
  await page.getByRole('button', { name: 'Reorder Route 01', exact: true }).focus();
  await startProbe(page, 'Layer keyboard lift');
  await page.keyboard.press('Space');
  await expect(page.locator('.layer-tree .is-dragging')).toHaveCount(1);
  result = await finishProbe(page, info, 'layer-drag-overlay');
  expectOwners(result, ['LayerDragOverlay'], ['MapCanvas', 'ProjectProperties', 'LocationSearch']);
  await page.keyboard.press('Escape');
});

test('native renderer failure is contained and recovery does not replace the project', async ({ page }, info) => {
  await openInstrumentedMap(page);
  await waitForRenderQuiet(page);
  await startProbe(page, 'Renderer context loss');
  await loseRenderer(page);
  const result = await finishProbe(page, info, 'renderer-failure');
  expectOwners(result, ['MapPreviewError'], ['StudioApp', 'ProjectProperties', 'LayerNavigation']);
  await page.getByRole('button', { name: 'Retry map', exact: true }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true');
});

test('autosave conflict review keeps the renderer and other panels isolated', async ({ page }, info) => {
  const { winner } = await openConflict(page);
  await startProbe(page, 'Autosave conflict review');
  await reviewConflict(page);
  const result = await finishProbe(page, info, 'autosave-conflict');
  expectOwners(result, ['AutosaveConflictDialog'], ['MapCanvas', 'MapCanvasWithLayerPreview']);
  await winner.close();
});

test('damaged draft dialog and offline continuation mount recovery owners', async ({ page }, info) => {
  await openScanEditor(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('print-map-studio', 1);
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('drafts', 'readwrite');
        transaction.objectStore('drafts').put({ recordVersion: 99, document: { schemaVersion: 999 } }, 'current');
        transaction.addEventListener('complete', () => resolve(), { once: true });
        transaction.addEventListener('error', () => reject(transaction.error), { once: true });
      });
    } finally { db.close(); }
  });
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Local draft unavailable' })).toBeVisible();
  await startProbe(page, 'Recovery continuation');
  await page.getByRole('button', { name: 'Continue without autosave', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave off');
  const result = await finishProbe(page, info, 'autosave-recovery');
  expectOwners(result, ['ProjectAutosaveProvider', 'ProjectAutosaveOfflineNotice'], ['MapCanvas', 'LayerNavigation']);
});

test('invalid shared snapshot mounts the error owner without an editor or renderer', async ({ page }, info) => {
  await page.goto('/tests/e2e/react-scan-viewer.html#share=invalid');
  await expect(page.getByRole('heading', { name: 'This shared map could not be opened' })).toBeVisible();
  await startProbe(page, 'Invalid shared snapshot settles');
  await page.waitForTimeout(700);
  const result = await finishProbe(page, info, 'share-error-settle');
  expect(result.components).toEqual({});
  expect(result.mapMutations).toEqual([]);
});

test('multipart shape inspector and offscreen place feedback have assigned interactions', async ({ page }, info) => {
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', (route) => route.fulfill({ json: {
    type: 'FeatureCollection', features: [{ id: 'new-york', type: 'Feature',
      geometry: { type: 'Point', coordinates: [-73.9857, 40.7484] },
      properties: { full_address: 'New York, United States' } }],
  } }));
  await openScanEditor(page);
  const document = await page.evaluate(async () => {
    const modulePath = '/src/domain/project.ts';
    const { createInitialProjectDocument } = await import(/* @vite-ignore */ modulePath) as typeof import('../../src/domain/project');
    const document = createInitialProjectDocument();
    const area = document.layers.find(({ id }) => id === 'area-center');
    if (!area || area.geometry?.type !== 'Polygon') throw new Error('Missing area fixture.');
    area.geometry = { type: 'MultiPolygon', coordinates: [area.geometry.coordinates] };
    return document;
  });
  await page.locator('input[accept*=".printmap.json"]').setInputFiles({
    name: 'multipart.printmap.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)),
  });
  await page.getByRole('button', { name: 'Replace project', exact: true }).click();
  await startProbe(page, 'Multipart shape selection');
  await page.getByRole('button', { name: 'Select City center', exact: true }).click();
  let result = await finishProbe(page, info, 'multipart-selection');
  expectOwners(result, ['MultiPartGeometryStatus'], ['LocationSearch']);
  await page.getByRole('button', { name: 'Place (P)', exact: true }).click();
  await page.getByRole('combobox', { name: 'Search places and addresses' }).fill('New York');
  await expect(page.getByRole('option', { name: 'New York, United States' })).toBeVisible();
  await startProbe(page, 'Offscreen POI selected');
  await page.getByRole('option', { name: 'New York, United States' }).click();
  await expect(page.getByRole('button', { name: 'Show on map', exact: true })).toBeVisible();
  result = await finishProbe(page, info, 'offscreen-place-feedback');
  expectOwners(result, ['LocationSearchFeedback'], ['PosterControls', 'PhotoStoryControls']);
});
