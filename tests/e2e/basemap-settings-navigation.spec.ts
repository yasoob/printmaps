import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`basemap selection exposes map-design navigation at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    const map = page.getByTestId('map-canvas');
    await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
    if (viewport.width < 900) await page.getByRole('button', { name: 'Open layers' }).click();
    await page.getByRole('button', { name: 'Select Paper basemap' }).click();
    await expect(page.getByRole('spinbutton', { name: 'Layer opacity' })).toBeVisible();
    await page.getByRole('button', { name: 'Map design settings' }).click();
    await expect(page.getByRole('heading', { name: 'Project' })).toBeFocused();
    await expect(map).toHaveAttribute('data-selected-layer', '');
    await expect(page.getByRole('button', { name: 'Undo', exact: true, includeHidden: true })).toBeDisabled();
    const style = page.getByRole('button', { name: 'Map style', exact: true });
    if (await style.getAttribute('aria-expanded') === 'false') await style.click();
    await expect(page.getByRole('combobox', { name: 'Map language' })).toBeVisible();
    await page.getByRole('radio', { name: /^Graphite:/ }).click();
    await expect(map).toHaveAttribute('data-style-preset', 'graphite');
    await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  });
}
