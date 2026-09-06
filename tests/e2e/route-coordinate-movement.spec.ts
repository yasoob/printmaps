import { writeFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { GeoJSONSource } from 'maplibre-gl';
import type { TerraRouteDrawLike } from '../../src/map/TerraDrawRouteEditing';
import type { ContentLayer, ProjectDocument, RouteSegmentStyleOverride } from '../../src/domain/project';
import { basicRouteProject, convertRoute, downloadLayeredSvg, installDirectionsMock, openAdvanced, openProject, routeLayer } from './advanced-route-test-support';
import { downloadProject, openInstrumentedMap } from './map-recovery-support';

const styles: RouteSegmentStyleOverride[] = [
  { color: '#ff0000', width: 7, strokeStyle: 'dashed' },
  { color: '#00aa00', width: 3, strokeStyle: 'solid' },
  { color: '#0000ff', width: 5, strokeStyle: 'dashed' },
];

declare global {
  interface Window {
    movementTerra: { draw: TerraRouteDrawLike; events: { type: string; args: unknown[] }[] };
  }
}

async function traceTerra(page: Page) {
  await page.evaluate(async () => {
    const routeModule = performance.getEntriesByType('resource').map((entry) => entry.name)
      .find((entry) => entry.includes('/src/map/useTerraDrawRoutes.ts'));
    if (!routeModule) throw new Error('Route session module unavailable');
    const factory = new URL('TerraDrawRouteFactory.ts', routeModule).href;
    await import(factory);
    const url = performance.getEntriesByType('resource').map((entry) => entry.name)
      .find((entry) => /\/terra-draw\.js\?/.test(entry));
    if (!url) throw new Error('Native Terra module unavailable');
    const library = await import(url);
    const prototype = library.TerraDraw.prototype;
    const on = prototype.on;
    const events: { type: string; args: unknown[] }[] = [];
    prototype.on = function (this: TerraRouteDrawLike, type: string, listener: (...args: unknown[]) => void) {
      Object.assign(window, { movementTerra: { draw: this, events } });
      return on.call(this, type, (...args: unknown[]) => {
        events.push({ type, args });
        listener(...args);
      });
    };
  });
}

function projectFixture(kind: 'straight' | 'arc', isClosed = true) {
  const project = basicRouteProject();
  const layer = routeLayer(project);
  const points: [[number, number], [number, number], ...[number, number][]] = [[16.35, 48.2], [16.38, 48.22], [16.4, 48.2]];
  const curvatures: [number, ...number[]] = isClosed ? [0.7, -0.4, 0.9] : [0.7, -0.4];
  if (isClosed) points.push([...points[0]]);
  layer.route = { kind, closed: isClosed };
  layer.geometry = kind === 'arc'
    ? { type: 'Arc', anchors: points, curvatures }
    : { type: 'LineString', coordinates: points };
  if (layer.appearance?.kind !== 'route') throw new Error('Expected route appearance');
  layer.appearance.segmentStyles = styles.slice(0, points.length - 1).map((style) => ({ ...style }));
  return project;
}

async function openRoute(page: Page, project: ProjectDocument, isTerraTraced = false) {
  await openInstrumentedMap(page);
  if (isTerraTraced) await traceTerra(page);
  await openProject(page, project);
  await page.getByRole('button', { name: 'Select Route 01', exact: true }).click();
  await openAdvanced(page);
}

async function nativeLegs(page: Page) {
  return page.evaluate(async () => {
    const map = window.recoveryAudit.map!;
    const source = map.getSource<GeoJSONSource>('studio-source-8:route-01');
    if (!source) throw new Error('Route source is unavailable');
    const data = await source.getData();
    if (data.type !== 'FeatureCollection') throw new Error('Expected route features');
    return data.features.flatMap((feature) => {
      if (feature.properties?.featureKind !== 'segment' || feature.geometry.type !== 'LineString') return [];
      return [{
        index: feature.properties.segmentIndex as number,
        color: feature.properties.color as string,
        width: feature.properties.width as number,
        strokeStyle: feature.properties.strokeStyle as string,
        coordinates: feature.geometry.coordinates,
        projected: feature.geometry.coordinates.map((coordinate) => {
          const point = map.project([coordinate[0], coordinate[1]]);
          return [point.x, point.y];
        }),
      }];
    });
  });
}

async function svgLegs(page: Page, text: string) {
  return page.evaluate((svg) => {
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    return [...document.querySelectorAll<SVGPathElement>('[data-layer-id="route-01"] > path[data-route-leg]')].map((path) => {
      const d = path.getAttribute('d')!;
      const values = d.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)!.map(Number);
      return {
        index: Number(path.dataset.routeLeg),
        color: path.getAttribute('stroke'),
        width: Number(path.getAttribute('stroke-width')),
        dash: path.getAttribute('stroke-dasharray'),
        d,
        points: values.flatMap((value, index) => index % 2 === 0 ? [[value, values[index + 1]]] : []),
      };
    });
  }, text);
}

