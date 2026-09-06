import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('tapping a mobile layer opens its Properties directly without changing history', async ({ page }) => {
  await page.goto('./');
  const map = page.getByTestId('map-canvas');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Open layers' }).tap();
  const coffee = page.getByRole('button', { name: 'Select Coffee stop' });
  await expect(coffee).toHaveAttribute('aria-haspopup', 'dialog');
  await coffee.tap();

  const properties = page.getByRole('dialog', { name: 'Properties sidebar' });
  const close = page.getByRole('button', { name: 'Close properties' });
  await expect(properties).toBeVisible();
  await expect(properties.getByRole('heading', { name: 'Coffee stop' })).toBeVisible();
  await expect(close).toBeFocused();
  await expect(page.getByRole('dialog', { name: 'Layers sidebar' })).toHaveCount(0);
  await expect(map).toHaveAttribute('data-selected-layer', 'poi-cafe');

  await close.tap();
  await expect(page.getByRole('button', { name: 'Open properties' })).toBeFocused();
  await page.getByRole('button', { name: 'Project', exact: true }).tap();
  await expect(page.getByRole('menuitem', { name: 'Undo', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open layers' }).tap();
  await page.getByRole('button', { name: 'Select Route 01' }).tap();
  await expect(properties.getByRole('heading', { name: 'Route 01' })).toBeVisible();
  await expect(properties.getByRole('textbox', { name: 'POI longitude' })).toHaveCount(0);
  await expect(map).toHaveAttribute('data-selected-layer', 'route-01');
});
