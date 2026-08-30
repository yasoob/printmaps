import { expect, test } from '@playwright/test';
import { openAdvanced, waitForMap } from './advanced-route-test-support';

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
  await page.goto('./');
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
  await page.goto('./');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });

  await expect(page.getByRole('toolbar', { name: 'Map style theme families' })).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: 'Map style presets' }).getByRole('radio')).toHaveCount(12);
  await expect(page.locator('.map-style-attribution')).toHaveCount(0);
  await expect(page.locator('.maplibregl-ctrl-attrib')).toBeVisible();
});

test('uses a consistent typography hierarchy in route details', async ({ page }) => {
  await page.goto('./');
  await waitForMap(page);
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await openAdvanced(page);

  const fontSize = (selector: string) => page.locator(selector).first()
    .evaluate((element) => getComputedStyle(element).fontSize);

  await expect(page.getByRole('button', { name: 'Clear leg override' })).toHaveCSS('font-size', '12px');
  await expect(page.getByRole('combobox', { name: 'Road matching travel mode' })).toHaveCSS('font-size', '12px');
  await expect(page.getByText('Continue this route from either endpoint without creating another layer.'))
    .toHaveCSS('font-size', '11px');
  await expect(page.getByRole('button', { name: 'Extend start' })).toHaveCSS('font-size', '12px');
  await expect(page.getByRole('button', { name: 'Extend end' })).toHaveCSS('font-size', '12px');
  expect(await fontSize('.route-map-matching > small')).toBe('11px');
  expect(await fontSize('.route-vertex-hint')).toBe('11px');
  expect(await fontSize('.elevation-profile-source')).toBe('11px');

  const sectionHeadingSizes = await page.locator('.property-section > h3')
    .evaluateAll((headings) => headings.map((heading) => getComputedStyle(heading).fontSize));
  expect(new Set(sectionHeadingSizes)).toEqual(new Set(['12px']));
});
