import { expect, test, type Page } from '@playwright/test';
import type { ReactScanProbeResult } from '../../src/dev/reactScanProbe';
import { attachInventory, expectOwners, finishProbe, openScanEditor, startProbe, waitForRenderQuiet } from './react-scan-helpers';
import { addCoordinate } from './map-recovery-support';

test.skip(process.env.VITE_REACT_SCAN !== 'true', 'Run with npm run audit:renders.');
test.afterEach(async ({ page }, info) => attachInventory(page, info));

// Shell, inspector and canvas owners that a local primitive interaction must never wake.
const SHELL = ['StudioApp', 'StudioAppView', 'StudioHeader', 'StudioLayers', 'StudioCanvas', 'StudioProperties'];
const INSPECTOR = ['ProjectProperties', 'ProjectStyleSection', 'ProjectDetailsSection', 'ProjectCameraSection', 'StudioTerrainControls'];
const CANVAS = ['CanvasWorkspace', 'CanvasWorkspaceView', 'CanvasWorkspaceChrome', 'MapCanvas', 'LocationSearch', 'MapScale'];

function instances(result: ReactScanProbeResult, component: string) {
  return new Set(result.events.filter((event) => event.component === component).map(({ instanceId }) => instanceId));
}

function labels(result: ReactScanProbeResult, component: string) {
  return new Set(result.events.filter((event) => event.component === component).map(({ controlLabel }) => controlLabel));
}

function openTooltip(page: Page) {
  return page.locator('[data-slot="tooltip-content"][data-open]');
}

