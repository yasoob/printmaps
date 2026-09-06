import { writeFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { GeoJSONSource } from 'maplibre-gl';
import type { ProjectDocument } from '../../src/domain/project';
import { basicRouteProject, downloadLayeredSvg, openAdvanced, openProject, routeLayer } from './advanced-route-test-support';
import { downloadProject, openInstrumentedMap } from './map-recovery-support';

const a: [number, number] = [16.35, 48.2], b: [number, number] = [16.38, 48.22], c: [number, number] = [16.4, 48.2];
const exact: [number, number][] = [a, b, [16.395, 48.205], c, a];
type ResponseMode = 'exact' | 'rounded' | 'near' | 'incomplete' | 'hold';

function projectFixture(isClosed = true) {
  const project = basicRouteProject();
  project.title = 'UX041 closed route';
  const layer = routeLayer(project);
  layer.route = { kind: 'straight', closed: isClosed };
  layer.geometry = { type: 'LineString', coordinates: isClosed ? [a, b, c, a] : [a, b, c] };
  if (layer.appearance?.kind !== 'route') throw new Error('Expected route appearance');
  layer.appearance.segmentStyles = [
    { color: '#ff0000', width: 7, strokeStyle: 'dashed' }, { color: '#00aa00', width: 3 },
    ...(isClosed ? [{ color: '#0000ff', width: 5 }] : []),
  ];
  return project;
}

async function matchingMock(page: Page, initial: ResponseMode) {
  let mode = initial, release: (() => void) | undefined;
  const traces: number[][][] = [], aborted: string[] = [];
  page.on('requestfailed', (request) => {
    if (request.url().includes('/matching/v5/')) aborted.push(request.failure()?.errorText ?? 'aborted');
  });
  await page.route('https://api.mapbox.com/matching/v5/mapbox/**', async (route) => {
    const requestMode = mode, url = new URL(route.request().url());
    const trace = decodeURIComponent(url.pathname.split('/').at(-1)!).split(';').map((point) => point.split(',').map(Number));
    traces.push(trace);
    expect(url.searchParams.get('radiuses')).toBe(trace.map(() => '50').join(';'));
    if (requestMode === 'hold') await new Promise<void>((resolve) => { release = resolve; });
    const geometry = exact.map((point) => [...point]);
    switch (requestMode) {
    case 'rounded': {
    geometry[geometry.length - 1] = [16.3500004, 48.2000004];
    break;
    }
    case 'near': {
    geometry[geometry.length - 1] = [16.350001, 48.2];
    break;
    }
    case 'incomplete': { {
    geometry.pop();
    // No default
    }
    break;
    }
    }
    try {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'Ok', matchings: [{ confidence: 0.93, geometry: { type: 'LineString', coordinates: geometry } }],
          tracepoints: trace.map((_, waypoint_index) => ({ matchings_index: 0, waypoint_index })),
        }),
      });
    } catch {
      // Retirement deliberately aborts the held browser request.
    }
  });
  return { traces, aborted, release: () => release?.(), setMode: (next: ResponseMode) => { mode = next; } };
}

async function openRoute(page: Page, project: ProjectDocument) {
  await openInstrumentedMap(page);
  await openProject(page, project);
  await page.getByRole('button', { name: 'Select Route 01', exact: true }).click();
  await openAdvanced(page);
}

async function nativeRoute(page: Page) {
  return page.evaluate(async () => {
    const data = await window.recoveryAudit.map!.getSource<GeoJSONSource>('studio-source-8:route-01')!.getData();
    if (data.type !== 'FeatureCollection') throw new Error('Expected route collection');
    const legs = data.features.flatMap((feature) => feature.geometry.type === 'LineString' && feature.properties?.featureKind === 'segment'
      ? [{ coordinates: feature.geometry.coordinates, color: feature.properties.color, width: feature.properties.width }] : []);
    return { coordinates: [legs[0].coordinates[0], ...legs.map((leg) => leg.coordinates.at(-1))], legs };
  });
}

async function evidence(page: Page, info: TestInfo, label: string, data: object) {
  const runtimeErrors = await page.evaluate(() => window.recoveryRuntimeErrors);
  expect(runtimeErrors).toEqual([]);
  await writeFile(info.outputPath(`UX041-${label}.json`), JSON.stringify({ mockedProvider: true, ...data, runtimeErrors }, null, 2));
  await page.screenshot({ path: info.outputPath(`UX041-${label}.png`), animations: 'disabled' });
}

