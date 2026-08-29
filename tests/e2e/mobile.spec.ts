import { expect, type Locator, type Page, test } from '@playwright/test';

const setSafeAreaInsets = async (page: Page) => {
  await page.evaluate(() => {
    const root = document.documentElement.style;
    root.setProperty('--studio-safe-top', '20px');
    root.setProperty('--studio-safe-bottom', '24px');
    root.setProperty('--studio-safe-left', '16px');
    root.setProperty('--studio-safe-right', '12px');
  });
};

const clearSafeAreaInsets = async (page: Page) => {
  await page.evaluate(() => {
    const root = document.documentElement.style;
    root.removeProperty('--studio-safe-top');
    root.removeProperty('--studio-safe-bottom');
    root.removeProperty('--studio-safe-left');
    root.removeProperty('--studio-safe-right');
  });
};

const verifyMapAttribution = async (
  page: Page,
  toolbar: Locator,
  initialToolbarBox: NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>,
) => {
  const attribution = page.locator('.maplibregl-ctrl-attrib');
  const attributionButton = page.locator('.maplibregl-ctrl-attrib-button');
  await expect(attribution).not.toHaveAttribute('open');
  await expect(attribution).not.toHaveClass(/maplibregl-compact-show/);
  const buttonBox = await attributionButton.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(buttonBox!.width).toBeGreaterThanOrEqual(24);
  expect(buttonBox!.height).toBeGreaterThanOrEqual(24);
  const buttonStyle = await attributionButton.evaluate((element) => ({
    size: getComputedStyle(element).backgroundSize,
    repeat: getComputedStyle(element).backgroundRepeat,
    position: getComputedStyle(element).backgroundPosition,
  }));
  expect(buttonStyle).toEqual({ size: '8px 8px', repeat: 'no-repeat', position: '50% 50%' });

  await attributionButton.click();
  await expect(attribution).toHaveAttribute('open');
  await expect(attribution).toHaveClass(/maplibregl-compact-show/);
  let expandedBox = await attribution.boundingBox();
  expect(expandedBox).not.toBeNull();
  expect(expandedBox!.y + expandedBox!.height).toBeLessThanOrEqual(initialToolbarBox.y);

  await attributionButton.click();
  await expect(attribution).not.toHaveAttribute('open');
  await expect(attribution).not.toHaveClass(/maplibregl-compact-show/);

  await setSafeAreaInsets(page);
  const toolbarBox = await toolbar.boundingBox();
  const topbarBox = await page.locator('.topbar').boundingBox();
  const exportBox = await page.getByRole('button', { name: 'Export' }).boundingBox();
  const mobileActionsBox = await page.locator('.mobile-panel-actions').boundingBox();
  expect(topbarBox).not.toBeNull();
  expect(exportBox).not.toBeNull();
  expect(mobileActionsBox).not.toBeNull();
  expect(topbarBox!.height).toBeGreaterThanOrEqual(64);
  expect(exportBox!.y).toBeGreaterThanOrEqual(20);
  expect(exportBox!.x + exportBox!.width).toBeLessThanOrEqual(378);
  expect(mobileActionsBox!.x).toBeGreaterThanOrEqual(24);
  expect(toolbarBox!.x).toBeGreaterThanOrEqual(24);
  expect(toolbarBox!.x + toolbarBox!.width).toBeLessThanOrEqual(370);
  await attributionButton.click();
  expandedBox = await attribution.boundingBox();
  expect(toolbarBox).not.toBeNull();
  expect(expandedBox).not.toBeNull();
  expect(expandedBox!.y + expandedBox!.height).toBeLessThanOrEqual(toolbarBox!.y);
  await attributionButton.click();
  await expect(attribution).not.toHaveAttribute('open');
  await expect(attribution).not.toHaveClass(/maplibregl-compact-show/);
  await clearSafeAreaInsets(page);

  const mapCanvas = page.locator('.maplibregl-canvas');
  const mapBox = await mapCanvas.boundingBox();
  expect(mapBox).not.toBeNull();
  await attributionButton.click();
  await expect(attribution).toHaveAttribute('open');
  await page.mouse.move(mapBox!.x + mapBox!.width / 2, mapBox!.y + mapBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(mapBox!.x + mapBox!.width / 2 + 32, mapBox!.y + mapBox!.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(attribution).not.toHaveAttribute('open');
  await expect(attribution).not.toHaveClass(/maplibregl-compact-show/);
  await attributionButton.click();
  await expect(attribution).toHaveAttribute('open');
  await expect(attribution).toHaveClass(/maplibregl-compact-show/);
  await attributionButton.click();
};

const verifyMobileDrawers = async (page: Page) => {
  const layersButton = page.getByRole('button', { name: 'Open layers' });
  const propertiesButton = page.getByRole('button', { name: 'Open properties' });
  await setSafeAreaInsets(page);
  await layersButton.click();
  const layersDialog = page.getByRole('dialog', { name: 'Layers sidebar' });
  const closeLayers = page.getByRole('button', { name: 'Close layers' });
  await expect(layersDialog).toBeVisible();
  await expect(layersButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.topbar')).toHaveAttribute('inert');
  await expect(page.locator('.canvas-region')).toHaveAttribute('inert');
  await expect(page.locator('#properties-panel')).toHaveAttribute('inert');
  await expect.poll(async () => {
    const bounds = await layersDialog.boundingBox();
    return bounds?.x ?? -999;
  }).toBeGreaterThanOrEqual(16);
  const safeDrawerBox = await layersDialog.boundingBox();
  expect(safeDrawerBox).not.toBeNull();
  expect(safeDrawerBox!.y).toBeGreaterThanOrEqual(64);
  expect(safeDrawerBox!.y + safeDrawerBox!.height).toBeLessThanOrEqual(820);
  await clearSafeAreaInsets(page);
  await expect(closeLayers).toBeFocused();
  await closeLayers.press('Shift+Tab');
  await expect(layersDialog.locator('button:not([disabled]), input:not([disabled]), select:not([disabled])').last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(closeLayers).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(layersDialog).not.toBeVisible();
  await expect(layersButton).toBeFocused();

  await layersButton.click();
  await page.getByRole('button', { name: 'Close open panel' }).click({ position: { x: 385, y: 400 } });
  await expect(layersDialog).not.toBeVisible();
  await expect(layersButton).toBeFocused();

  await layersButton.click();
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await expect(layersDialog).not.toBeVisible();
  await expect(layersButton).toBeFocused();

  await propertiesButton.click();
  const propertiesDialog = page.getByRole('dialog', { name: 'Properties sidebar' });
  const closeProperties = page.getByRole('button', { name: 'Close properties' });
  await expect(propertiesDialog).toBeVisible();
  await expect(propertiesButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.topbar')).toHaveAttribute('inert');
  await expect(page.locator('.canvas-region')).toHaveAttribute('inert');
  await expect(page.locator('#layers-panel')).toHaveAttribute('inert');
  await expect(closeProperties).toBeFocused();
  await page.getByRole('button', { name: 'Layer menu' }).click();
  await page.getByRole('menuitem', { name: 'Duplicate layer' }).click();
  await expect(page.getByRole('heading', { name: 'Route 01 copy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Layer menu' })).toBeFocused();
  await page.getByRole('button', { name: 'Layer menu' }).click();
  await page.getByRole('menuitem', { name: 'Delete layer' }).click();
  const projectHeading = page.getByRole('heading', { name: 'Project' });
  await expect(projectHeading).toBeVisible();
  await expect(projectHeading).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(propertiesDialog).not.toBeVisible();
  await expect(propertiesButton).toBeFocused();
};

const verifyResponsiveTransitions = async (page: Page, toolbar: Locator, mapReady: Locator) => {
  const layersButton = page.getByRole('button', { name: 'Open layers' });
  await page.setViewportSize({ width: 320, height: 844 });
  const narrowMetrics = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(narrowMetrics.body).toBeLessThanOrEqual(narrowMetrics.viewport);
  const narrowToolbarBox = await toolbar.boundingBox();
  expect(narrowToolbarBox).not.toBeNull();
  expect(narrowToolbarBox!.x).toBeGreaterThanOrEqual(8);
  expect(narrowToolbarBox!.x + narrowToolbarBox!.width).toBeLessThanOrEqual(312);

  await layersButton.click();
  await expect(page.getByRole('dialog', { name: 'Layers sidebar' })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopLayers = page.locator('#layers-panel');
  await expect(desktopLayers).toBeVisible();
  await expect(desktopLayers).not.toHaveAttribute('role');
  await expect(desktopLayers).not.toHaveAttribute('aria-modal');
  await expect(desktopLayers).not.toHaveClass(/is-mobile-open/);
  await expect(page.locator('.topbar')).not.toHaveAttribute('inert');
  await expect(page.locator('.canvas-region')).not.toHaveAttribute('inert');
  await expect(page.getByRole('button', { name: 'Vienna field guide' })).toBeFocused();

  if (await mapReady.isVisible()) {
    const attribution = page.locator('.maplibregl-ctrl-attrib');
    const attributionButton = page.locator('.maplibregl-ctrl-attrib-button');
    await expect(attribution).toHaveAttribute('open');
    await expect(attribution).toHaveClass(/maplibregl-compact-show/);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(attribution).not.toHaveAttribute('open');
    await expect(attribution).not.toHaveClass(/maplibregl-compact-show/);
    await attributionButton.click();
    await expect(attribution).toHaveAttribute('open');
    await expect(attribution).toHaveClass(/maplibregl-compact-show/);
    await attributionButton.click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(attribution).toHaveAttribute('open');
    await expect(attribution).toHaveClass(/maplibregl-compact-show/);
  }
};

const expectFullTouchTargets = async (buttons: Locator) => {
  const buttonList = await buttons.all();
  expect(buttonList.length).toBeGreaterThan(0);
  for (const button of buttonList) {
    const box = await button.boundingBox();
    expect(Math.round(box?.width ?? 0)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44);
  }
};

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

const expectContained = async (container: Locator, children: Locator) => {
  const containerBox = await container.boundingBox();
  expect(containerBox).not.toBeNull();
  const childList = await children.all();
  for (const child of childList) {
    const childBox = await child.boundingBox();
    expect(childBox).not.toBeNull();
    expect(childBox!.y).toBeGreaterThanOrEqual(containerBox!.y);
    expect(childBox!.y + childBox!.height).toBeLessThanOrEqual(containerBox!.y + containerBox!.height);
  }
};

const expectBalancedHorizontalSpacing = async (button: Locator, icon: Locator, label: Locator) => {
  const [buttonBox, iconBox, labelBox] = await Promise.all([
    button.boundingBox(), icon.boundingBox(), label.boundingBox(),
  ]);
  expect(buttonBox).not.toBeNull();
  expect(iconBox).not.toBeNull();
  expect(labelBox).not.toBeNull();
  expect(iconBox!.x - buttonBox!.x).toBeGreaterThanOrEqual(12);
  expect(labelBox!.x - (iconBox!.x + iconBox!.width)).toBeGreaterThanOrEqual(8);
  expect((buttonBox!.x + buttonBox!.width) - (labelBox!.x + labelBox!.width)).toBeGreaterThanOrEqual(12);
};

test('mobile Export action keeps balanced content and an even visual inset', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const button = page.getByRole('button', { name: 'Export' });
  await expectBalancedHorizontalSpacing(button, button.locator('svg'), button.locator('span'));
  const [buttonBox, topbarBox] = await Promise.all([
    button.boundingBox(),
    page.locator('.topbar').boundingBox(),
  ]);
  expect(buttonBox).not.toBeNull();
  expect(topbarBox).not.toBeNull();
  expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
  expect(buttonBox!.height).toBe(topbarBox!.height);
  const surface = await button.evaluate((element) => {
    const buttonStyle = getComputedStyle(element);
    const before = getComputedStyle(element, '::before');
    return {
      background: buttonStyle.backgroundColor,
      bottom: before.bottom,
      content: before.content,
      top: before.top,
    };
  });
  expect(surface).toMatchObject({
    background: 'rgba(0, 0, 0, 0)',
    bottom: '4px',
    content: '""',
    top: '4px',
  });
});

test('mobile map palette keeps one navigation mode and exposes Fit page directly', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const toolbar = page.getByRole('navigation', { name: 'Map tools' });
  await expect(toolbar).toBeVisible({ timeout: 20_000 });
  await expect(toolbar.locator('.tool-label')).toHaveText(['Select', 'Place', 'Route', 'Area']);
  await expect(toolbar.getByRole('button')).toHaveCount(4);
  expect(await toolbar.locator('.tool-label').first().evaluate((element) => Number(getComputedStyle(element).fontSize.replace('px', '')))).toBeGreaterThanOrEqual(11);
  await expect(page.getByRole('button', { name: 'More map tools' })).toHaveCount(0);

  const fit = page.getByRole('button', { name: 'Fit page' });
  await expect(fit).toBeVisible();
  const fitBox = await fit.boundingBox();
  const zoomGroupBox = await page.locator('.maplibregl-ctrl-group').first().boundingBox();
  expect(fitBox).not.toBeNull();
  expect(zoomGroupBox).not.toBeNull();
  expect(fitBox!.width).toBeGreaterThanOrEqual(44);
  expect(fitBox!.height).toBeGreaterThanOrEqual(44);
  expect(fitBox!.x).toBe(zoomGroupBox!.x);
  expect(fitBox!.width).toBe(zoomGroupBox!.width);
  expect(zoomGroupBox!.y - (fitBox!.y + fitBox!.height)).toBe(8);
  await expectNoOverlap(fit, page.locator('.maplibregl-ctrl-bottom-right'));
  await expectNoOverlap(fit, toolbar);

  await toolbar.getByRole('button', { name: 'Route (R)' }).click();
  const authoringFitBox = await fit.boundingBox();
  const authoringZoomGroupBox = await page.locator('.maplibregl-ctrl-group').first().boundingBox();
  expect(authoringFitBox).not.toBeNull();
  expect(authoringZoomGroupBox).not.toBeNull();
  expect(authoringFitBox!.x).toBe(authoringZoomGroupBox!.x);
  expect(authoringFitBox!.width).toBe(authoringZoomGroupBox!.width);
  expect(authoringZoomGroupBox!.y - (authoringFitBox!.y + authoringFitBox!.height)).toBe(8);
  const routePath = page.getByRole('radiogroup', { name: 'Route path' });
  await expect(routePath.getByRole('radio', { name: 'Straight' })).toContainText('Straight');
  await expect(routePath.getByRole('radio', { name: 'Arc' })).toContainText('Arc');
  await expect(routePath.getByRole('radio', { name: 'Road' })).toContainText('Road');
  await expect(page.getByRole('combobox', { name: 'Travel marker' })).toHaveValue('none');
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toHaveText('Click the map to add route points');
  const panel = page.locator('.route-authoring-panel');
  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.height).toBeLessThanOrEqual(150);
  await expectNoOverlap(panel, page.locator('.map-scale'));
  await expectNoOverlap(panel, page.locator('.maplibregl-ctrl-bottom-left'));
  await expectNoOverlap(panel, page.locator('.maplibregl-ctrl-bottom-right'));
  await page.screenshot({ path: 'docs/screenshots/mobile-route-palette-20260826.png' });

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(toolbar.locator('.tool-label:visible')).toHaveCount(0);
});


test('mobile authoring panels and native map controls stay usable and disjoint', async ({ page }) => {
  for (const tool of ['Place (P)', 'Area (S)']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: tool }).click();

    const panel = page.locator('.map-authoring-panel');
    const zoomButtons = page.locator('.maplibregl-ctrl-group button');
    const attributionButton = page.locator('.maplibregl-ctrl-attrib-button');
    await expectFullTouchTargets(zoomButtons);
    await expectFullTouchTargets(attributionButton);
    await expectNoOverlap(panel, page.locator('.map-scale'));
    await expectNoOverlap(panel, page.locator('.maplibregl-ctrl-bottom-left'));
    await expectNoOverlap(panel, page.locator('.maplibregl-ctrl-bottom-right'));
    await expectNoOverlap(page.locator('.map-scale'), page.locator('.maplibregl-ctrl-bottom-right'));
    if (tool === 'Area (S)') {
      const tabs = page.getByRole('tablist', { name: 'Shape source' });
      await expect(tabs.getByRole('tab', { name: 'Find administrative area' })).toHaveText('Boundaries');
      await expect(tabs.getByRole('tab', { name: 'Draw custom area' })).toHaveText('Draw');
      await expect(tabs.getByRole('tab', { name: 'Travel time' })).toHaveText('Travel time');
      const sourceTabs = await tabs.getByRole('tab').all();
      for (const tab of sourceTabs) {
        const box = await tab.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeLessThanOrEqual(44);
      }
      await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/mobile-area-source-tabs-20260826.png' });
    }
  }
});

test('mobile navigation buttons use full touch targets', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');

    const panelButtons = page.locator('.mobile-panel-actions button');
    const toolButtons = page.locator('.tool-palette .tool-button');
    const fitButton = page.getByRole('button', { name: 'Fit page' });
    await expect(panelButtons).toHaveCount(2);
    await expect(toolButtons).toHaveCount(4);
    await expectFullTouchTargets(panelButtons);
    await expectFullTouchTargets(toolButtons);
    await expectFullTouchTargets(fitButton);
    if (width === 390) {
      await page.screenshot({ path: 'docs/screenshots/mobile-nav-touch-targets.png' });
    }

    const toolbar = page.getByRole('navigation', { name: 'Map tools' });
    const mapScale = page.locator('.map-scale');
    const mapControls = page.locator('.maplibregl-ctrl-bottom-right');
    const attribution = page.locator('.maplibregl-ctrl-bottom-left');
    await expect(mapScale).toBeVisible();
    await expect(mapControls).toBeVisible({ timeout: 20_000 });
    await expect(attribution).toBeVisible();
    await expectNoOverlap(toolbar, mapScale);
    await expectNoOverlap(toolbar, mapControls);
    await expectNoOverlap(toolbar, attribution);

    await page.getByRole('button', { name: 'Open properties' }).click();
    const propertiesDialog = page.getByRole('dialog', { name: 'Properties sidebar' });
    await expect(propertiesDialog).toBeVisible();
    await expect(propertiesDialog.getByRole('heading', { name: 'Project' })).toBeVisible();
    await expectFullTouchTargets(propertiesDialog.getByRole('button'));
    const orientation = propertiesDialog.locator('.segmented').first();
    await expectContained(orientation, orientation.getByRole('button'));
    await page.getByRole('button', { name: 'Close properties' }).click();

    await page.getByRole('button', { name: 'Open layers' }).click();
    const layersDialog = page.getByRole('dialog', { name: 'Layers sidebar' });
    await expect(layersDialog).toBeVisible();
    await expectFullTouchTargets(layersDialog.getByRole('button'));
    await layersDialog.getByRole('button', { name: 'Select Route 01' }).click();

    await page.getByRole('button', { name: 'Open properties' }).click();
    await expect(propertiesDialog).toBeVisible();
    await expect(propertiesDialog.getByRole('heading', { name: 'Route 01' })).toBeVisible();
    await expectFullTouchTargets(propertiesDialog.getByRole('button'));
    await expectNoOverlap(
      propertiesDialog.getByRole('button', { name: 'Close properties' }),
      propertiesDialog.getByRole('button', { name: 'Layer menu' }),
    );
    await page.getByRole('button', { name: 'Close properties' }).click();

    const toolbarBox = await toolbar.boundingBox();
    expect(toolbarBox?.x).toBeGreaterThanOrEqual(8);
    expect((toolbarBox?.x ?? 0) + (toolbarBox?.width ?? 0)).toBeLessThanOrEqual(width - 8);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(width);
  }

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('mobile shell exposes accessible drawers and non-overlapping attribution states', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByRole('status');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });

  const metrics = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(metrics.body).toBeLessThanOrEqual(metrics.viewport);

  const toolbar = page.getByRole('navigation', { name: 'Map tools' });
  await expect(toolbar).toBeVisible();
  const toolbarBox = await toolbar.boundingBox();
  expect(toolbarBox).not.toBeNull();
  expect(toolbarBox!.x).toBeGreaterThanOrEqual(8);
  expect(toolbarBox!.x + toolbarBox!.width).toBeLessThanOrEqual(382);

  if (await mapReady.isVisible()) {
    await verifyMapAttribution(page, toolbar, toolbarBox!);
  }
  await verifyMobileDrawers(page);
  await verifyResponsiveTransitions(page, toolbar, mapReady);
});
