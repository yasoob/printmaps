import { expect, test } from '@playwright/test';
import { attachInventory, expectOwners, finishProbe, openScanEditor, startProbe, waitForRenderQuiet } from './react-scan-helpers';
import { convertRoute, installDirectionsMock, openAdvanced } from './advanced-route-test-support';

test.skip(process.env.VITE_REACT_SCAN !== 'true', 'Run with npm run audit:renders.');
test.afterEach(async ({ page }, info) => attachInventory(page, info));

test('pan fit and geolocation change only native camera and semantic consumers', async ({ page, context }, info) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ longitude: 16.4, latitude: 48.22 });
  await openScanEditor(page);
  const map = page.getByTestId('map-canvas');
  const canvas = await page.locator('.maplibregl-canvas').boundingBox();
  if (!canvas) throw new Error('Map canvas has no dimensions.');
  const center = await map.getAttribute('data-map-center');
  await startProbe(page, 'Editor pan');
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width / 2 + 60, canvas.y + canvas.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  await expect(map).not.toHaveAttribute('data-map-center', center!);
  await waitForRenderQuiet(page);
  let result = await finishProbe(page, info, 'editor-pan');
  expectOwners(result, ['MapCanvas', 'MapScale'], ['ProjectProperties', 'CanvasWorkspaceChrome', 'LayerNavigation', 'StudioCompositionControls', 'LocationSearchResults']);
  expect(result.domMutations).toEqual([]);
  await startProbe(page, 'Fit page');
  await page.getByRole('button', { name: 'Fit page', exact: true }).click();
  await waitForRenderQuiet(page);
  result = await finishProbe(page, info, 'fit-page');
  expectOwners(result, ['MapCanvas'], ['ProjectProperties', 'LayerNavigation', 'StudioCompositionControls']);
  await startProbe(page, 'Geolocation');
  await page.getByRole('button', { name: 'Use my location', exact: true }).click();
  await expect(page.getByText('Map centered on your current location.', { exact: true })).toBeVisible();
  result = await finishProbe(page, info, 'geolocation');
  expectOwners(result, ['GeolocationControl', 'MapCanvas'], ['PageDimensions', 'ProjectStyleSection', 'StudioCompositionControls', 'LayerNavigation']);
});