function normalized(points: number[][]) {
  const x = points.map((point) => point[0]), y = points.map((point) => point[1]);
  const left = Math.min(...x), top = Math.min(...y);
  const width = Math.max(...x) - left, height = Math.max(...y) - top;
  return points.map((point) => [(point[0] - left) / width, (point[1] - top) / height]);
}

async function expectExportParity(page: Page, testInfo: TestInfo, label: string) {
  const native = await nativeLegs(page);
  const svg = await downloadLayeredSvg(page, testInfo, `ux-fix-038-${label}`);
  const exported = await svgLegs(page, svg);
  expect(exported).toHaveLength(native.length);
  for (const [index, leg] of native.entries()) {
    expect(exported[index]).toMatchObject({ index, color: leg.color });
    expect(exported[index].width).toBeCloseTo(leg.width * 0.3, 3);
    expect(exported[index].dash === null).toBe(leg.strokeStyle === 'solid');
    if (exported[index].dash) {
      const dash = exported[index].dash!.split(' ').map(Number);
      expect(dash[0]).toBeCloseTo(leg.width * 0.6, 3);
      expect(dash[1]).toBeCloseTo(leg.width * 0.45, 3);
    }
    expect(exported[index].points).toHaveLength(leg.coordinates.length);
  }
  const livePoints = normalized(native.flatMap((leg) => leg.projected));
  const outputPoints = normalized(exported.flatMap((leg) => leg.points));
  for (const [index, point] of livePoints.entries()) {
    expect(Math.hypot(point[0] - outputPoints[index][0], point[1] - outputPoints[index][1])).toBeLessThan(0.0005);
  }
  return { native, exported };
}

function expectAppearance(before: ContentLayer, after: ContentLayer) {
  expect(after.appearance).toEqual(before.appearance);
  if (before.geometry?.type === 'Arc') {
    expect(after.geometry).toMatchObject({ curvatures: before.geometry.curvatures });
  }
}

async function expectUndoRedo(page: Page, before: ProjectDocument, after: ProjectDocument) {
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await downloadProject(page)).toEqual(before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(await downloadProject(page)).toEqual(after);
}

async function evidence(page: Page, testInfo: TestInfo, label: string, data: object) {
  const runtimeErrors = await page.evaluate(() => window.recoveryRuntimeErrors);
  expect(runtimeErrors).toEqual([]);
  await writeFile(testInfo.outputPath(`ux-fix-038-${label}.json`), JSON.stringify({ ...data, runtimeErrors }, null, 2));
  await page.screenshot({ path: testInfo.outputPath(`ux-fix-038-${label}.png`), animations: 'disabled' });
}

