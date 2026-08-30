import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const isExpectedWebGlDiagnostic = (message: string, browserName: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
  || (browserName === 'firefox' && message.includes('WEBGL_debug_renderer_info is deprecated in Firefox'))
);

const mercatorY = (latitude: number) => (
  (180 - 180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360))) / 360
);

function projectInitialMapCoordinate(
  coordinate: readonly [number, number],
  width: number,
  height: number,
) {
  const worldSize = 512 * 2 ** 11.2;
  const [centerLongitude, centerLatitude] = [16.3725, 48.2084];
  return {
    x: width / 2 + (coordinate[0] - centerLongitude) / 360 * worldSize,
    y: height / 2 + (mercatorY(coordinate[1]) - mercatorY(centerLatitude)) * worldSize,
  };
}

type ScreenPoint = { x: number; y: number };

async function handleCenters(page: Page) {
  return page.getByRole('button', { name: /Drag route vertex/ }).evaluateAll((elements) => (
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    })
  ));
}

const midpoint = (first: ScreenPoint, second: ScreenPoint) => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
});

async function routeHandlePixels(page: Page, points: Record<string, ScreenPoint>) {
  const png = await page.screenshot();
  return page.evaluate(async ({ image, points }) => {
    const response = await fetch(`data:image/png;base64,${image}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas pixel inspection is unavailable.');
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const colorAt = (x: number, y: number) => {
      const offset = (Math.round(y) * bitmap.width + Math.round(x)) * 4;
      return [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    };
    return Object.fromEntries(Object.entries(points).map(([name, point]) => {
      let brightCenter = 0;
      let redCenter = 0;
      let redRing = 0;
      for (let y = -9; y <= 9; y += 1) {
        for (let x = -9; x <= 9; x += 1) {
          const distance = Math.hypot(x, y);
          const color = colorAt(point.x + x, point.y + y);
          const isRed = color[0] > 145 && color[0] > color[1] * 1.35 && color[0] > color[2] * 1.15;
          if (distance <= 2.2) {
            redCenter += Number(isRed);
            brightCenter += Number(color.every((channel) => channel > 210));
          }
          if (distance >= 5.5 && distance <= 9.5) redRing += Number(isRed);
        }
      }
      return [name, { brightCenter, redCenter, redRing }];
    }));
  }, { image: png.toString('base64'), points });
}

async function routePixels(page: Page, points: Record<string, ScreenPoint>) {
  const png = await page.screenshot();
  return page.evaluate(async ({ image, points }) => {
    const response = await fetch(`data:image/png;base64,${image}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas pixel inspection is unavailable.');
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    return Object.fromEntries(Object.entries(points).map(([name, point]) => {
      let routeRed = 0;
      for (let y = -9; y <= 9; y += 1) {
        for (let x = -9; x <= 9; x += 1) {
          const offset = (Math.round(point.y + y) * bitmap.width + Math.round(point.x + x)) * 4;
          const color = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
          routeRed += Number(
            Math.hypot(x, y) <= 9
            && color[0] > 175
            && color[1] < 120
            && color[2] < 125
            && color[0] > color[1] * 1.65,
          );
        }
      }
      return [name, { routeRed }];
    }));
  }, { image: png.toString('base64'), points });
}

test('expert arc route authoring is undoable and exports a travel-mode marker', async ({ page, browserName }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isExpectedWebGlDiagnostic(message.text(), browserName)) {
      consoleProblems.push(message.text());
    }
  });
  await page.goto('./');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so map authoring cannot be exercised.');

  await page.getByRole('button', { name: 'Route (R)' }).click();
  await expect(page.getByRole('button', { name: 'Export' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Arc', exact: true }).click();
  await page.getByRole('combobox', { name: 'Travel marker' }).selectOption('air');
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('Click the map to add route points');
  const canvas = page.locator('.maplibregl-canvas');
  const canvasBox = await canvas.boundingBox();
  const frameBox = await page.locator('.print-frame').boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  const point = (xFraction: number, yFraction: number) => ({
    x: frameBox!.x - canvasBox!.x + frameBox!.width * xFraction,
    y: frameBox!.y - canvasBox!.y + frameBox!.height * yFraction,
  });
  await canvas.click({ position: point(0.2, 0.2) });
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('1 point');
  await canvas.click({ position: point(0.8, 0.2) });
  const createdRoute = page.getByRole('button', { name: 'Select Route 02' });
  await expect(createdRoute).not.toBeVisible();
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('2 points');
  await canvas.click({ position: point(0.9, 0.7) });
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('3 points');
  await page.getByRole('button', { name: 'Finish route' }).click();
  await expect(createdRoute).toHaveAttribute('aria-current', 'true');
  await page.screenshot({ path: testInfo.outputPath('expert-route-desktop.png'), fullPage: true });

  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /route-02/);
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-appearance', /route-02:[^|]*:air:true/);
  await expect(page.getByRole('combobox', { name: 'Route travel profile' })).toHaveValue('air');
  await expect(page.getByRole('checkbox', { name: 'Show travel-mode marker' })).toBeChecked();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(createdRoute).not.toBeVisible();
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(createdRoute).toBeVisible();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /route-02/);

  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('dialog', { name: 'Export map' }).getByRole('radio', { name: /Layered SVG/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('dialog', { name: 'Export map' }).getByRole('button', { name: 'Download layered SVG' }).click();
  const download = await downloadPromise;
  const outputPath = testInfo.outputPath('route-authoring.layered.svg');
  await download.saveAs(outputPath);
  const svg = await readFile(outputPath, 'utf8');
  expect(svg).toContain('data-layer-name="Route 02"');
  expect(svg).toMatch(/data-layer-id="route-02"[^>]*>[\s\S]*?<path /);
  const routePath = svg.match(/data-layer-id="route-02"[^>]*>[\s\S]*?<path[^>]*d="([^"]+)"/)?.[1];
  expect(routePath).toContain(' L ');
  expect(routePath).not.toContain(' Q ');
  expect(svg).toContain('data-route-travel-profile="air"');
  expect(svg).toContain('>AIR</text>');
  await page.getByRole('dialog', { name: 'Export map' }).getByRole('button', { name: 'Close export' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Route (R)' }).click();
  const authoringPanel = page.locator('.map-authoring-panel');
  await expect(authoringPanel).toBeVisible();
  const panelBox = await authoringPanel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.body.scrollWidth - document.body.clientWidth)).toBe(0);
  await page.getByRole('button', { name: 'Cancel route' }).click();
  expect(consoleProblems).toEqual([]);
});

