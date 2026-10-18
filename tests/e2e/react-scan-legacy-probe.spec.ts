import { expect, test } from '@playwright/test';
import { attachInventory, expectOwners, finishProbe, openScanEditor, startProbe, waitForRenderQuiet } from './react-scan-helpers';
import { installDirectionsMock, openAdvanced } from './advanced-route-test-support';
import { chooseOption } from './select-support';
import type { ReactScanProbeResult } from '../../src/dev/reactScanProbe';

test.skip(process.env.VITE_REACT_SCAN !== 'true', 'Run with npm run audit:renders.');
test.afterEach(async ({ page }, info) => attachInventory(page, info));

const chrome = ['LocationSearch', 'CanvasWorkspaceChrome', 'StudioHeader', 'StudioVideoControls'];

for (const setting of [
  { label: 'Bearing', value: '25', select: false },
  { label: 'Pitch', value: '15', select: false },
  { label: 'Map language', value: 'German', select: true },
  { label: 'Text scale', value: '125', select: false },
  { label: 'Page width', value: '310', select: false },
]) {
  test(`${setting.label} commit isolates unrelated project sections`, async ({ page }, info) => {
    await openScanEditor(page);
    if (setting.label === 'Page width') await page.getByRole('tab', { name: 'Layout' }).click();
    const input = page.getByLabel(setting.label, { exact: true });
    await startProbe(page, setting.label);
    if (setting.select) await chooseOption(page, setting.label, setting.value);
    else { await input.fill(setting.value); await input.press('Enter'); }
    const result = await finishProbe(page, info, `project-${setting.label}`);
    expectOwners(result, ['MapCanvas', setting.label === 'Page width' ? 'PageDimensions' : 'ProjectProperties'], [
      ...chrome, 'PosterControls', 'PhotoStoryControls', 'StudioModeTabs',
      ...(setting.label === 'Pitch' ? [] : ['DecorationControls']),
      ...(['Bearing', 'Pitch', 'Page width'].includes(setting.label) ? ['MapStyleGallery'] : []),
    ]);
    if (setting.label === 'Pitch') expect(result.components.DecorationControls).toBeUndefined();
    expect(result.domMutations).toEqual([]);
    expect(result.mapMutations.filter(({ operation }) => ['setData', 'addLayer', 'removeLayer', 'removeSource'].includes(operation))).toEqual([]);
    // Closed select popups and help tooltips must not re-render with their owners.
    if (!setting.select) expect(result.events.filter(({ component, phase }) => ['SelectContent', 'SelectPortal'].includes(component) && phase === 'update')).toEqual([]);
    expect(result.components.FeatureHelp).toBeUndefined();
  });
}

test('layer visibility lock and reorder keep unselected inspector and search isolated', async ({ page }, info) => {
  await openScanEditor(page);
  for (const [label, action] of [
    ['visibility', async () => page.getByRole('button', { name: 'Hide Coffee stop', exact: true }).click()],
    ['lock', async () => page.getByRole('button', { name: 'Lock Coffee stop', exact: true }).click()],
    ['reorder', async () => page.getByRole('button', { name: 'Reorder Coffee stop', exact: true }).press('Alt+ArrowUp')],
  ] as const) {
    await page.mouse.move(700, 10);
    await startProbe(page, `Layer ${label}`);
    await action();
    const result = await finishProbe(page, info, `layer-${label}`);
    expectOwners(result, ['LayerNavigationRow'], [...chrome, 'ProjectProperties', 'StudioCompositionControls', 'StudioTerrainControls',
      'LayerNavigationHeader', 'LayerNavigationHelp', 'FeatureHelp', 'MobilePanelButton', 'ToolButton']);
    if (label === 'lock') expect(result.mapMutations.filter(({ operation }) => ['setData', 'addLayer', 'removeLayer'].includes(operation))).toEqual([]);
  }
});