test('closing and converting a route preserves the red override and 0.7 bend when only Anchor 2 longitude changes', async ({ page }, testInfo) => {
  const project = projectFixture('straight', false);
  const initial = routeLayer(project);
  if (initial.appearance?.kind !== 'route') throw new Error('Expected route appearance');
  initial.appearance.segmentStyles = [null, null];
  await openRoute(page, project);
  await page.getByRole('button', { name: 'Close loop', exact: true }).click();
  await convertRoute(page, 'arc');
  await page.getByRole('checkbox', { name: 'Inherit route segment color', exact: true }).uncheck();
  await page.locator('input[aria-label="Route segment color"]').fill('#ff0000');
  await page.getByRole('spinbutton', { name: 'Arc curvature amount', exact: true }).fill('0.7');
  await page.getByRole('button', { name: 'Project', exact: true }).focus();
  const before: ProjectDocument = await downloadProject(page);
  const beforeParity = await expectExportParity(page, testInfo, 'original-before');
  await page.getByRole('combobox', { name: 'Route anchor', exact: true }).selectOption('1');
  await page.getByRole('textbox', { name: 'Route anchor longitude', exact: true }).fill('16.385');
  await page.getByRole('button', { name: 'Project', exact: true }).focus();
  const after: ProjectDocument = await downloadProject(page);
  expectAppearance(routeLayer(before), routeLayer(after));
  expect(routeLayer(after).geometry).toMatchObject({ anchors: [[16.35, 48.2], [16.385, 48.22], [16.4, 48.2], [16.35, 48.2]], curvatures: [0.7, 0.35, 0.35] });
  expect(routeLayer(after).appearance).toMatchObject({ segmentStyles: [{ color: '#ff0000' }, null, null] });
  await expect(page.getByRole('spinbutton', { name: 'Arc curvature amount', exact: true })).toHaveValue('0.7');
  const afterParity = await expectExportParity(page, testInfo, 'original-after');
  expect(afterParity.native[2]).toEqual(beforeParity.native[2]);
  expect(afterParity.exported[0].d).not.toEqual(beforeParity.exported[0].d);
  expect(afterParity.exported[2].d).toEqual(beforeParity.exported[2].d);
  await expectUndoRedo(page, before, after);
  await evidence(page, testInfo, 'original-repro', { before, after, beforeParity, afterParity });
});

for (const kind of ['straight', 'arc'] as const) {
  for (const input of ['keyboard', 'pointer'] as const) {
    test(`${kind} ${input} moves retain distinct logical styles and bends across middle and both closing handles`, async ({ page }, testInfo) => {
      await openRoute(page, projectFixture(kind));
      const moves = [];
      for (const index of [1, 0, 3]) {
        const before: ProjectDocument = await downloadProject(page);
        const nativeBefore = await nativeLegs(page);
        const handle = page.getByRole('button', { name: `Drag route anchor ${index + 1}`, exact: true });
        let preview;
        if (input === 'keyboard') await handle.press(index === 1 ? 'ArrowRight' : 'ArrowUp');
        else {
          const bounds = await handle.boundingBox();
          if (!bounds) throw new Error('Route handle unavailable');
          const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x + 22, y - 16, { steps: 8 });
          await expect.poll(() => nativeLegs(page)).not.toEqual(nativeBefore);
          preview = await nativeLegs(page);
          await page.mouse.up();
        }
        await expect.poll(async () => routeLayer(await downloadProject(page)).geometry).not.toEqual(routeLayer(before).geometry);
        const after: ProjectDocument = await downloadProject(page);
        const nativeAfter = await nativeLegs(page);
        expectAppearance(routeLayer(before), routeLayer(after));
        expect(after.camera).toEqual(before.camera);
        const geometry = routeLayer(after).geometry;
        const points = geometry?.type === 'Arc' ? geometry.anchors : (geometry?.type === 'LineString' ? geometry.coordinates : []);
        expect(points).toHaveLength(4);
        expect(points[0]).toEqual(points[3]);
        expect(nativeAfter.map(({ index: leg, color, width, strokeStyle }) => ({ index: leg, color, width, strokeStyle })))
          .toEqual(styles.map((style, leg) => ({ index: leg, ...style })));
        if (preview) expect(nativeAfter).toEqual(preview);
        await expectUndoRedo(page, before, after);
        moves.push({ index, before, after, nativeBefore, nativeAfter, preview });
      }
      const parity = await expectExportParity(page, testInfo, `${kind}-${input}`);
      await evidence(page, testInfo, `${kind}-${input}`, { moves, parity });
    });
  }
}

