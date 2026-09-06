import { expect, test, type Page } from '@playwright/test';
import type { GeoJSONSource } from 'maplibre-gl';
import { installDirectionsMock, markerParityProject, openProject } from './advanced-route-test-support';
import { downloadProject, openInstrumentedMap } from './map-recovery-support';

async function renderedRoadCoordinates(page: Page) {
  return page.evaluate(async () => {
    const source = window.recoveryAudit.map!.getSource<GeoJSONSource>('studio-source-8:car-road');
    if (!source) throw new Error('Road source unavailable');
    const data = await source.getData();
    if (data.type !== 'FeatureCollection') throw new Error('Expected route feature collection');
    return data.features.flatMap((feature) => (
      feature.properties?.featureKind === 'segment' && feature.geometry.type === 'LineString'
        ? [feature.geometry.coordinates] : []
    ));
  });
}

for (const input of ['pointer', 'keyboard'] as const) {
  test(`a rejected fresh Road ${input} edit preserves the routed path after Undo`, async ({ page }, testInfo) => {
    const directions = await installDirectionsMock(page);
    await openInstrumentedMap(page);
    const project = markerParityProject();
    await openProject(page, project);
    await page.getByRole('button', { name: 'Select Car Road' }).click();
    const waypoint = page.getByRole('button', { name: 'Drag route waypoint 1', exact: true });
    await expect(waypoint).toBeVisible();
    const original = await renderedRoadCoordinates(page);
    expect(original[0]).toHaveLength(3);

    await waypoint.press('ArrowRight');
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
    await expect.poll(() => renderedRoadCoordinates(page)).not.toEqual(original);
    directions.setMode('fail');
    await waypoint.press('ArrowRight');
    await expect(page.getByRole('alert').filter({ hasText: 'Mapbox is temporarily unavailable' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => renderedRoadCoordinates(page)).toEqual(original);
    const current = await downloadProject(page);

    if (input === 'pointer') {
      const bounds = await waypoint.boundingBox();
      if (!bounds) throw new Error('Waypoint handle unavailable');
      const x = bounds.x + bounds.width / 2;
      const y = bounds.y + bounds.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 35, y + 20, { steps: 5 });
      await page.mouse.up();
    } else {
      await waypoint.press('ArrowRight');
    }
    await expect(page.getByRole('alert').filter({ hasText: 'Mapbox is temporarily unavailable' }).first()).toBeVisible();
    await expect.poll(() => renderedRoadCoordinates(page)).toEqual(original);
    expect(await downloadProject(page)).toEqual(current);
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled();
    expect(directions.requests).toHaveLength(3);
    await page.screenshot({ path: testInfo.outputPath(`ux-fix-026-road-${input}-rollback.png`), animations: 'disabled' });
    expect(await page.evaluate(() => window.recoveryRuntimeErrors)).toEqual([]);
  });
}
