import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
]) {
  test(`Properties previews the unchanged map frame above a bottom sheet at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    const map = page.getByTestId('map-canvas');
    await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
    const originalCanvas = await map.boundingBox();
    const originalFrame = await page.locator('.print-frame').boundingBox();
    const originalCenter = await map.getAttribute('data-map-center');
    const originalZoom = await map.getAttribute('data-map-zoom');

    await page.getByRole('button', { name: 'Open properties' }).click();
    const sheet = page.getByRole('dialog', { name: 'Properties sidebar' });
    await expect(sheet).toBeVisible();
    const close = page.getByRole('button', { name: 'Close properties' });
    await expect(close).toBeFocused();
    const bounds = await sheet.boundingBox();
    expect(bounds!.width).toBe(viewport.width);
    expect(bounds!.y - originalCanvas!.y).toBeGreaterThan(viewport.height * 0.35);
    expect(await map.boundingBox()).toEqual(originalCanvas);
    expect(await page.locator('.print-frame').boundingBox()).toEqual(originalFrame);
    await expect(page.locator('.mobile-panel-backdrop')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

    await page.getByRole('button', { name: 'Customize colors', exact: true }).click();
    await page.getByRole('button', { name: 'Warm', exact: true }).click();
    await expect(map).toHaveAttribute('data-map-style-customized', 'true');
    await expect(map).toHaveAttribute('data-map-center', originalCenter!);
    await expect(map).toHaveAttribute('data-map-zoom', originalZoom!);
    expect(await map.boundingBox()).toEqual(originalCanvas);
    await expect(close).toBeVisible();
    const closeBox = await close.boundingBox();
    const resetBox = await page.getByRole('button', { name: 'Reset to Paper', exact: true }).boundingBox();
    expect(resetBox!.x + resetBox!.width).toBeLessThanOrEqual(closeBox!.x);

    const lastColor = page.getByLabel('Label halo color', { exact: true });
    await lastColor.focus();
    await lastColor.press('Tab');
    await expect(close).toBeFocused();
    await close.press('Shift+Tab');
    await expect(lastColor).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('live-map-preview.png') });

    await close.click();
    await expect(sheet).toBeHidden();
    await page.getByRole('button', { name: 'Open properties' }).click();
    await expect(page.getByRole('heading', { name: 'Customize map' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Warm', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await close.click();
    expect(await map.boundingBox()).toEqual(originalCanvas);
  });
}
