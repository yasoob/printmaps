import { expect, test } from '@playwright/test';

const accordionGeometry = async (page: import('@playwright/test').Page) => page
  .locator('.inspector-accordion h3 > button')
  .evaluateAll((buttons) => buttons.map((button) => {
    const chevron = button.querySelector('.inspector-chevron')!.getBoundingClientRect();
    const label = button.querySelector('.inspector-section-label')!.getBoundingClientRect();
    const summary = button.querySelector('.inspector-section-summary')?.getBoundingClientRect();
    return {
      centerDelta: Math.abs((chevron.y + chevron.height / 2) - (label.y + label.height / 2)),
      labelX: label.x,
      summaryX: summary?.x,
    };
  }));

test('aligns every inspector chevron with its title', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });

  const initialGeometry = await accordionGeometry(page);
  for (const geometry of initialGeometry) {
    expect(geometry.centerDelta).toBeLessThanOrEqual(1);
    if (geometry.summaryX !== undefined) expect(geometry.summaryX).toBe(geometry.labelX);
  }

  await page.getByRole('button', { name: 'Map style' }).click();
  const collapsedGeometry = await accordionGeometry(page);
  for (const geometry of collapsedGeometry) {
    expect(geometry.centerDelta).toBeLessThanOrEqual(1);
    if (geometry.summaryX !== undefined) expect(geometry.summaryX).toBe(geometry.labelX);
  }
});

test('keeps map styles preview-first without duplicate gallery attribution', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });

  await expect(page.getByRole('toolbar', { name: 'Map style theme families' })).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: 'Map style presets' }).getByRole('radio')).toHaveCount(12);
  await expect(page.locator('.map-style-attribution')).toHaveCount(0);
  await expect(page.locator('.maplibregl-ctrl-attrib')).toBeVisible();
});