test('a selected straight route drags a Terra Draw midpoint as one undoable edit', async ({ page }) => {
  await page.goto('./');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so route point editing cannot be exercised.');

  const route = page.getByRole('button', { name: 'Select Route 01' });
  await route.click();
  await page.getByRole('button', { name: /Advanced/ }).click();
  const vertexSelect = page.getByRole('combobox', { name: 'Route vertex' });
  await expect(vertexSelect.locator('option')).toHaveCount(4);
  const mapCanvas = page.getByTestId('map-canvas');
  const originalGeometry = await mapCanvas.evaluate((element) => (
    (element as HTMLElement).dataset.mapLayerGeometry
  ));
  expect(originalGeometry).toBeTruthy();
  const canvasBox = await page.locator('.maplibregl-canvas').boundingBox();
  expect(canvasBox).not.toBeNull();
  const midpoint = projectInitialMapCoordinate(
    [(16.326 + 16.353) / 2, (48.194 + 48.205) / 2],
    canvasBox!.width,
    canvasBox!.height,
  );
  await page.mouse.move(canvasBox!.x + midpoint.x, canvasBox!.y + midpoint.y);
  await page.mouse.down();
  await page.mouse.move(canvasBox!.x + midpoint.x, canvasBox!.y + midpoint.y + 30, { steps: 5 });
  await expect.poll(() => mapCanvas.evaluate((element) => (
    (element as HTMLElement).dataset.mapLayerGeometry
  ))).not.toBe(originalGeometry);
  await page.mouse.up();

  await expect(route).toHaveAttribute('aria-current', 'true');
  await expect(vertexSelect.locator('option')).toHaveCount(5);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(vertexSelect.locator('option')).toHaveCount(4);
  await expect(mapCanvas).toHaveAttribute('data-map-layer-geometry', originalGeometry!);
});

