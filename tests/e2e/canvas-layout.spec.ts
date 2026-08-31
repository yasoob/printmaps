import { expect, type Locator, test } from '@playwright/test';

const expectNoOverlap = async (first: Locator, second: Locator) => {
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  const isOverlapping = firstBox!.x < secondBox!.x + secondBox!.width
    && firstBox!.x + firstBox!.width > secondBox!.x
    && firstBox!.y < secondBox!.y + secondBox!.height
    && firstBox!.y + firstBox!.height > secondBox!.y;
  expect(isOverlapping).toBe(false);
};

const expectDockContract = async (
  panel: Locator,
  toolbar: Locator,
  canvas: Locator,
  expectedWidth: number,
) => {
  const [panelBox, toolbarBox, canvasBox] = await Promise.all([
    panel.boundingBox(),
    toolbar.boundingBox(),
    canvas.boundingBox(),
  ]);
  expect(panelBox).not.toBeNull();
  expect(toolbarBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  expect(panelBox!.width).toBeCloseTo(expectedWidth, 0);
  expect(panelBox!.x + panelBox!.width / 2).toBeCloseTo(
    canvasBox!.x + canvasBox!.width / 2,
    0,
  );
  expect(toolbarBox!.y - (panelBox!.y + panelBox!.height)).toBeCloseTo(8, 0);
};

const expectPanelStartsAtTop = async (panel: Locator) => {
  const [panelBox, firstVisibleChildBox] = await Promise.all([
    panel.boundingBox(),
    panel.locator(':scope > *:visible').first().boundingBox(),
  ]);
  expect(panelBox).not.toBeNull();
  expect(firstVisibleChildBox).not.toBeNull();
  expect(firstVisibleChildBox!.y - panelBox!.y).toBeLessThanOrEqual(20);
};

test('compact canvas controls stay anchored through every authoring flow', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
    const controls = {
      attribution: page.locator('.maplibregl-ctrl-bottom-left'),
      fit: page.getByRole('button', { name: 'Fit page' }),
      scale: page.locator('.map-scale'),
      zoom: page.locator('.maplibregl-ctrl-bottom-right'),
    };
    const baseline = Object.fromEntries(await Promise.all(
      Object.entries(controls).map(async ([name, locator]) => [name, await locator.boundingBox()]),
    ));
    for (const box of Object.values(baseline)) expect(box).not.toBeNull();

    for (const authoring of [
      { button: 'Place (P)', panel: '.poi-authoring-panel' },
      { button: 'Route (R)', panel: '.route-authoring-panel' },
      { button: 'Area (S)', panel: '.shape-authoring-panel' },
    ]) {
      await page.getByRole('button', { name: authoring.button }).click();
      const panel = page.locator(authoring.panel);
      await expect(panel).toBeVisible();
      for (const [name, locator] of Object.entries(controls)) {
        const before = baseline[name]!;
        const after = await locator.boundingBox();
        expect(after).not.toBeNull();
        expect(after!.x).toBeCloseTo(before!.x, 0);
        expect(after!.y).toBeCloseTo(before!.y, 0);
        await expectNoOverlap(panel, locator);
      }
      const [panelBox, attributionBox, zoomBox] = await Promise.all([
        panel.boundingBox(),
        controls.attribution.boundingBox(),
        controls.zoom.boundingBox(),
      ]);
      expect(panelBox!.x - (attributionBox!.x + attributionBox!.width)).toBeGreaterThanOrEqual(4);
      expect(zoomBox!.x - (panelBox!.x + panelBox!.width)).toBeGreaterThanOrEqual(4);
      await page.getByRole('button', { name: 'Select (V)' }).click();
    }
  }
});

