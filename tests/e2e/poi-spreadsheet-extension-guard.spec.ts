import { expect, test } from '@playwright/test';
import type { ProjectDocument } from '../../src/domain/project';
import { addCoordinate, downloadProject } from './map-recovery-support';

for (const endpoint of ['start', 'end'] as const) {
  test(`Extend ${endpoint} preserves POI lists on cancellation and resumes the intended route only after discard`, async ({ page }, testInfo) => {
    let lookups = 0;
    await page.route('https://api.mapbox.com/search/geocode/v6/forward**', async (route) => {
      lookups += 1;
      await route.fulfill({
        json: {
          type: 'FeatureCollection',
          features: [{
            id: 'address.retained',
            geometry: { type: 'Point', coordinates: [16.365, 48.2105] },
            properties: { full_address: 'Matched Vienna, Austria' },
          }],
        },
      });
    });
    await page.goto('./');
    await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Place (P)' }).click();
    await page.getByRole('button', { name: 'Paste POI list' }).click();
    const input = page.getByRole('textbox', { name: 'POI spreadsheet rows' });
    await input.fill('Coordinate list\t16.4\t48.2');
    await page.getByRole('radio', { name: 'Addresses' }).check();
    await input.fill('Address list\tVienna');
    await page.getByRole('button', { name: 'Look up addresses' }).click();
    await expect(page.getByText('Matched location: Matched Vienna, Austria', { exact: true })).toBeVisible();
    const before: ProjectDocument = await downloadProject(page);
    await page.getByRole('button', { name: 'Select Route 01' }).click();
    await page.getByRole('button', { name: `Extend ${endpoint}`, exact: true }).click();
    const decision = page.getByRole('dialog', { name: 'Discard unadded POI lists?' });
    await expect(decision).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`ux-fix-035-extend-${endpoint}-decision.png`), animations: 'disabled' });
    await decision.getByRole('button', { name: 'Keep editing lists' }).click();
    await expect(page.getByText('Matched location: Matched Vienna, Austria', { exact: true })).toBeVisible();
    await page.getByRole('radio', { name: 'Coordinates' }).check();
    await expect(input).toHaveValue('Coordinate list\t16.4\t48.2');
    await expect(page.getByRole('region', { name: 'POI list messages' })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`ux-fix-035-extend-${endpoint}-kept.png`), animations: 'disabled' });
    await page.getByRole('radio', { name: 'Addresses' }).check();
    await page.getByRole('button', { name: 'Back to pasted rows' }).click();
    await expect(input).toHaveValue('Address list\tVienna');
    await page.getByRole('button', { name: 'Return to review' }).click();
    expect(lookups).toBe(1);
    expect(await downloadProject(page)).toEqual(before);
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: `Extend ${endpoint}`, exact: true }).click();
    await decision.getByRole('button', { name: 'Discard lists' }).click();
    await expect(page.getByText(`Extending Route 01 from its ${endpoint}.`, { exact: true })).toBeVisible();
    await expect(page.getByRole('form', { name: 'Place multiple points' })).toHaveCount(0);
    expect(await downloadProject(page)).toEqual(before);

    await addCoordinate(page, 'route', '16.45', '48.24');
    await page.getByRole('button', { name: 'Finish route' }).click();
    await expect(page.getByRole('button', { name: 'Select Route 01' })).toHaveAttribute('aria-current', 'true');
    const after: ProjectDocument = await downloadProject(page);
    const original = before.layers.find((layer) => layer.id === 'route-01');
    const extended = after.layers.find((layer) => layer.id === 'route-01');
    if (original?.geometry?.type !== 'LineString' || extended?.geometry?.type !== 'LineString') throw new Error('Expected the same straight route');
    expect(after.layers).toHaveLength(before.layers.length);
    expect(extended.geometry.coordinates).toEqual(endpoint === 'start'
      ? [[16.45, 48.24], ...original.geometry.coordinates]
      : [...original.geometry.coordinates, [16.45, 48.24]]);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect(await downloadProject(page)).toEqual(before);
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    expect(lookups).toBe(1);
  });
}
