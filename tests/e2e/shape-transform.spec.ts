import { expect, test, type Locator, type Page } from '@playwright/test';

async function dragBy(page: Page, locator: Locator, x: number, y: number) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Shape transform handle is not visible.');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + x, box.y + box.height / 2 + y, { steps: 6 });
  await page.mouse.up();
}

async function expectHandlesAligned(page: Page, map: Locator) {
  const alignment = await page.locator('.shape-transform-marker').evaluateAll((handles, mapElement) => {
    const mapBounds = (mapElement as HTMLElement).getBoundingClientRect();
    return handles.map((handle) => {
      const element = handle as HTMLElement;
      const bounds = element.getBoundingClientRect();
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return {
        deltaX: Math.abs(bounds.x - mapBounds.x - matrix.e),
        deltaY: Math.abs(bounds.y - mapBounds.y - matrix.f),
        position: getComputedStyle(element).position,
      };
    });
  }, await map.elementHandle());
  expect(alignment).toHaveLength(5);
  for (const handle of alignment) {
    expect(handle.position).toBe('absolute');
    expect(handle.deltaX).toBeLessThan(1);
    expect(handle.deltaY).toBeLessThan(1);
  }
}

test('shape handles stay at the coordinates positioned by MapLibre', async ({ page }) => {
  await page.goto('./');
  const map = page.getByTestId('map-canvas');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Select City center' }).click();
  await page.getByRole('button', { name: 'Transform area' }).click();

  await expectHandlesAligned(page, map);
  await page.locator('.maplibregl-canvas').click({ position: { x: 20, y: 20 } });
  await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
  const cameraDisclosure = page.getByRole('button', { name: /Camera & location/ });
  if (await cameraDisclosure.getAttribute('aria-expanded') !== 'true') await cameraDisclosure.click();
  await page.getByRole('spinbutton', { name: 'Bearing' }).fill('28');
  await page.getByRole('spinbutton', { name: 'Bearing' }).press('Tab');
  await page.getByRole('spinbutton', { name: 'Pitch' }).fill('35');
  await page.getByRole('spinbutton', { name: 'Pitch' }).press('Tab');
  await expect(map).toHaveAttribute('data-map-bearing', '28');
  await expect(map).toHaveAttribute('data-map-pitch', '35');
  await page.getByRole('button', { name: 'Select City center' }).click();
  await page.getByRole('button', { name: 'Transform area' }).click();
  await expectHandlesAligned(page, map);
});

test('selected shapes move and resize directly with undoable map handles', async ({ page }) => {
  await page.goto('./');
  const map = page.getByTestId('map-canvas');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Select City center' }).click();
  await page.getByRole('button', { name: 'Transform area' }).click();

  const move = page.getByRole('button', { name: 'Move selected shape' });
  await expect(move).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resize selected shape from top left' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resize selected shape from bottom right' })).toBeVisible();
  const original = await map.getAttribute('data-map-layer-geometry');
  expect(original).toBeTruthy();

  const centerBeforePan = await map.getAttribute('data-map-center');
  const canvasBox = await page.locator('.maplibregl-canvas').boundingBox();
  expect(centerBeforePan).toBeTruthy();
  expect(canvasBox).not.toBeNull();
  await page.mouse.move(canvasBox!.x + 30, canvasBox!.y + 30);
  await page.mouse.down();
  await page.mouse.move(canvasBox!.x + 110, canvasBox!.y + 70, { steps: 6 });
  await page.mouse.up();
  await expect(map).not.toHaveAttribute('data-map-center', centerBeforePan!);

  const moveBox = await move.boundingBox();
  const corner = page.getByRole('button', { name: 'Resize selected shape from top left' });
  const cornerBefore = await corner.boundingBox();
  expect(moveBox).not.toBeNull();
  expect(cornerBefore).not.toBeNull();
  await page.mouse.move(moveBox!.x + moveBox!.width / 2, moveBox!.y + moveBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(moveBox!.x + moveBox!.width / 2 + 36, moveBox!.y + moveBox!.height / 2 + 20, { steps: 6 });
  const cornerDuringDrag = await corner.boundingBox();
  expect(cornerDuringDrag).not.toBeNull();
  expect(Math.abs((cornerDuringDrag!.x - cornerBefore!.x) - 36)).toBeLessThanOrEqual(1);
  expect(Math.abs((cornerDuringDrag!.y - cornerBefore!.y) - 20)).toBeLessThanOrEqual(1);
  await page.mouse.up();
  await expect(map).not.toHaveAttribute('data-map-layer-geometry', original!);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(map).toHaveAttribute('data-map-layer-geometry', original!);

  const resize = page.getByRole('button', { name: 'Resize selected shape from bottom right' });
  await dragBy(page, resize, 28, 22);
  await expect(map).not.toHaveAttribute('data-map-layer-geometry', original!);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
});
