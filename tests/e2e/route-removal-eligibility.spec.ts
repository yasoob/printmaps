import { expect, test, type Page } from '@playwright/test';
import type { ContentLayer, RouteKind } from '../../src/domain/project';
import { basicRouteProject, installDirectionsMock, openAdvanced, openProject, routeLayer } from './advanced-route-test-support';
import { downloadProject, openInstrumentedMap } from './map-recovery-support';

function loopProject(kind: RouteKind, count: 3 | 4) {
  const project = basicRouteProject();
  const layer = routeLayer(project);
  const available: [number, number][] = [[16.35, 48.2], [16.38, 48.22], [16.4, 48.2], [16.38, 48.18]];
  const points = available.slice(0, count);
  points.push([...points[0]]);
  layer.route = { kind, closed: true };
  layer.geometry = kind === 'arc'
    ? { type: 'Arc', anchors: [points[0], points[1], ...points.slice(2)], curvatures: [0.2, ...Array.from({ length: count - 1 }, () => 0.2)] }
    : { type: 'LineString', coordinates: points };
  if (layer.appearance?.kind !== 'route') throw new Error('Expected route appearance');
  layer.appearance.segmentStyles = Array.from({ length: count }, () => null);
  if (kind === 'road') layer.provenance = {
    provider: 'mapbox', service: 'directions-v5', profile: 'walking',
    waypoints: points, distanceMeters: 1000, durationSeconds: 100,
  };
  return project;
}

function semanticCount(layer: ContentLayer) {
  if (layer.provenance?.service === 'directions-v5') return layer.provenance.waypoints.length;
  if (layer.geometry?.type === 'Arc') return layer.geometry.anchors.length;
  if (layer.geometry?.type === 'LineString') return layer.geometry.coordinates.length;
  throw new Error('Expected route geometry');
}

async function selectRoute(page: Page, isMobile: boolean, noun: string) {
  if (isMobile) await page.getByRole('button', { name: 'Open layers', exact: true }).click();
  await page.getByRole('button', { name: 'Select Route 01', exact: true }).click();
  await openAdvanced(page);
  await page.getByRole('combobox', { name: `Route ${noun}`, exact: true }).selectOption('1');
}

for (const scenario of [
  { kind: 'straight', width: 1440 },
  { kind: 'arc', width: 1440 },
  { kind: 'road', width: 1440 },
  { kind: 'straight', width: 320 },
] as const) {
  test(`UX044 ${scenario.kind} at ${scenario.width}px explains the minimum and removes only above it`, async ({ page }, info) => {
    const isMobile = scenario.width < 900;
    const noun = scenario.kind === 'road' ? 'waypoint' : 'anchor';
    const requests = await installDirectionsMock(page);
    await page.setViewportSize({ width: scenario.width, height: 900 });
    await openInstrumentedMap(page);
    await openProject(page, loopProject(scenario.kind, 3));
    const before = await downloadProject(page);
    await selectRoute(page, isMobile, noun);
    const remove = page.getByRole('button', { name: `Remove selected route ${noun}`, exact: true });
    await expect(remove).toBeDisabled();
    await expect(remove).toHaveAccessibleDescription('Closed routes need at least three distinct points.');
    const hint = page.locator('.route-removal-hint');
    await hint.scrollIntoViewIfNeeded();
    await expect(hint).toBeVisible();
    expect(await hint.evaluate((element) => Number(getComputedStyle(element).fontSize.replace('px', '')))).toBeGreaterThanOrEqual(12);
    await page.screenshot({ path: info.outputPath('ux-fix-044-minimum.png'), animations: 'disabled' });
    if (isMobile) await page.getByRole('button', { name: 'Close properties', exact: true }).click();
    expect(await downloadProject(page)).toEqual(before);
    expect(requests.requests).toHaveLength(0);

    await openProject(page, loopProject(scenario.kind, 4));
    const larger = await downloadProject(page);
    await selectRoute(page, isMobile, noun);
    await expect(remove).toBeEnabled();
    await remove.click();
    await expect(remove).toBeDisabled();
    await expect(remove).toHaveAccessibleDescription('Closed routes need at least three distinct points.');
    if (isMobile) await page.getByRole('button', { name: 'Close properties', exact: true }).click();
    const after = await downloadProject(page);
    expect(routeLayer(after).route).toEqual({ kind: scenario.kind, closed: true });
    expect(semanticCount(routeLayer(after))).toBe(4);
    expect(requests.requests).toHaveLength(scenario.kind === 'road' ? 1 : 0);
    if (isMobile) {
      await page.getByRole('button', { name: 'Project', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Undo', exact: true }).click();
    } else {
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
    }
    expect(await downloadProject(page)).toEqual(larger);
    expect(await page.evaluate(() => window.recoveryRuntimeErrors)).toEqual([]);
    await info.attach('ux-fix-044-documents', {
      body: JSON.stringify({ before, larger, after, directionsRequests: requests.requests.length }, null, 2),
      contentType: 'application/json',
    });
  });
}