test('project menu rename dialog and focus stay outside renderer', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openScanEditor(page);
  await startProbe(page, 'Project menu');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  let result = await finishProbe(page, info, 'project-menu');
  expectOwners(result, ['ProjectFileActions'], ['CanvasWorkspace', 'MapCanvas', 'ProjectProperties']);
  await page.getByRole('menuitem', { name: 'Rename project', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await startProbe(page, 'Rename dialog draft');
  await page.getByRole('dialog').getByRole('textbox').fill('Local dialog draft');
  result = await finishProbe(page, info, 'rename-draft');
  expectOwners(result, ['ProjectRenameDialog'], ['MapCanvas', 'ProjectProperties', 'StudioProjectIdentity']);
  expect(result.mapMutations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeFocused();
});

test('search typing results and selection do not wake inactive authoring or inspectors', async ({ page }, info) => {
  let release: (() => void) | undefined;
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', async (route) => {
    await new Promise<void>((resolve) => { release = resolve; });
    await route.fulfill({ json: {
    type: 'FeatureCollection', features: [{ id: 'test-place', type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.38, 48.21] },
      properties: { full_address: 'Audit place, Vienna' } }],
    } });
  });
  await openScanEditor(page);
  const input = page.getByRole('combobox', { name: 'Search places and addresses' });
  await startProbe(page, 'Search typing');
  await input.fill('Audit place');
  let result = await finishProbe(page, info, 'search-type');
  expectOwners(result, ['LocationSearch'], ['MapCanvas', 'ProjectProperties', 'LayerNavigation', 'PoiAuthoringControls']);
  expect(result.mapMutations).toEqual([]);
  await expect.poll(() => Boolean(release)).toBe(true);
  await startProbe(page, 'Search response');
  release!();
  await expect(page.getByRole('option', { name: 'Audit place, Vienna' })).toBeVisible();
  result = await finishProbe(page, info, 'search-response');
  expectOwners(result, ['LocationSearchResults'], ['MapCanvas', 'ProjectProperties', 'LayerNavigation', 'PoiAuthoringControls']);
  await startProbe(page, 'Search select');
  await page.getByRole('option', { name: 'Audit place, Vienna' }).click();
  await waitForRenderQuiet(page);
  result = await finishProbe(page, info, 'search-select');
  expectOwners(result, ['LocationSearch'], ['ProjectProperties', 'StudioCompositionControls', 'StudioTerrainControls', 'StudioVideoControls']);
});

function toolButtonLabels(result: ReactScanProbeResult) {
  return new Set(result.events.filter(({ component }) => component === 'ToolButton').map(({ instanceId }) => instanceId));
}

for (const tool of ['Place (P)', 'Route (R)', 'Area (S)']) {
  // StudioCompositionControls lives on the Layout tab; the blocked reason reaches it through context only.
  test(`${tool} activation and cancellation preserve inactive domains`, async ({ page }, info) => {
    await openScanEditor(page);
    await page.getByRole('tab', { name: 'Layout' }).click();
    await startProbe(page, `Activate ${tool}`);
    await page.getByRole('button', { name: tool, exact: true }).click();
    await expect(page.getByText('Finish or cancel the current drawing first.', { exact: true })).toBeVisible();
    let result = await finishProbe(page, info, 'tool-activate');
    expectOwners(result, ['CanvasWorkspace', 'CanvasWorkspaceChrome', 'StudioCompositionControls'], [
      'ProjectProperties', 'PageDimensions', 'PageAppearance', 'PosterControls', 'PhotoStoryControls', 'DecorationControls',
      'LayerNavigation', 'LayerNavigationHeader', 'LocationSearch', 'UndoButton', 'RedoButton', 'MobilePanelButton',
    ]);
    // The Area card mounts its own source tabs; the inspector's Map/Layout tabs must not update.
    expect(result.events.filter(({ component, ownerPath }) => component === 'StudioModeTabs' && ownerPath.includes('ProjectProperties'))).toEqual([]);
    expect(result.components.StudioCompositionControls.changes.filter((change) => change.startsWith('props:'))).toEqual([]);
    expect(toolButtonLabels(result).size, 'only the previous and next tool buttons update').toBe(2);
    await startProbe(page, `Cancel ${tool}`);
    if (tool === 'Place (P)') await page.getByRole('button', { name: 'Cancel POI', exact: true }).click();
    else await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Select (V)' })).toHaveAttribute('aria-pressed', 'true');
    result = await finishProbe(page, info, 'tool-cancel');
    expectOwners(result, ['CanvasWorkspace', 'StudioCompositionControls'], [
      'ProjectProperties', 'PosterControls', 'PhotoStoryControls', 'DecorationControls', 'LayerNavigationHeader',
    ]);
    expect(toolButtonLabels(result).size).toBe(2);
  });
}