test('route editor load failures are announced instead of leaving an inert tool', async ({ page }) => {
  await page.route('**/src/map/TerraDrawRouteFactory.ts*', (route) => route.abort('failed'));
  await page.goto('/');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer.');

  await page.getByRole('button', { name: 'Route (R)' }).click();

  await expect(page.getByRole('alert')).toContainText('The route editor could not be loaded');
});

test('a pitch-zero Arc visibly curves and supports accessible one-step edits', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer.');

  await page.getByRole('button', { name: 'Route (R)' }).click();
  await page.getByRole('radio', { name: 'Arc', exact: true }).click();
  await page.getByRole('combobox', { name: 'Travel marker' }).selectOption('air');
  const canvas = page.locator('.maplibregl-canvas');
  const canvasBox = await canvas.boundingBox();
  const frameBox = await page.locator('.print-frame').boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  const point = (xFraction: number, yFraction: number) => ({
    x: frameBox!.x - canvasBox!.x + frameBox!.width * xFraction,
    y: frameBox!.y - canvasBox!.y + frameBox!.height * yFraction,
  });
  await canvas.click({ position: point(0.2, 0.25) });
  await canvas.click({ position: point(0.8, 0.25) });
  await page.getByRole('button', { name: 'Finish route' }).click();

  const route = page.getByRole('button', { name: 'Select Route 02' });
  const vertices = page.getByRole('button', { name: /Drag route vertex/ });
  const insertHandle = page.getByRole('button', { name: 'Add route vertex between 1 and 2' });
  await expect(vertices).toHaveCount(2);
  await expect(insertHandle).toBeVisible();
  const endpoints = await handleCenters(page);
  const insertionBox = await insertHandle.boundingBox();
  expect(insertionBox).not.toBeNull();
  const curveMidpoint = {
    x: insertionBox!.x + insertionBox!.width / 2,
    y: insertionBox!.y + insertionBox!.height / 2,
  };
  const chordMidpoint = midpoint(endpoints[0], endpoints[1]);
  expect(Math.abs(curveMidpoint.y - chordMidpoint.y)).toBeGreaterThan(30);

  await page.getByRole('button', { name: 'Select Paper basemap' }).click();
  await expect(vertices).toHaveCount(0);
  await page.waitForTimeout(300);
  const markerPixels = await routePixels(page, { chordMidpoint, curveMidpoint });

  await route.click();
  await page.getByRole('button', { name: /Advanced/ }).click();
  await page.getByRole('checkbox', { name: 'Show travel-mode marker' }).uncheck();
  await page.getByRole('button', { name: 'Select Paper basemap' }).click();
  await page.waitForTimeout(300);
  const strokePixels = await routePixels(page, { chordMidpoint, curveMidpoint });
  expect(markerPixels.curveMidpoint.routeRed).toBeGreaterThan(strokePixels.curveMidpoint.routeRed + 20);
  expect(markerPixels.chordMidpoint.routeRed).toBeLessThan(10);
  expect(strokePixels.curveMidpoint.routeRed).toBeGreaterThan(5);
  expect(strokePixels.chordMidpoint.routeRed).toBeLessThan(10);

  await route.click();
  const mapCanvas = page.getByTestId('map-canvas');
  const originalGeometry = await mapCanvas.getAttribute('data-map-layer-geometry');
  const secondVertex = page.getByRole('button', { name: 'Drag route vertex 2' });
  await secondVertex.focus();
  await secondVertex.press('ArrowDown');
  await expect(mapCanvas).not.toHaveAttribute('data-map-layer-geometry', originalGeometry!);
  await expect(page.getByRole('button', { name: 'Drag route vertex 2' })).toBeFocused();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(mapCanvas).toHaveAttribute('data-map-layer-geometry', originalGeometry!);

  const beforeDrag = await handleCenters(page);
  await page.mouse.move(beforeDrag[1].x, beforeDrag[1].y);
  await page.mouse.down();
  await page.mouse.move(beforeDrag[1].x + 48, beforeDrag[1].y + 36, { steps: 5 });
  await page.mouse.up();
  await expect(mapCanvas).not.toHaveAttribute('data-map-layer-geometry', originalGeometry!);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(mapCanvas).toHaveAttribute('data-map-layer-geometry', originalGeometry!);

  const longitude = page.getByRole('textbox', { name: 'Route vertex longitude' });
  const latitude = page.getByRole('textbox', { name: 'Route vertex latitude' });
  const nextLongitude = Number(await longitude.inputValue()) + 0.01;
  await longitude.fill(String(nextLongitude));
  await longitude.press('Tab');
  await expect(latitude).toBeFocused();
  await expect(mapCanvas).not.toHaveAttribute('data-map-layer-geometry', originalGeometry!);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(mapCanvas).toHaveAttribute('data-map-layer-geometry', originalGeometry!);

  await page.getByRole('button', { name: 'Add route vertex between 1 and 2' }).click();
  await expect(vertices).toHaveCount(3);
  await page.getByRole('combobox', { name: 'Route vertex' }).selectOption('1');
  await page.getByRole('button', { name: 'Remove selected route vertex' }).click();
  await expect(vertices).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(vertices).toHaveCount(3);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(vertices).toHaveCount(2);

  const beforeFlip = await page.getByRole('button', { name: 'Add route vertex between 1 and 2' }).boundingBox();
  expect(beforeFlip).not.toBeNull();
  await page.getByRole('button', { name: 'Flip arc direction' }).click();
  const afterFlip = await page.getByRole('button', { name: 'Add route vertex between 1 and 2' }).boundingBox();
  expect(afterFlip).not.toBeNull();
  const beforeOffset = beforeFlip!.y + beforeFlip!.height / 2 - chordMidpoint.y;
  const afterOffset = afterFlip!.y + afterFlip!.height / 2 - chordMidpoint.y;
  expect(beforeOffset * afterOffset).toBeLessThan(0);
  await page.getByRole('button', { name: 'Undo' }).click();
});

