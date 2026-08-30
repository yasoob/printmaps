import { expect, test, type Locator, type Page } from '@playwright/test';

type Point = { x: number; y: number };
type Coordinate = readonly [number, number];

function touchPoint(x: number, y: number) {
  return { id: 1, x, y, radiusX: 8, radiusY: 8, force: 1 };
}

function mercatorPoint([longitude, latitude]: Coordinate, worldSize: number): Point {
  const sine = Math.sin(latitude * Math.PI / 180);
  return {
    x: (longitude + 180) / 360 * worldSize,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * worldSize,
  };
}

async function screenPoint(map: Locator, coordinate: Coordinate): Promise<Point> {
  const bounds = await map.boundingBox();
  const centerValue = await map.getAttribute('data-map-center');
  const center = centerValue?.split(',').map(Number);
  const zoom = Number(await map.getAttribute('data-map-zoom'));
  if (!bounds || center?.length !== 2 || center.some((value) => !Number.isFinite(value)) || !Number.isFinite(zoom)) {
    throw new Error('Map projection diagnostics are unavailable.');
  }
  const worldSize = 512 * 2 ** zoom;
  const projectedCenter = mercatorPoint(center as [number, number], worldSize);
  const projectedCoordinate = mercatorPoint(coordinate, worldSize);
  return {
    x: bounds.x + bounds.width / 2 + projectedCoordinate.x - projectedCenter.x,
    y: bounds.y + bounds.height / 2 + projectedCoordinate.y - projectedCenter.y,
  };
}

async function expectTouchTarget(locator: Locator) {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(await locator.evaluate((element) => getComputedStyle(element).touchAction)).toBe('none');
  return bounds!;
}

async function touchDrag(page: Page, start: Point, delta: Point) {
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint(start.x, start.y)] });
  for (let step = 1; step <= 6; step += 1) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [touchPoint(start.x + delta.x * step / 6, start.y + delta.y * step / 6)],
    });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

test('touch selects and moves area and route geometry directly on the map', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Trusted touch gesture coverage uses Chromium CDP.');
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('./');
  const map = page.getByTestId('map-canvas');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(page.locator('[data-map-ready="true"]').or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer.');
  await expect(map).toHaveAttribute('data-map-bearing', '0');
  await expect(map).toHaveAttribute('data-map-pitch', '0');

  const areaPoint = await screenPoint(map, [16.374, 48.202]);
  await page.touchscreen.tap(areaPoint.x, areaPoint.y);
  await expect(map).toHaveAttribute('data-selected-layer', 'area-center');
  await page.getByRole('button', { name: 'Transform area' }).tap();
  const areaGeometry = await map.getAttribute('data-map-layer-geometry');
  const moveHandle = page.getByRole('button', { name: 'Move selected shape' });
  const moveBounds = await expectTouchTarget(moveHandle);
  await touchDrag(page, { x: moveBounds.x + moveBounds.width / 2, y: moveBounds.y + moveBounds.height / 2 }, { x: 36, y: 20 });
  await expect(map).not.toHaveAttribute('data-map-layer-geometry', areaGeometry!);

  const routePoint = await screenPoint(map, [16.326, 48.194]);
  await page.touchscreen.tap(routePoint.x + 10, routePoint.y);
  await expect(map).toHaveAttribute('data-selected-layer', 'route-01');
  const routeGeometry = await map.getAttribute('data-map-layer-geometry');
  const routeHandle = page.getByRole('button', { name: 'Drag route vertex 1' });
  const routeBounds = await expectTouchTarget(routeHandle);
  await touchDrag(page, { x: routeBounds.x + routeBounds.width / 2, y: routeBounds.y + routeBounds.height / 2 }, { x: 36, y: 24 });
  await expect(map).not.toHaveAttribute('data-map-layer-geometry', routeGeometry!);
  await context.close();
});

test('touch repositions a selected Place marker through a 44px handle', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Trusted touch gesture coverage uses Chromium CDP.');
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('./');
  const map = page.getByTestId('map-canvas');
  const fallback = page.getByText('Map preview unavailable');
  await expect(page.locator('[data-map-ready="true"]').or(fallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await fallback.isVisible(), 'This browser fixture has no WebGL 2 renderer.');

  const placePoint = await screenPoint(map, [16.3725, 48.2084]);
  await page.touchscreen.tap(placePoint.x, placePoint.y);
  await expect(map).toHaveAttribute('data-selected-layer', 'poi-cafe');
  const originalGeometry = await map.getAttribute('data-map-layer-geometry');
  const handle = page.getByRole('button', { name: 'Move Coffee stop' });
  const bounds = await expectTouchTarget(handle);
  await touchDrag(page, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, { x: 36, y: 24 });
  await expect(map).not.toHaveAttribute('data-map-layer-geometry', originalGeometry!);
  await context.close();
});