test('the real Terra Draw closing handle moves rather than inserts a fourth semantic vertex', async ({ page }, testInfo) => {
  await openRoute(page, projectFixture('straight'), true);
  await expect.poll(() => page.evaluate(() => Boolean(window.recoveryAudit.map!.getLayer('studio-route-editor-point')))).toBe(true);
  await page.addStyleTag({ content: '.route-vertex-marker { pointer-events: none !important; }' });
  const before: ProjectDocument = await downloadProject(page);
  const nativeBefore = await nativeLegs(page);
  const point = await page.evaluate(() => {
    const map = window.recoveryAudit.map!;
    const projected = map.project([16.35, 48.2]);
    const box = map.getContainer().getBoundingClientRect();
    return { x: projected.x + box.left, y: projected.y + box.top };
  });
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y) instanceof HTMLCanvasElement, point)).toBe(true);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x - 24, point.y + 18, { steps: 8 });
  await writeFile(testInfo.outputPath('ux-fix-038-terra-preview-events.json'), JSON.stringify(await page.evaluate(() => ({
    events: window.movementTerra.events,
    snapshot: window.movementTerra.draw.getSnapshot(),
  })), null, 2));
  await expect.poll(() => nativeLegs(page)).not.toEqual(nativeBefore);
  await page.mouse.up();
  await writeFile(testInfo.outputPath('ux-fix-038-terra-events.json'), JSON.stringify(await page.evaluate(() => ({
    events: window.movementTerra.events,
    snapshot: window.movementTerra.draw.getSnapshot(),
  })), null, 2));
  await expect.poll(async () => routeLayer(await downloadProject(page)).geometry).not.toEqual(routeLayer(before).geometry);
  const after: ProjectDocument = await downloadProject(page);
  const layer = routeLayer(after);
  if (layer.geometry?.type !== 'LineString') throw new Error('Expected Straight');
  expect(layer.geometry.coordinates).toHaveLength(4);
  expect(layer.geometry.coordinates[0]).toEqual(layer.geometry.coordinates[3]);
  expect(layer.geometry.coordinates[0]).not.toEqual([16.35, 48.2]);
  expectAppearance(routeLayer(before), layer);
  expect(after.camera).toEqual(before.camera);
  const nativeFeature = await page.evaluate(() => window.movementTerra.draw.getSnapshot().find((feature) => feature.geometry.type === 'LineString'));
  expect(nativeFeature?.geometry).toEqual(layer.geometry);
  await expectUndoRedo(page, before, after);
  const parity = await expectExportParity(page, testInfo, 'terra-closing');
  await evidence(page, testInfo, 'terra-closing', { before, after, parity });
});

for (const target of ['vertex', 'midpoint'] as const) {
test(`canceling a real Terra ${target} preview restores canonical content without changing history`, async ({ page }, testInfo) => {
  await openRoute(page, projectFixture('straight'), true);
  await page.addStyleTag({ content: '.route-vertex-marker { pointer-events: none !important; }' });
  const before: ProjectDocument = await downloadProject(page);
  const nativeBefore = await nativeLegs(page);
  const point = await page.evaluate((isMidpoint) => {
    const map = window.recoveryAudit.map!;
    const projected = map.project([16.38, 48.22]);
    if (isMidpoint) {
      const first = map.project([16.35, 48.2]);
      projected.x = (first.x + projected.x) / 2;
      projected.y = (first.y + projected.y) / 2;
    }
    const box = map.getContainer().getBoundingClientRect();
    return { x: projected.x + box.left, y: projected.y + box.top };
  }, target === 'midpoint');
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 24, point.y - 18, { steps: 8 });
  await expect.poll(() => nativeLegs(page)).not.toEqual(nativeBefore);
  await page.getByRole('button', { name: 'Select Paper basemap', exact: true }).press('Enter');
  await page.mouse.up();
  await expect.poll(() => nativeLegs(page)).toEqual(nativeBefore);
  expect(await downloadProject(page)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await evidence(page, testInfo, `terra-cancel-${target}`, { before, after: await downloadProject(page), nativeBefore, nativeAfter: await nativeLegs(page) });
});
}

