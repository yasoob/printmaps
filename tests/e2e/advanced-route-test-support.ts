import { readFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type {
  ContentLayer,
  ProjectDocument,
  RouteMarkerAppearance,
  RouteSegmentStyleOverride,
} from '../../src/domain/project';
import type { RouteTravelMarker } from '../../src/domain/routeProfiles';

type DirectionsMode = 'fail' | 'hold' | 'success';

export function routeLayer(project: ProjectDocument, id = 'route-01') {
  const layer = project.layers.find((candidate) => candidate.id === id);
  if (!layer || layer.type !== 'route') throw new Error(`Missing route ${id}.`);
  return layer;
}

export function basicRouteProject(): ProjectDocument {
  return {
    schemaVersion: 24,
    id: 'advanced-route-project',
    title: 'Advanced route project',
    page: {
      preset: 'A4',
      widthMm: 297,
      heightMm: 210,
      orientation: 'landscape',
    },
    camera: {
      bearing: 0,
      center: [16.3725, 48.2084],
      locked: false,
      pitch: 0,
      zoom: 11.2,
    },
    style: {
      preset: 'paper',
      language: 'local',
      textScalePercent: 100,
      visibility: {
        roads: true,
        buildings: true,
        labels: true,
        water: true,
        parks: true,
        landuse: true,
        transit: true,
      },
    },
    assets: {},
    layers: [
      {
        id: 'route-01',
        name: 'Route 01',
        type: 'route',
        visible: true,
        locked: false,
        opacity: 100,
        route: { kind: 'straight', closed: false },
        appearance: appearance(3, null),
        geometry: {
          type: 'LineString',
          coordinates: [
            [16.326, 48.194],
            [16.353, 48.205],
            [16.391, 48.215],
            [16.429, 48.226],
          ],
        },
      },
      {
        id: 'basemap',
        name: 'Paper basemap',
        type: 'basemap',
        visible: true,
        locked: true,
        opacity: 100,
      },
    ],
  };
}

function providerGeometry(requestUrl: string): [number, number][] {
  const encoded = new URL(requestUrl).pathname.split('/').at(-1);
  if (!encoded) throw new Error('Directions request has no coordinates.');
  const waypoints = decodeURIComponent(encoded).split(';').map((value) => (
    value.split(',').map(Number) as [number, number]
  ));
  return waypoints.flatMap((start, index) => {
    const end = waypoints[index + 1];
    if (!end) return index === 0 ? [start] : [];
    const midpoint: [number, number] = [
      (start[0] + end[0]) / 2 + 0.0004 * (index + 1),
      (start[1] + end[1]) / 2,
    ];
    return index === 0 ? [start, midpoint, end] : [midpoint, end];
  });
}

export async function installDirectionsMock(page: Page) {
  let mode: DirectionsMode = 'success';
  let releaseHold: (() => void) | null = null;
  const requests: string[] = [];
  await page.route('https://api.mapbox.com/directions/v5/mapbox/**', async (route) => {
    requests.push(route.request().url());
    if (mode === 'fail') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Deterministic directions failure.' }),
      });
      return;
    }
    if (mode === 'hold') {
      await new Promise<void>((resolve) => {
        releaseHold = resolve;
      });
    }
    const geometry = providerGeometry(route.request().url());
    try {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'Ok',
          routes: [{
            distance: 12_345,
            duration: 1234,
            geometry: { type: 'LineString', coordinates: geometry },
          }],
        }),
      });
    } catch {
      // Stale operations intentionally abort their browser request.
    }
  });
  return {
    requests,
    release: () => releaseHold?.(),
    setMode: (next: DirectionsMode) => {
      mode = next;
    },
  };
}

export async function waitForMap(page: Page) {
  const ready = page.locator('[data-map-ready="true"]');
  const fallback = page.getByText('Map preview unavailable');
  await expect(ready.or(fallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await fallback.isVisible(), 'The Chromium fixture has no WebGL 2 renderer.');
}

export async function openProject(page: Page, project: ProjectDocument) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project' }).click();
  await page.getByRole('menuitem', { name: 'Open project' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: `${project.id}.printmap.json`,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.getByRole('button', { name: 'Project' })).toBeFocused();
}

export async function downloadProject(
  page: Page,
  testInfo: TestInfo,
  label: string,
) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project' }).click();
  await page.getByRole('menuitem', { name: 'Download project' }).click();
  const download = await downloadPromise;
  const path = testInfo.outputPath(`${label}.printmap.json`);
  await download.saveAs(path);
  return {
    path,
    project: JSON.parse(await readFile(path, 'utf8')) as ProjectDocument,
  };
}

