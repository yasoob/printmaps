import { expect, test } from '@playwright/test';

const result = {
  type: 'FeatureCollection',
  features: [{
    id: 'new-york', type: 'Feature',
    geometry: { type: 'Point', coordinates: [-73.9857, 40.7484] },
    properties: { full_address: 'New York, United States' },
  }],
};

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
test(`search placement preserves framing and offers explicit reveal at ${viewport.width}px`, async ({ page }) => {
  await page.setViewportSize(viewport);
  let release!: () => void;
  let requests = 0;
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', async (route) => {
    requests += 1;
    await new Promise<void>((resolve) => { release = resolve; });
    await route.fulfill({ json: result });
  });
  await page.goto('./');
  const map = page.getByTestId('map-canvas');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const center = await map.getAttribute('data-map-center');
  const zoom = await map.getAttribute('data-map-zoom');
  const frame = await page.locator('.print-frame').boundingBox();
  await page.getByRole('button', { name: 'Place (P)' }).click();
  const input = page.getByRole('combobox', { name: 'Search places and addresses' });
  await input.fill('New York');
  const requested = page.waitForRequest('https://api.mapbox.com/search/geocode/v6/forward**');
  await page.getByRole('button', { name: 'Search locations' }).click();
  await requested;
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('status', { name: 'Place search status' })).toContainText('Searching places');
  await expect(page.locator('.location-search-status[aria-hidden="true"]')).toBeVisible();
  release();
  await page.getByRole('option', { name: 'New York, United States' }).click();
  await expect(page.getByRole('button', { name: 'Show on map' })).toBeVisible();
  await expect(map).toHaveAttribute('data-map-center', center!);
  await expect(map).toHaveAttribute('data-map-zoom', zoom!);
  expect(await page.locator('.print-frame').boundingBox()).toEqual(frame);
  await page.getByRole('button', { name: 'Show on map' }).click();
  await expect(map).toHaveAttribute('data-map-center', '-73.9857,40.7484');
  const handle = await page.getByRole('button', { name: 'Move New York, United States' }).boundingBox();
  const mapBounds = await map.boundingBox();
  expect(handle!.x).toBeGreaterThanOrEqual(mapBounds!.x);
  expect(handle!.x + handle!.width).toBeLessThanOrEqual(mapBounds!.x + mapBounds!.width);
  await expect(page.getByRole('button', { name: 'Show on map' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Select (V)' })).toBeFocused();
  expect(requests).toBe(1);
});
}

test('outside clicks and keyboard departure dismiss results but retain the query', async ({ page }) => {
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', (route) => route.fulfill({ json: result }));
  await page.goto('./');
  const input = page.getByRole('combobox', { name: 'Search places and addresses' });
  await input.fill('New York');
  await input.press('Enter');
  await expect(page.getByRole('listbox', { name: 'Location results' })).toBeVisible();
  await page.locator('.maplibregl-canvas').click({ position: { x: 200, y: 220 } });
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(input).toHaveValue('New York');
  await input.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  await input.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(input).toHaveValue('New York');
});