test('tool activation on the Map tab leaves the whole project inspector silent', async ({ page }, info) => {
  await openScanEditor(page);
  await startProbe(page, 'Activate Place on Map tab');
  await page.getByRole('button', { name: 'Place (P)', exact: true }).click();
  const result = await finishProbe(page, info, 'tool-activate-map-tab');
  expectOwners(result, ['CanvasWorkspaceChrome', 'PoiAuthoringControls'], [
    'ProjectProperties', 'StudioTerrainControls', 'TerrainProperties', 'ProjectStyleSection', 'ProjectCameraSection',
    'ProjectDetailsSection', 'StudioCompositionControls', 'LayerNavigationHeader', 'LocationSearch',
  ]);
  expect(result.mapMutations).toEqual([]);
});

test('route advanced disclosure and async elevation stay within route owners', async ({ page }, info) => {
  await page.route('https://api.open-meteo.com/v1/elevation**', async (route) => {
    const count = new URL(route.request().url()).searchParams.get('latitude')!.split(',').length;
    await route.fulfill({ json: { elevation: Array.from({ length: count }, (_, index) => 160 + index * 3) } });
  });
  await openScanEditor(page);
  await page.getByRole('button', { name: 'Select Route 01', exact: true }).click();
  await page.mouse.move(700, 10);
  await startProbe(page, 'Route advanced disclosure');
  await openAdvanced(page);
  let result = await finishProbe(page, info, 'route-advanced');
  expectOwners(result, ['InspectorAccordion', 'RouteStructureControls'], ['MapCanvas', 'StudioApp', 'LayerNavigation']);
  await startProbe(page, 'Generate elevation');
  await page.getByRole('button', { name: 'Generate elevation profile', exact: true }).click();
  await expect(page.getByRole('img', { name: /elevation profile/ })).toBeVisible();
  result = await finishProbe(page, info, 'elevation-success');
  expectOwners(result, ['ElevationProfilePanel'], ['MapCanvas', 'StudioApp', 'LayerNavigation', 'RouteAppearanceControls', 'RouteMarkerControls']);
  expect(result.mapMutations).toEqual([]);
  await startProbe(page, 'Elevation settle');
  await page.waitForTimeout(700);
  result = await finishProbe(page, info, 'elevation-settle');
  expect(result.components).toEqual({});
});

test('directions conversion failure retry and cancellation retain map and static route controls', async ({ page }, info) => {
  test.setTimeout(60_000);
  const directions = await installDirectionsMock(page);
  directions.setMode('fail');
  await openScanEditor(page);
  await page.getByRole('button', { name: 'Select Route 01', exact: true }).click();
  await openAdvanced(page);
  await chooseOption(page, 'Convert route to', 'Road');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await startProbe(page, 'Directions failure');
  await page.getByRole('button', { name: 'Route and apply', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
  let result = await finishProbe(page, info, 'directions-failure');
  expectOwners(result, ['RouteStructureControls'], ['MapCanvas', 'RouteAppearanceControls', 'RouteMarkerControls', 'LayerNavigation', 'RouteCloseReason']);
  expect(result.mapMutations).toEqual([]);
  directions.setMode('success');
  await startProbe(page, 'Directions retry');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Mapbox Directions', { exact: true })).toBeVisible();
  result = await finishProbe(page, info, 'directions-retry');
  expectOwners(result, ['MapCanvas', 'DirectionsProvenanceSummary'], ['LocationSearch', 'StudioCompositionControls', 'StudioTerrainControls']);
});