export async function downloadLayeredSvg(
  page: Page,
  testInfo: TestInfo,
  label: string,
) {
  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const download = await downloadPromise;
  const path = testInfo.outputPath(`${label}.svg`);
  await download.saveAs(path);
  const svg = await readFile(path, 'utf8');
  await dialog.getByRole('button', { name: 'Close export' }).click();
  return svg;
}

export async function downloadPdf(page: Page, testInfo: TestInfo, label: string) {
  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('radio', { name: /PDF/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  const path = testInfo.outputPath(`${label}.pdf`);
  await download.saveAs(path);
  const pdf = await readFile(path);
  await dialog.getByRole('button', { name: 'Close export' }).click();
  return pdf.toString('latin1');
}

export async function openAdvanced(page: Page) {
  const advanced = page.getByRole('button', { name: /Advanced/ });
  if (await advanced.getAttribute('aria-expanded') !== 'true') await advanced.click();
}

export async function convertRoute(
  page: Page,
  target: 'straight' | 'arc' | 'road',
  profile: 'car' | 'walk' | 'bike' = 'car',
) {
  await page.getByRole('combobox', { name: 'Convert route to' }).selectOption(target);
  if (target === 'road') {
    await page.getByRole('combobox', { name: 'Road conversion travel mode' })
      .selectOption(profile);
  }
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  if (target === 'road') {
    const confirmation = page.getByRole('group', { name: 'Confirm road routing' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Route and apply' }).click();
    await expect(page.getByText('Mapbox Directions')).toBeVisible();
  }
}

function marker(
  pictogram: RouteTravelMarker,
  placement: RouteMarkerAppearance['placement'],
): RouteMarkerAppearance {
  return { pictogram, placement, orientToPath: true, reverseFacing: false };
}

function appearance(
  legs: number,
  routeMarker: RouteMarkerAppearance | null,
  segmentStyles: (RouteSegmentStyleOverride | null)[] = Array.from(
    { length: legs },
    () => null,
  ),
) {
  return {
    kind: 'route' as const,
    color: '#d9363e',
    width: 4,
    strokeStyle: 'solid' as const,
    marker: routeMarker,
    segmentStyles,
  };
}

export function markerParityProject(): ProjectDocument {
  const project = basicRouteProject();
  project.id = 'route-marker-parity';
  project.title = 'Route marker parity';
  const common = {
    type: 'route' as const,
    visible: true,
    locked: false,
    opacity: 100,
  };
  const routes: ContentLayer[] = [
    {
      ...common,
      id: 'air-straight',
      name: 'Air Straight',
      route: { kind: 'straight', closed: false },
      appearance: appearance(1, marker('air', { type: 'center' })),
      geometry: { type: 'LineString', coordinates: [[16.32, 48.19], [16.42, 48.19]] },
    },
    {
      ...common,
      id: 'train-arc',
      name: 'Train Arc',
      route: { kind: 'arc', closed: false },
      appearance: appearance(1, marker('rail', { type: 'fraction', fraction: 0.25 })),
      geometry: {
        type: 'Arc',
        anchors: [[16.32, 48.2], [16.42, 48.2]],
        curvatures: [0.55],
      },
    },
    {
      ...common,
      id: 'car-road',
      name: 'Car Road',
      route: { kind: 'road', closed: false },
      appearance: appearance(1, marker('car', { type: 'repeat', spacing: 0.25 })),
      geometry: {
        type: 'LineString',
        coordinates: [[16.32, 48.21], [16.36, 48.225], [16.42, 48.21]],
      },
      provenance: {
        provider: 'mapbox',
        service: 'directions-v5',
        waypoints: [[16.32, 48.21], [16.42, 48.21]],
        profile: 'driving',
        distanceMeters: 10_000,
        durationSeconds: 1000,
      },
    },
    {
      ...common,
      id: 'walk-straight',
      name: 'Walking Straight',
      route: { kind: 'straight', closed: false },
      appearance: appearance(1, marker('walk', { type: 'fraction', fraction: 0.75 })),
      geometry: { type: 'LineString', coordinates: [[16.32, 48.22], [16.42, 48.22]] },
    },
    {
      ...common,
      id: 'bike-arc',
      name: 'Cycling Arc',
      route: { kind: 'arc', closed: false },
      appearance: appearance(1, marker('bike', { type: 'center' })),
      geometry: {
        type: 'Arc',
        anchors: [[16.32, 48.23], [16.42, 48.23]],
        curvatures: [-0.45],
      },
    },
    {
      ...common,
      id: 'ship-road',
      name: 'Ship Road',
      route: { kind: 'road', closed: false },
      appearance: appearance(2, marker('ship', { type: 'center' }), [
        { color: '#112233', width: 8, strokeStyle: 'dashed' },
        null,
      ]),
      geometry: {
        type: 'LineString',
        coordinates: [
          [16.32, 48.24], [16.35, 48.25], [16.37, 48.24],
          [16.39, 48.23], [16.42, 48.24],
        ],
      },
      provenance: {
        provider: 'mapbox',
        service: 'directions-v5',
        waypoints: [[16.32, 48.24], [16.37, 48.24], [16.42, 48.24]],
        profile: 'walking',
        distanceMeters: 9000,
        durationSeconds: 1800,
      },
    },
    {
      ...common,
      id: 'none-straight',
      name: 'None Straight',
      route: { kind: 'straight', closed: false },
      appearance: appearance(1, null),
      geometry: { type: 'LineString', coordinates: [[16.32, 48.25], [16.42, 48.25]] },
    },
  ];
  project.layers = [
    ...routes,
    project.layers.find(({ id }) => id === 'basemap')!,
  ];
  return project;
}

export type SvgRouteMetrics = {
  markers: { x: number; y: number }[];
  repeats: { x: number; y: number }[];
  points: {
    quarter: { x: number; y: number };
    center: { x: number; y: number };
    threeQuarter: { x: number; y: number };
  };
  strokes: { color: string | null; dash: string | null; width: string | null }[];
};

export async function svgMetrics(
  page: Page,
  svg: string,
  routeId: string,
): Promise<SvgRouteMetrics> {
  return page.evaluate(({ routeId: id, text }) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0';
    host.innerHTML = text;
    document.body.append(host);
    const group = [...host.querySelectorAll<SVGGElement>('[data-layer-id]')]
      .find((candidate) => candidate.dataset.layerId === id);
    if (!group) throw new Error(`Missing SVG group ${id}.`);
    const paths = [...group.querySelectorAll<SVGPathElement>(':scope > path[data-route-leg]')];
    const total = paths.reduce((sum, path) => sum + path.getTotalLength(), 0);
    const pointAt = (fraction: number) => {
      let remaining = total * fraction;
      for (const path of paths) {
        const length = path.getTotalLength();
        if (remaining <= length) {
          const point = path.getPointAtLength(remaining);
          return { x: point.x, y: point.y };
        }
        remaining -= length;
      }
      const last = paths.at(-1)!;
      const point = last.getPointAtLength(last.getTotalLength());
      return { x: point.x, y: point.y };
    };
    const markers = [...group.querySelectorAll<SVGGElement>('[data-route-pictogram]')]
      .map((element) => {
        const match = element.getAttribute('transform')
          ?.match(/^translate\(([-\d.]+) ([-\d.]+)\)/);
        if (!match) throw new Error('Route marker has no translation.');
        return { x: Number(match[1]), y: Number(match[2]) };
      });
    const result = {
      markers,
      repeats: [0.125, 0.375, 0.625, 0.875].map((fraction) => pointAt(fraction)),
      points: {
        quarter: pointAt(0.25),
        center: pointAt(0.5),
        threeQuarter: pointAt(0.75),
      },
      strokes: paths.map((path) => ({
        color: path.getAttribute('stroke'),
        dash: path.getAttribute('stroke-dasharray'),
        width: path.getAttribute('stroke-width'),
      })),
    };
    host.remove();
    return result;
  }, { routeId, text: svg });
}

export function expectNear(
  actual: { x: number; y: number },
  expected: { x: number; y: number },
) {
  expect(Math.hypot(actual.x - expected.x, actual.y - expected.y)).toBeLessThan(0.05);
}