test('map detail visibility and style reload leave composition controls and unrelated renderer data stable', async ({ page }, info) => {
  await openScanEditor(page);
  await startProbe(page, 'Basemap road visibility');
  await page.getByRole('checkbox', { name: 'Show roads', exact: true }).uncheck();
  let result = await finishProbe(page, info, 'road-visibility');
  expectOwners(result, ['ProjectDetailsSection', 'MapCanvas'], ['PageDimensions', 'ProjectCameraSection', 'MapStyleGallery', 'StudioCompositionControls']);
  expect(result.mapMutations.filter(({ operation }) => ['setData', 'addLayer', 'removeLayer', 'removeSource'].includes(operation))).toEqual([]);
  await startProbe(page, 'Map style reload');
  await page.getByRole('radio', { name: /^Graphite:/ }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true');
  result = await finishProbe(page, info, 'style-reload');
  expectOwners(result, ['MapCanvas', 'MapStyleGallery'], ['StudioCompositionControls', 'StudioVideoControls', 'PageDimensions', 'ProjectCameraSection']);
});

test('route topology curvature and directions cancellation preserve unrelated sources and controls', async ({ page }, info) => {
  const directions = await installDirectionsMock(page);
  await openScanEditor(page);
  await page.getByRole('button', { name: 'Select Route 01', exact: true }).click();
  await openAdvanced(page);
  await convertRoute(page, 'arc');
  await page.mouse.move(700, 10);
  await startProbe(page, 'Arc curvature');
  const curvature = page.getByLabel('Arc curvature amount', { exact: true });
  await curvature.fill('0.4');
  await curvature.press('Tab');
  let result = await finishProbe(page, info, 'arc-curvature');
  expectOwners(result, ['MapCanvas', 'ArcCurvatureControls'], ['PoiAppearanceControls', 'ShapeVertexControls', 'StudioCompositionControls']);
  expect(result.mapMutations.filter(({ operation, target }) => operation === 'setData' && target?.includes('studio-source-') && !target.includes('route-01'))).toEqual([]);
  for (const action of ['Insert route anchor after selected', 'Remove selected route anchor']) {
    await startProbe(page, action);
    await page.getByRole('button', { name: action, exact: true }).click();
    result = await finishProbe(page, info, action);
    expectOwners(result, ['MapCanvas', 'RouteVertexControls'], ['LocationSearch', 'PoiAppearanceControls', 'StudioCompositionControls']);
  }
  await convertRoute(page, 'straight');
  directions.setMode('hold');
  await page.getByRole('combobox', { name: 'Convert route to' }).selectOption('road');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await page.getByRole('button', { name: 'Route and apply', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel routing', exact: true })).toBeVisible();
  await startProbe(page, 'Cancel directions request');
  await page.getByRole('button', { name: 'Cancel routing', exact: true }).click();
  directions.release();
  result = await finishProbe(page, info, 'directions-cancel');
  expectOwners(result, ['RouteStructureControls'], ['MapCanvas', 'RouteAppearanceControls', 'LayerNavigation']);
  expect(result.mapMutations).toEqual([]);
  const geometry = await page.getByTestId('map-canvas').getAttribute('data-map-layer-geometry');
  await startProbe(page, 'Route extension activation');
  await page.getByRole('button', { name: 'Extend end', exact: true }).click();
  result = await finishProbe(page, info, 'route-extension');
  expectOwners(result, ['RouteDrawingPanel', 'MapCanvas'], ['PoiAuthoringControls', 'ShapeDrawingPanel', 'StudioPosterPreview']);
  await page.getByRole('button', { name: 'Cancel route', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select (V)', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', geometry!);
});

test('map matching success and subsequent geometry edit invalidate only owned provenance and data', async ({ page }, info) => {
  await page.route('https://api.mapbox.com/matching/v5/mapbox/driving/**', (route) => route.fulfill({ json: {
    code: 'Ok',
    matchings: [{ confidence: 0.93, geometry: { type: 'LineString', coordinates: [[16.3261, 48.1941], [16.34, 48.201], [16.36, 48.21], [16.4, 48.219], [16.4291, 48.2261]] } }],
    tracepoints: [0, 1, 2, 3].map((index) => ({ matchings_index: 0, waypoint_index: index })),
  } }));
  await openScanEditor(page);
  await page.getByRole('button', { name: 'Select Route 01', exact: true }).click();
  await openAdvanced(page);
  await page.mouse.move(700, 10);
  await startProbe(page, 'Map matching success');
  await page.getByRole('button', { name: 'Snap route to roads', exact: true }).click();
  await expect(page.getByText('Matched to roads · 93% confidence · 4 source points')).toBeVisible();
  let result = await finishProbe(page, info, 'matching-success');
  expectOwners(result, ['RouteMapMatchingControl', 'MapCanvas'], ['LocationSearch', 'StudioCompositionControls', 'PoiAppearanceControls', 'ShapeVertexControls']);
  const marker = page.getByRole('button', { name: 'Drag route anchor 2', exact: true });
  await marker.focus();
  await startProbe(page, 'Edit matched geometry');
  await marker.press('ArrowRight');
  await expect(page.getByText('Matched to roads · 93% confidence · 4 source points')).toHaveCount(0);
  result = await finishProbe(page, info, 'matching-provenance-invalidation');
  expectOwners(result, ['RouteMapMatchingControl', 'MapCanvas'], ['LocationSearch', 'StudioCompositionControls', 'PoiAppearanceControls', 'DirectionsProvenanceSummary', 'RouteOperationStatus', 'RouteCloseReason']);
  expect(result.domMutations).toEqual([]);
  expect(result.mapMutations.filter(({ operation, target }) => operation === 'setData' && target?.includes('studio-source-') && !target.includes('route-01'))).toEqual([]);
});