test('Place, Route, and Area share one centered authoring dock contract', async ({ page }, testInfo) => {
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'landscape', width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
    const toolbar = page.locator('.tool-palette');
    const canvas = page.locator('.canvas-region');

    await page.getByRole('button', { name: 'Place (P)' }).click();
    const place = page.locator('.poi-authoring-panel');
    const placeBox = await place.boundingBox();
    expect(placeBox).not.toBeNull();
    await expectDockContract(place, toolbar, canvas, placeBox!.width);
    await expectPanelStartsAtTop(place);
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-place-initial.png`), animations: 'disabled' });
    await page.getByRole('button', { name: 'Paste POI list' }).click();
    const placeMultiple = page.locator('.poi-spreadsheet-panel');
    await expectDockContract(placeMultiple, toolbar, canvas, placeBox!.width);
    await expectPanelStartsAtTop(placeMultiple);
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-place-multiple.png`), animations: 'disabled' });
    await page.getByRole('button', { name: 'Cancel list' }).click();
    await page.getByRole('button', { name: 'Cancel POI' }).click();

    await page.getByRole('button', { name: 'Route (R)' }).click();
    const route = page.locator('.route-authoring-panel');
    await expectDockContract(route, toolbar, canvas, placeBox!.width);
    await expectPanelStartsAtTop(route);
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-route-initial.png`), animations: 'disabled' });
    await page.getByRole('button', { name: 'Select (V)' }).click();

    await page.getByRole('button', { name: 'Area (S)' }).click();
    const area = page.locator('.shape-authoring-panel');
    await expectDockContract(area, toolbar, canvas, placeBox!.width);
    await expectPanelStartsAtTop(area);
    if (viewport.name !== 'landscape') {
      expect(await area.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-area-boundaries.png`), animations: 'disabled' });
    await page.getByRole('tab', { name: 'Draw custom area' }).click();
    await expectDockContract(area, toolbar, canvas, placeBox!.width);
    if (viewport.name !== 'landscape') {
      expect(await area.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-area-draw.png`), animations: 'disabled' });
    await page.getByRole('tab', { name: 'Travel time' }).click();
    await expectDockContract(area, toolbar, canvas, placeBox!.width);
    if (viewport.name !== 'landscape') {
      expect(await area.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-area-travel-time.png`), animations: 'disabled' });
    await page.getByRole('button', { name: 'Select (V)' }).click();
  }
});

test('compact Route stays centered and docked after every drawing transition', async ({ page }, testInfo) => {
  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'landscape', width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Route (R)' }).click();
    const route = page.locator('.route-authoring-panel');
    const toolbar = page.locator('.tool-palette');
    const canvasRegion = page.locator('.canvas-region');
    const initialBox = await route.boundingBox();
    expect(initialBox).not.toBeNull();
    const mapCanvas = page.locator('.maplibregl-canvas');
    const mapBox = await mapCanvas.boundingBox();
    expect(mapBox).not.toBeNull();

    await mapCanvas.click({ position: { x: 100, y: Math.min(250, mapBox!.height - 70) } });
    await expect(route).toHaveAttribute('data-mobile-expanded', 'false');
    await expectDockContract(route, toolbar, canvasRegion, initialBox!.width);
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-route-one-point.png`), animations: 'disabled' });

    await mapCanvas.click({ position: { x: 180, y: Math.min(280, mapBox!.height - 60) } });
    await expect(route).toHaveAttribute('data-mobile-expanded', 'false');
    await expectDockContract(route, toolbar, canvasRegion, initialBox!.width);
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-route-two-points.png`), animations: 'disabled' });

    await page.getByRole('button', { name: 'Show route settings' }).click();
    await expect(route).toHaveAttribute('data-mobile-expanded', 'true');
    await expectDockContract(route, toolbar, canvasRegion, initialBox!.width);
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-route-reopened.png`), animations: 'disabled' });
    await page.getByRole('button', { name: 'Cancel route' }).click();
    await page.getByRole('button', { name: 'Discard changes' }).click();
  }
});

test('desktop Route never exposes the mobile settings toggle', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Route (R)' }).click();
  const mobileSettings = page.getByRole('button', { name: 'Show route settings' });
  await expect(mobileSettings).toBeHidden();
  const mapCanvas = page.locator('.maplibregl-canvas');
  await mapCanvas.click({ position: { x: 40, y: 180 } });
  await expect(mobileSettings).toBeHidden();
});

test('compact attribution disclosure does not collide with the scale', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
    const attribution = page.locator('.maplibregl-ctrl-attrib');
    const scale = page.locator('.canvas-scale-dock');
    await page.locator('.maplibregl-ctrl-attrib-button').click();
    await expect(attribution).toHaveAttribute('open');
    await expect(scale).toBeHidden();
    await page.locator('.maplibregl-ctrl-attrib-button').click();
    await expect(scale).toBeVisible();
  }
});