test('real Terra midpoint insertion previews and commits split leg styling instead of applying move semantics', async ({ page }, testInfo) => {
  await openRoute(page, projectFixture('straight'), true);
  const before: ProjectDocument = await downloadProject(page);
  const point = await page.evaluate(() => {
    const map = window.recoveryAudit.map!;
    const first = map.project([16.35, 48.2]), second = map.project([16.38, 48.22]);
    const box = map.getContainer().getBoundingClientRect();
    return { x: (first.x + second.x) / 2 + box.left, y: (first.y + second.y) / 2 + box.top };
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x - 25, point.y - 20, { steps: 8 });
  await expect.poll(async () => { const legs = await nativeLegs(page); return legs.length; }).toBe(4);
  const proposal = await page.evaluate(() => window.movementTerra.draw.getSnapshot().find((feature) => feature.geometry.type === 'LineString')!.geometry.coordinates);
  await expect.poll(async () => {
    const legs = await nativeLegs(page);
    return [legs[0].coordinates[0], ...legs.map((leg) => leg.coordinates.at(-1))];
  }).toEqual(proposal);
  const preview = await nativeLegs(page);
  await page.mouse.up();
  const after: ProjectDocument = await downloadProject(page);
  const updated = routeLayer(after);
  expect(updated.appearance).toMatchObject({ segmentStyles: [styles[0], styles[0], styles[1], styles[2]] });
  if (updated.geometry?.type !== 'LineString') throw new Error('Expected Straight');
  expect(updated.geometry.coordinates).toHaveLength(5);
  expect(updated.geometry.coordinates[0]).toEqual(updated.geometry.coordinates[4]);
  await expect.poll(() => nativeLegs(page)).toEqual(preview);
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true');
  await expectUndoRedo(page, before, after);
  const parity = await expectExportParity(page, testInfo, 'terra-insert');
  await evidence(page, testInfo, 'terra-insert', { before, after, preview, parity });
});

for (const isLocked of [false, true]) {
test(`native pointercancel abandons a midpoint before release and the next vertex drag, camera locked=${isLocked}`, async ({ page }, testInfo) => {
  const project = projectFixture('straight');
  project.camera.locked = isLocked;
  await openRoute(page, project, true);
  await page.addStyleTag({ content: '.route-vertex-marker { pointer-events: none !important; }' });
  const before: ProjectDocument = await downloadProject(page);
  const nativeBefore = await nativeLegs(page);
  const targets = await page.evaluate(() => {
    const map = window.recoveryAudit.map!, box = map.getContainer().getBoundingClientRect();
    const a = map.project([16.35, 48.2]), b = map.project([16.38, 48.22]);
    const canvas = map.getCanvas();
    canvas.addEventListener('pointerdown', (event) => {
      canvas.dataset.cancelPointerId = String(event.pointerId);
      canvas.dataset.cancelPointerType = event.pointerType;
    }, { once: true, capture: true });
    return {
      midpoint: { x: (a.x + b.x) / 2 + box.left, y: (a.y + b.y) / 2 + box.top },
      vertex: { x: b.x + box.left, y: b.y + box.top },
      camera: { center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() },
    };
  });
  await page.mouse.move(targets.midpoint.x, targets.midpoint.y);
  await page.mouse.down();
  await page.mouse.move(targets.midpoint.x - 25, targets.midpoint.y - 20, { steps: 8 });
  await expect.poll(() => page.evaluate(() =>
    window.movementTerra.draw.getSnapshot().find((feature) => feature.geometry.type === 'LineString')!.geometry.coordinates,
  )).toHaveLength(5);
  await expect.poll(async () => { const legs = await nativeLegs(page); return legs.length; }).toBe(4);
  await page.evaluate(() => {
    const canvas = window.recoveryAudit.map!.getCanvas();
    canvas.dispatchEvent(new PointerEvent('pointercancel', {
      bubbles: true, isPrimary: true, pointerId: Number(canvas.dataset.cancelPointerId), pointerType: canvas.dataset.cancelPointerType,
    }));
  });
  await expect.poll(() => nativeLegs(page)).toEqual(nativeBefore);
  const canceledNative = await page.evaluate(() =>
    window.movementTerra.draw.getSnapshot().find((feature) => feature.geometry.type === 'LineString')!.geometry,
  );
  expect(canceledNative).toEqual(routeLayer(before).geometry);
  await page.mouse.up();
  const canceled: ProjectDocument = await downloadProject(page);
  expect(canceled).toEqual(before);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Route anchor', exact: true })).toBeVisible();
  const interactions = await page.evaluate(() => ({
    pan: window.recoveryAudit.map!.dragPan.isEnabled(), keyboard: window.recoveryAudit.map!.keyboard.isEnabled(),
  }));
  expect(interactions).toEqual({ pan: !isLocked, keyboard: !isLocked });
  await page.mouse.move(targets.vertex.x, targets.vertex.y);
  await page.mouse.down();
  await page.mouse.move(targets.vertex.x + 22, targets.vertex.y - 15, { steps: 8 });
  await page.mouse.up();
  const after: ProjectDocument = await downloadProject(page);
  const updated = routeLayer(after);
  if (updated.geometry?.type !== 'LineString') throw new Error('Expected Straight');
  expect(updated.geometry.coordinates).toHaveLength(4);
  expect(updated.geometry.coordinates[0]).toEqual([16.35, 48.2]);
  expect(updated.geometry.coordinates[1]).not.toEqual([16.38, 48.22]);
  expect(updated.geometry.coordinates.slice(2)).toEqual([[16.4, 48.2], [16.35, 48.2]]);
  expectAppearance(routeLayer(before), updated);
  expect(after.camera).toEqual(before.camera);
  const camera = await page.evaluate(() => {
    const map = window.recoveryAudit.map!;
    return { center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
  });
  expect(camera).toEqual(targets.camera);
  await expectUndoRedo(page, before, after);
  const label = `pointercancel-locked-${isLocked}`;
  const parity = await expectExportParity(page, testInfo, label);
  await evidence(page, testInfo, label, { before, canceled, canceledNative, after, nativeBefore, interactions, camera, parity });
});
}

test('closed Road waypoint rerouting retains all logical leg styles and the closure seam', async ({ page }, testInfo) => {
  const directions = await installDirectionsMock(page);
  const project = projectFixture('straight');
  const layer = routeLayer(project);
  if (layer.geometry?.type !== 'LineString') throw new Error('Expected Straight fixture');
  const waypoints = layer.geometry.coordinates;
  layer.route = { kind: 'road', closed: true };
  layer.provenance = { provider: 'mapbox', service: 'directions-v5', profile: 'walking', waypoints, distanceMeters: 10_000, durationSeconds: 1000 };
  await openRoute(page, project);
  const before: ProjectDocument = await downloadProject(page);
  await page.getByRole('button', { name: 'Drag route waypoint 4', exact: true }).press('ArrowUp');
  await expect.poll(() => directions.requests.length).toBe(1);
  await expect(page.getByText('Finding an updated road route…', { exact: true })).toHaveCount(0);
  const after: ProjectDocument = await downloadProject(page);
  const updated = routeLayer(after);
  expectAppearance(routeLayer(before), updated);
  expect(updated.geometry).not.toEqual(routeLayer(before).geometry);
  if (updated.provenance?.service !== 'directions-v5') throw new Error('Expected Road provenance');
  expect(updated.provenance.waypoints[0]).toEqual(updated.provenance.waypoints[3]);
  expect(updated.provenance.waypoints[0]).not.toEqual([16.35, 48.2]);
  await expectUndoRedo(page, before, after);
  expect(directions.requests).toHaveLength(1);
  const parity = await expectExportParity(page, testInfo, 'road-closing');
  await evidence(page, testInfo, 'road-closing', { before, after, parity });
});