test('select open and close stay inside the one select instance', async ({ page }, info) => {
  await openScanEditor(page);
  const trigger = page.getByRole('combobox', { name: 'Map language', exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await startProbe(page, 'Select open');
  await trigger.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  let result = await finishProbe(page, info, 'select-open');
  expectOwners(result, [], [...SHELL, ...INSPECTOR, ...CANVAS, 'SimpleSelect', 'LayerNavigation', 'UndoButton']);
  expect(result.mapMutations).toEqual([]);
  await startProbe(page, 'Select dismiss');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  result = await finishProbe(page, info, 'select-dismiss');
  expectOwners(result, [], [...SHELL, ...INSPECTOR, ...CANVAS, 'SimpleSelect', 'LayerNavigation']);
  expect(result.mapMutations).toEqual([]);
});

test('icon tooltip hover and keyboard focus update only the hovered tooltip', async ({ page }, info) => {
  await openScanEditor(page);
  const tooltip = openTooltip(page);
  await startProbe(page, 'Icon tooltip hover');
  await page.getByRole('button', { name: 'Route (R)', exact: true }).hover();
  await expect(tooltip).toContainText('Route');
  let result = await finishProbe(page, info, 'icon-tooltip-hover');
  expectOwners(result, [], [...SHELL, ...INSPECTOR, ...CANVAS, 'ToolButton', 'IconTooltip', 'UndoButton', 'RedoButton', 'LayerNavigationHeader', 'LayerNavigationRow']);
  expect(instances(result, 'TooltipRoot').size, 'only the hovered tooltip root updates').toBeLessThanOrEqual(1);
  expect(result.domMutations).toEqual([]);
  expect(result.mapMutations).toEqual([]);
  await page.mouse.move(700, 10);
  await expect(tooltip).toHaveCount(0);
  await page.getByRole('button', { name: 'Select (V)', exact: true }).focus();
  await waitForRenderQuiet(page);
  await startProbe(page, 'Icon tooltip keyboard focus');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Place (P)', exact: true })).toBeFocused();
  await expect(tooltip).toContainText('Place');
  result = await finishProbe(page, info, 'icon-tooltip-focus');
  expectOwners(result, [], [...SHELL, ...INSPECTOR, ...CANVAS, 'ToolButton', 'IconTooltip', 'UndoButton', 'LayerNavigationHeader']);
  expect(instances(result, 'TooltipRoot').size).toBeLessThanOrEqual(2);
  expect(result.mapMutations).toEqual([]);
});

test('delegated map control tooltip re-renders only ControlTooltips', async ({ page }, info) => {
  await openScanEditor(page);
  const control = page.locator('.maplibregl-ctrl [data-tooltip]').first();
  await expect(control).toBeVisible();
  await startProbe(page, 'Map control tooltip');
  await control.hover();
  await expect(openTooltip(page)).toBeVisible();
  let result = await finishProbe(page, info, 'control-tooltip-open');
  expectOwners(result, ['ControlTooltips'], [...SHELL, ...INSPECTOR, ...CANVAS, 'IconTooltip', 'ToolButton']);
  expect(result.mapMutations).toEqual([]);
  expect(result.domMutations).toEqual([]);
  await startProbe(page, 'Map control tooltip close');
  await page.mouse.move(700, 10);
  await expect(openTooltip(page)).toHaveCount(0);
  result = await finishProbe(page, info, 'control-tooltip-close');
  expectOwners(result, ['ControlTooltips'], [...SHELL, ...INSPECTOR, ...CANVAS, 'IconTooltip']);
});

test('accordion disclosure mounts only its own section', async ({ page }, info) => {
  await openScanEditor(page);
  const trigger = page.getByRole('button', { name: 'Terrain', exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await startProbe(page, 'Terrain accordion open');
  await trigger.click();
  await expect(page.getByLabel('Show 3D terrain', { exact: true })).toBeVisible();
  const result = await finishProbe(page, info, 'accordion-open');
  expectOwners(result, ['InspectorAccordion', 'ToggleSection'], [...SHELL, ...CANVAS, 'ProjectProperties', 'ProjectStyleSection', 'ProjectDetailsSection', 'ProjectCameraSection']);
  expect(instances(result, 'InspectorAccordion').size, 'sibling accordions stay silent').toBe(1);
  expect(result.mapMutations).toEqual([]);
});

test('toggle section switch mounts only its dependent fields', async ({ page }, info) => {
  await openScanEditor(page);
  await page.getByRole('button', { name: 'Terrain', exact: true }).click();
  await page.getByLabel('Show 3D terrain', { exact: true }).check();
  await waitForRenderQuiet(page);
  await startProbe(page, 'Contours toggle section');
  await page.getByLabel('Show elevation contours', { exact: true }).check();
  await expect(page.getByLabel('Contour line width', { exact: true })).toBeVisible();
  const result = await finishProbe(page, info, 'toggle-section');
  // StudioCanvas is the terrain subscriber that delivers contours to the map; the rest of the shell stays silent.
  expectOwners(result, ['TerrainProperties', 'StudioCanvas', 'MapCanvas'], ['StudioApp', 'StudioAppView', 'StudioHeader', 'StudioLayers', 'StudioProperties', 'ProjectProperties', 'ProjectStyleSection', 'ProjectDetailsSection', 'ProjectCameraSection', 'LocationSearch', 'CanvasWorkspaceChrome']);
  expect(instances(result, 'ToggleSection').size, 'terrain and building sections stay silent').toBe(1);
  expect(labels(result, 'ValidatedNumberField')).not.toContain('Terrain exaggeration');
  expect(result.mapMutations.filter(({ operation }) => ['setData', 'removeSource'].includes(operation))).toEqual([]);
});

test('slider keyboard drag updates one adjustment and the map style only', async ({ page }, info) => {
  await openScanEditor(page);
  await page.getByRole('button', { name: /Customize colors/ }).click();
  const contrast = page.getByRole('slider', { name: 'Contrast' });
  await contrast.focus();
  await waitForRenderQuiet(page);
  await startProbe(page, 'Contrast slider step');
  await contrast.press('ArrowRight');
  const result = await finishProbe(page, info, 'slider-step');
  // Contrast re-derives every token colour, so each colour row legitimately shows a new value.
  expectOwners(result, ['MapStyleCustomizer', 'SemanticColorRow', 'MapCanvas'], ['ProjectDetailsSection', 'ProjectCameraSection', 'StudioTerrainControls', 'LayerNavigation', 'LocationSearch', 'CanvasWorkspaceChrome', 'StudioCompositionControls', 'MobilePanelButton', 'ToolButton']);
  expect(instances(result, 'Slider').size).toBeLessThanOrEqual(2);
  expect(result.mapMutations.filter(({ operation }) => ['setData', 'addLayer', 'removeLayer', 'removeSource'].includes(operation))).toEqual([]);
});

test('segmented control change updates only its owning panel', async ({ page }, info) => {
  await openScanEditor(page);
  await page.getByRole('button', { name: 'Area (S)', exact: true }).click();
  await page.getByRole('tab', { name: 'Travel time', exact: true }).click();
  await waitForRenderQuiet(page);
  await startProbe(page, 'Segmented profile');
  await page.getByRole('radio', { name: 'Cycling', exact: true }).click();
  const result = await finishProbe(page, info, 'segmented-change');
  expectOwners(result, ['IsochronePanel', 'SegmentedControl'], [...SHELL, ...INSPECTOR, 'MapCanvas', 'LocationSearch', 'StudioModeTabs', 'ToolCardHeader', 'ToolButton']);
  expect(instances(result, 'SegmentedControl').size, 'other segmented controls stay silent').toBe(1);
  expect(result.mapMutations).toEqual([]);
});

test('color field commit updates one route color and its source only', async ({ page }, info) => {
  await openScanEditor(page);
  await page.getByRole('button', { name: 'Select Route 01', exact: true }).click();
  const color = page.getByRole('textbox', { name: 'Route color', exact: true });
  await color.scrollIntoViewIfNeeded();
  await page.mouse.move(700, 10);
  await waitForRenderQuiet(page);
  await startProbe(page, 'Route color commit');
  await color.fill('#aa3311');
  await color.press('Enter');
  const result = await finishProbe(page, info, 'color-field');
  expectOwners(result, ['MapCanvas'], [...INSPECTOR, 'LocationSearch', 'CanvasWorkspaceChrome', 'RouteStructureControls', 'RouteMarkerControls', 'StudioCompositionControls', 'LayerNavigationHeader']);
  expect(labels(result, 'ColorField')).toEqual(new Set(['Route color']));
  expect(result.domMutations).toEqual([]);
  expect(result.mapMutations.filter(({ operation }) => ['addLayer', 'removeLayer', 'removeSource', 'addSource'].includes(operation))).toEqual([]);
});

test('file feedback notice appears without waking the editor', async ({ page }, info) => {
  await openScanEditor(page);
  await startProbe(page, 'Invalid project feedback');
  await page.locator('input[accept*=".printmap.json"]').setInputFiles({
    name: 'broken.printmap.json', mimeType: 'application/json', buffer: Buffer.from('{ not json'),
  });
  await expect(page.locator('.file-feedback-notice')).toBeVisible();
  const result = await finishProbe(page, info, 'file-feedback');
  expectOwners(result, ['FileFeedback'], [...INSPECTOR, ...CANVAS, 'StudioApp', 'LayerNavigation', 'UndoButton', 'StudioProjectIdentity']);
  expect(result.mapMutations).toEqual([]);
});

test('inspector tab switch leaves canvas, layers and header silent', async ({ page }, info) => {
  await openScanEditor(page);
  await startProbe(page, 'Layout tab');
  await page.getByRole('tab', { name: 'Layout' }).click();
  await expect(page.getByRole('combobox', { name: 'Page preset' })).toBeVisible();
  let result = await finishProbe(page, info, 'tab-layout');
  expectOwners(result, ['StudioModeTabs', 'ProjectProperties'], [...SHELL, ...CANVAS, 'LayerNavigation', 'UndoButton', 'StudioTerrainControls']);
  expect(result.mapMutations).toEqual([]);
  await startProbe(page, 'Map tab');
  await page.getByRole('tab', { name: 'Map', exact: true }).click();
  result = await finishProbe(page, info, 'tab-map');
  expectOwners(result, ['StudioModeTabs', 'ProjectProperties'], [...SHELL, ...CANVAS, 'LayerNavigation', 'StudioCompositionControls', 'PageDimensions']);
  expect(result.mapMutations).toEqual([]);
});

test('export dialog open, preview, format change and close keep the editor silent', async ({ page }, info) => {
  test.setTimeout(60_000);
  await openScanEditor(page);
  await startProbe(page, 'Export open');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map', exact: true });
  await expect(dialog.getByRole('img', { name: 'Preview of your poster' })).toBeVisible({ timeout: 20_000 });
  await waitForRenderQuiet(page);
  let result = await finishProbe(page, info, 'export-open');
  expectOwners(result, ['ExportPreviewPane'], [...INSPECTOR, 'CanvasWorkspaceChrome', 'LocationSearch', 'LayerNavigation', 'UndoButton', 'StudioProjectIdentity']);
  expect(result.mapMutations.filter(({ operation, surface }) => surface === 'editor' && ['setData', 'addLayer', 'removeLayer'].includes(operation))).toEqual([]);
  await startProbe(page, 'Export format');
  await dialog.getByRole('radio', { name: /Layered SVG/ }).click();
  result = await finishProbe(page, info, 'export-format');
  expectOwners(result, ['ExportDialogView'], [...SHELL, ...INSPECTOR, ...CANVAS, 'LayerNavigation', 'ExportPreviewPane', 'StudioModeTabs']);
  expect(result.mapMutations).toEqual([]);
  await startProbe(page, 'Export close');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  result = await finishProbe(page, info, 'export-close');
  expectOwners(result, [], [...INSPECTOR, 'CanvasWorkspaceChrome', 'LocationSearch', 'LayerNavigation', 'MapCanvas', 'UndoButton', 'StudioProjectIdentity']);
  expect(result.mapMutations).toEqual([]);
});

test('pending route draft shows the header hint without waking project identity or history', async ({ page }, info) => {
  await openScanEditor(page);
  await page.getByRole('button', { name: 'Route (R)', exact: true }).click();
  await expect(page.locator('.header-blocked-hint')).toHaveCount(0);
  await waitForRenderQuiet(page);
  await startProbe(page, 'Pending draft hint');
  await addCoordinate(page, 'route', '16.35', '48.2');
  await expect(page.locator('.header-blocked-hint')).toBeVisible();
  let result = await finishProbe(page, info, 'pending-draft-hint');
  expectOwners(result, ['StudioHeader'], ['StudioProjectIdentity', 'UndoButton', 'RedoButton', 'ProjectProperties', 'LayerNavigation', 'LocationSearch', 'ToolButton']);
  await startProbe(page, 'Second draft point');
  await addCoordinate(page, 'route', '16.4', '48.22');
  result = await finishProbe(page, info, 'second-draft-point');
  expectOwners(result, ['RouteDrawingPanel'], ['StudioHeader', 'StudioProjectIdentity', 'UndoButton', 'ProjectProperties', 'LayerNavigation', 'LocationSearch', 'ToolButton', 'ToolCardHeader']);
});

test.describe('docked mobile scale', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('pan updates the docked scale without the panel buttons', async ({ page }, info) => {
    await openScanEditor(page);
    const canvas = await page.locator('.maplibregl-canvas').boundingBox();
    if (!canvas) throw new Error('Map canvas has no dimensions.');
    const scale = page.locator('.map-scale').first();
    await expect(scale).toBeVisible();
    const map = page.getByTestId('map-canvas');
    const center = await map.getAttribute('data-map-center');
    // Start on empty map above the print frame, away from layers and the docked controls.
    const start = { x: canvas.x + canvas.width / 2, y: canvas.y + 160 };
    await startProbe(page, 'Mobile pan');
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 50, start.y + 40, { steps: 5 });
    await page.mouse.up();
    await expect(map).not.toHaveAttribute('data-map-center', center!);
    await waitForRenderQuiet(page);
    const result = await finishProbe(page, info, 'mobile-pan');
    expectOwners(result, ['MapCanvas', 'MapScale'], ['ProjectProperties', 'LayerNavigation', 'CanvasWorkspaceChrome', 'MobilePanelButton', 'ToolButton', 'StudioProjectIdentity', 'RedoButton']);
    expect(result.domMutations).toEqual([]);
  });
});

test('wheel zoom updates camera owners only', async ({ page }, info) => {
  await openScanEditor(page);
  const canvas = await page.locator('.maplibregl-canvas').boundingBox();
  if (!canvas) throw new Error('Map canvas has no dimensions.');
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  const map = page.getByTestId('map-canvas');
  const zoom = await map.getAttribute('data-map-zoom');
  await startProbe(page, 'Wheel zoom');
  await page.mouse.wheel(0, -480);
  await expect(map).not.toHaveAttribute('data-map-zoom', zoom!);
  await waitForRenderQuiet(page);
  const result = await finishProbe(page, info, 'wheel-zoom');
  expectOwners(result, ['MapCanvas', 'MapScale'], [...INSPECTOR, 'LayerNavigation', 'CanvasWorkspaceChrome', 'MobilePanelButton', 'ToolButton', 'StudioProjectIdentity', 'RedoButton', 'StudioCompositionControls']);
  expect(result.domMutations).toEqual([]);
  expect(result.mapMutations.filter(({ operation }) => ['setData', 'addLayer', 'removeLayer', 'removeSource'].includes(operation))).toEqual([]);
});

test('basemap selection and shape vertex disclosure mount their inspector sections', async ({ page }, info) => {
  await openScanEditor(page);
  await startProbe(page, 'Basemap selection');
  await page.getByRole('button', { name: 'Select Paper basemap', exact: true }).click();
  let result = await finishProbe(page, info, 'basemap-selection');
  expectOwners(result, ['BasemapDesignSection'], ['LocationSearch', 'CanvasWorkspaceChrome', 'StudioCompositionControls']);
  expect(result.mapMutations.filter(({ operation }) => ['setData', 'addLayer', 'removeLayer'].includes(operation))).toEqual([]);
  await page.getByRole('button', { name: 'Select City center', exact: true }).click();
  await page.mouse.move(700, 10);
  await startProbe(page, 'Shape vertices disclosure');
  await page.getByRole('button', { name: /^Vertices/ }).click();
  result = await finishProbe(page, info, 'shape-vertices');
  expectOwners(result, ['ShapeVertexControls'], ['MapCanvas', 'LocationSearch', 'ShapeAppearanceControls', 'LayerNavigation']);
  expect(result.mapMutations).toEqual([]);
});

test('template gallery dialog opens and closes without the editor', async ({ page }, info) => {
  await openScanEditor(page);
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await startProbe(page, 'Template gallery open');
  await page.getByRole('menuitem', { name: 'New from template', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  let result = await finishProbe(page, info, 'template-open');
  expectOwners(result, ['NewProjectTemplateDialog', 'TemplateGallery'], [...INSPECTOR, 'CanvasWorkspaceChrome', 'MapCanvas', 'LayerNavigation', 'UndoButton']);
  expect(result.mapMutations).toEqual([]);
  await startProbe(page, 'Template gallery close');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  result = await finishProbe(page, info, 'template-close');
  expectOwners(result, [], [...INSPECTOR, 'MapCanvas', 'LayerNavigation', 'UndoButton']);
  expect(result.mapMutations).toEqual([]);
});