for (const response of ['exact', 'rounded'] as const) {
  test(`a UI-closed Straight route accepts ${response} matching and stays a portable closed loop`, async ({ page }, info) => {
    const mock = await matchingMock(page, response);
    await openRoute(page, projectFixture(false));
    await page.getByRole('button', { name: 'Close loop', exact: true }).click();
    const before: ProjectDocument = await downloadProject(page);
    await page.getByRole('button', { name: 'Snap route to roads', exact: true }).click();
    await expect(page.getByText('Matched to roads · 93% confidence · 4 source points', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open loop', exact: true })).toBeVisible();
    expect(mock.traces).toEqual([[a, b, c, a]]);
    const after: ProjectDocument = await downloadProject(page), layer = routeLayer(after);
    expect(layer.route).toEqual({ kind: 'straight', closed: true });
    expect(layer.geometry).toEqual({ type: 'LineString', coordinates: exact });
    expect(layer.provenance).toEqual({
      provider: 'mapbox', service: 'map-matching-v5', profile: 'driving', sourcePointCount: 4, confidence: 0.93,
    });
    expect(after.camera).toEqual(before.camera);
    await expect.poll(async () => { const native = await nativeRoute(page); return native.coordinates; }).toEqual(exact);
    const native = await nativeRoute(page);
    expect(native.legs[0]).toMatchObject({ color: '#ff0000', width: 7 });
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect(await downloadProject(page)).toEqual(before);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    expect(await downloadProject(page)).toEqual(after);
    const svg = await downloadLayeredSvg(page, info, `UX041-${response}`);
    expect(svg).toContain('© Mapbox');
    expect((svg.match(/data-route-leg=/g) ?? [])).toHaveLength(4);
    expect(mock.traces).toHaveLength(1);
    await evidence(page, info, response, { before, after, native, traces: mock.traces });
  });
}

for (const response of ['near', 'incomplete'] as const) {
  test(`${response} matching explains closure failure, preserves the loop and allows an exact retry`, async ({ page }, info) => {
    const mock = await matchingMock(page, response);
    await openRoute(page, projectFixture());
    const before: ProjectDocument = await downloadProject(page), nativeBefore = await nativeRoute(page);
    await page.getByRole('button', { name: 'Snap route to roads', exact: true }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'The matched route does not close' });
    await expect(alert).toContainText('The closed route was kept. Use Open loop first if you want an open route.');
    const error = await alert.textContent();
    await page.screenshot({ path: info.outputPath(`UX041-${response}-rejection.png`), animations: 'disabled' });
    const rejected: ProjectDocument = await downloadProject(page);
    expect(rejected).toEqual(before);
    expect(await nativeRoute(page)).toEqual(nativeBefore);
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Open loop', exact: true })).toBeVisible();
    mock.setMode('exact');
    await page.getByRole('button', { name: 'Snap route to roads', exact: true }).click();
    await expect(page.getByText('Matched to roads · 93% confidence · 4 source points', { exact: true })).toBeVisible();
    const after: ProjectDocument = await downloadProject(page);
    expect(routeLayer(after).route?.closed).toBe(true);
    expect(routeLayer(after).geometry).toEqual({ type: 'LineString', coordinates: exact });
    expect(mock.traces).toHaveLength(2);
    await evidence(page, info, `${response}-retry`, { before, rejected, error, nativeBefore, after, traces: mock.traces });
  });
}

for (const retirement of ['open', 'lock', 'replacement'] as const) {
  test(`a held closed match cannot apply after ${retirement}`, async ({ page }, info) => {
    const mock = await matchingMock(page, 'hold');
    await openRoute(page, projectFixture());
    await page.getByRole('button', { name: 'Snap route to roads', exact: true }).click();
    await expect.poll(() => mock.traces.length).toBe(1);
    if (retirement === 'replacement') {
      const replacement = projectFixture(false);
      replacement.id = 'replacement-UX041';
      replacement.title = 'Replacement after matching';
      await openProject(page, replacement);
    } else {
      await page.getByRole('button', { name: retirement === 'open' ? 'Open loop' : 'Lock Route 01', exact: true }).click();
      if (retirement === 'lock') await expect(page.getByRole('button', { name: 'Snap route to roads', exact: true })).toBeDisabled();
    }
    const beforeRelease: ProjectDocument = await downloadProject(page);
    await expect.poll(() => mock.aborted.length).toBe(1);
    mock.release();
    await expect(page.getByRole('button', { name: 'Matching route…', exact: true })).toHaveCount(0);
    expect(await downloadProject(page)).toEqual(beforeRelease);
    expect(routeLayer(beforeRelease).provenance).toBeUndefined();
    await evidence(page, info, `retired-${retirement}`, { beforeRelease, afterRelease: await downloadProject(page), aborted: mock.aborted, traces: mock.traces });
  });
}

test('explicit Open loop makes a non-closing matching result intentional and separately undoable', async ({ page }, info) => {
  const mock = await matchingMock(page, 'near');
  await openRoute(page, projectFixture());
  const closed: ProjectDocument = await downloadProject(page);
  await page.getByRole('button', { name: 'Snap route to roads', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Use Open loop first' })).toBeVisible();
  await page.getByRole('button', { name: 'Open loop', exact: true }).click();
  const opened: ProjectDocument = await downloadProject(page);
  await page.getByRole('button', { name: 'Snap route to roads', exact: true }).click();
  await expect(page.getByText('Matched to roads · 93% confidence · 3 source points', { exact: true })).toBeVisible();
  const after: ProjectDocument = await downloadProject(page);
  const expected = [...exact.slice(0, -1), [16.350001, 48.2]];
  expect(routeLayer(after).route).toEqual({ kind: 'straight', closed: false });
  expect(routeLayer(after).geometry).toEqual({ type: 'LineString', coordinates: expected });
  expect(mock.traces).toEqual([[a, b, c, a], [a, b, c]]);
  await expect.poll(async () => { const native = await nativeRoute(page); return native.coordinates; }).toEqual(expected);
  const native = await nativeRoute(page);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await downloadProject(page)).toEqual(opened);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await downloadProject(page)).toEqual(closed);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(await downloadProject(page)).toEqual(after);
  await evidence(page, info, 'explicit-open', { closed, opened, after, native, traces: mock.traces });
});