test('accessible route drag moves dependent midpoint handles live above the stroke', async ({ page }) => {
  await page.goto('./');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer.');

  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await page.getByRole('button', { name: /Advanced/ }).click();
  const mapCanvas = page.getByTestId('map-canvas');
  const originalGeometry = await mapCanvas.getAttribute('data-map-layer-geometry');
  const before = await handleCenters(page);
  const dragged = before[1];
  await page.mouse.move(dragged.x, dragged.y);
  await page.mouse.down();
  await page.mouse.move(dragged.x + 96, dragged.y + 72, { steps: 8 });
  const after = await handleCenters(page);
  expect(after[1].x).toBeGreaterThan(before[1].x + 90);
  const pixels = await routeHandlePixels(page, {
    oldFirst: midpoint(before[0], before[1]),
    oldSecond: midpoint(before[1], before[2]),
    newFirst: midpoint(after[0], after[1]),
    newSecond: midpoint(after[1], after[2]),
  });

  for (const name of ['newFirst', 'newSecond']) {
    expect(pixels[name].redRing).toBeGreaterThan(30);
    expect(pixels[name].brightCenter).toBeGreaterThanOrEqual(9);
    expect(pixels[name].redCenter).toBeLessThanOrEqual(2);
  }
  expect(pixels.oldFirst.redRing).toBeLessThan(10);
  expect(pixels.oldSecond.redRing).toBeLessThan(10);
  await page.mouse.up();
  await expect(mapCanvas).not.toHaveAttribute('data-map-layer-geometry', originalGeometry!);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(mapCanvas).toHaveAttribute('data-map-layer-geometry', originalGeometry!);
});
