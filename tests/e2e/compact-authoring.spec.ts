import { expect, test, type Page } from '@playwright/test';

async function frameCenterIsDrawable(page: Page) {
  const frame = await page.locator('.print-frame').boundingBox();
  const center = { x: frame!.x + frame!.width / 2, y: frame!.y + frame!.height / 2 };
  expect(await page.evaluate(({ x, y }) => (
    document.elementFromPoint(x, y)?.classList.contains('maplibregl-canvas')
  ), center)).toBe(true);
  return center;
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 844, height: 390 },
]) {
  test(`compact drawing leaves the print center reachable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    const map = page.getByTestId('map-canvas');
    await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Open properties' }).click();
    await page.getByRole('button', { name: 'Portrait', exact: true }).click();
    await page.getByRole('button', { name: 'Close properties' }).click();
    const originalMap = await map.boundingBox();
    const originalFrame = await page.locator('.print-frame').boundingBox();

    await page.getByRole('button', { name: 'Route (R)' }).click();
    await expect(page.locator('.route-authoring-panel')).toHaveAttribute('data-settings-expanded', 'false');
    let center = await frameCenterIsDrawable(page);
    await page.mouse.click(center.x, center.y);
    await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('1 point');
    await page.getByRole('button', { name: 'Show route settings' }).click();
    await page.getByRole('combobox', { name: 'Travel marker' }).selectOption('air');
    await page.getByRole('button', { name: 'Hide route settings' }).click();
    await expect(page.getByRole('button', { name: 'Show route settings' })).toBeFocused();
    await page.getByRole('button', { name: 'Show route settings' }).click();
    await expect(page.getByRole('combobox', { name: 'Travel marker' })).toHaveValue('air');
    await page.getByRole('button', { name: 'Cancel route' }).click();
    await page.getByRole('button', { name: 'Discard changes' }).click();

    await page.getByRole('button', { name: 'Area (S)' }).click();
    await page.getByRole('tab', { name: 'Draw custom area' }).click();
    await expect(page.locator('.shape-authoring-panel')).toHaveAttribute('data-settings-expanded', 'false');
    center = await frameCenterIsDrawable(page);
    await page.mouse.click(center.x, center.y);
    await page.getByRole('button', { name: 'Show area settings' }).click();
    await page.getByRole('button', { name: 'Hide area settings' }).click();
    await expect(page.getByRole('button', { name: 'Show area settings' })).toBeFocused();
    await expect(page.getByRole('status', { name: 'Area drawing status' })).toHaveText('1 vertex');
    await page.mouse.click(center.x - 50, center.y - 40);
    await page.mouse.click(center.x + 50, center.y - 40);
    await expect(page.getByRole('button', { name: 'Finish area' })).toBeEnabled();
    expect(await map.boundingBox()).toEqual(originalMap);
    expect(await page.locator('.print-frame').boundingBox()).toEqual(originalFrame);
    await page.getByRole('button', { name: 'Finish area' }).click();
    await expect(map).toHaveAttribute('data-selected-layer', 'shape-01');
  });
}
