import { readFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { downloadPortable, openPortable } from './portable-budget-support';

const localFile = (name = 'Local profile') => ({
  name: 'local-profile.geojson', mimeType: 'application/geo+json',
  buffer: Buffer.from(JSON.stringify({ type: 'Feature', properties: { name }, geometry: { type: 'LineString', coordinates: [[17, 49], [17.1, 49.1]] } })),
});
async function openProfile(page: Page, name = 'Route 01') {
  await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
  const advanced = page.getByRole('button', { name: 'Advanced', exact: true });
  if (await advanced.getAttribute('aria-expanded') !== 'true') await advanced.click();
}
async function generate(page: Page) {
  await page.getByRole('button', { name: 'Generate elevation profile', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Elevation summary' })).toBeVisible();
}
async function evidence(page: Page, info: TestInfo, name: string) {
  const error = page.locator('.elevation-profile-panel [role="alert"]').first();
  const chart = page.locator('.elevation-chart');
  if (await error.count()) await error.scrollIntoViewIfNeeded();
  else if (await chart.count()) await chart.scrollIntoViewIfNeeded();
  else await page.locator('.elevation-profile-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath(`ux-fix-039-${name}.png`), animations: 'disabled' });
}
async function terrain(page: Page) {
  const requests: URL[] = [];
  await page.route('https://api.open-meteo.com/v1/elevation**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const count = url.searchParams.get('latitude')!.split(',').length;
    await route.fulfill({ json: { elevation: Array.from({ length: count }, (_, index) => 150 + index) } });
  });
  return requests;
}
async function originalSettings(page: Page) {
  await page.getByRole('radio', { name: 'Imperial' }).check();
  await page.getByLabel('Profile print width', { exact: true }).fill('220');
  await page.getByLabel('Profile font', { exact: true }).selectOption('serif');
  await page.getByLabel('Profile font size', { exact: true }).fill('60');
}
async function expectOriginalSettings(page: Page) {
  await expect(page.getByRole('radio', { name: 'Imperial' })).toBeChecked();
  await expect(page.getByLabel('Profile print width', { exact: true })).toHaveValue('220');
  await expect(page.getByLabel('Profile font', { exact: true })).toHaveValue('serif');
  await expect(page.getByLabel('Profile font size', { exact: true })).toHaveValue('60');
}

test('UX039 preserves the profile and four original settings across disclosure and selection without refetch or project writes', async ({ page }, info) => {
  const requests = await terrain(page);
  await page.goto('./');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  const before = await downloadPortable(page, info, '039-before-profile');
  await openProfile(page);
  await generate(page);
  await originalSettings(page);
  const summary = (await page.getByRole('group', { name: 'Elevation summary' }).textContent())!;
  await evidence(page, info, 'original-settings-before-collapse');
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  await expect(page.locator('.elevation-profile-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  await expectOriginalSettings(page);
  await page.getByRole('button', { name: 'Select Coffee stop' }).click();
  await openProfile(page);
  await expectOriginalSettings(page);
  await expect(page.getByRole('group', { name: 'Elevation summary' })).toHaveText(summary);
  expect(requests).toHaveLength(1);
  await evidence(page, info, 'original-settings-after-navigation');
  const after = await downloadPortable(page, info, '039-after-profile');
  expect(after.document).toEqual(before.document);
  await page.reload();
  await openProfile(page);
  await expect(page.getByRole('button', { name: 'Generate elevation profile' })).toBeVisible();
  expect(requests).toHaveLength(1);
});

test('UX039 cosmetic edits preserve heights; geometry, Undo and route-kind changes require explicit generation', async ({ page }, info) => {
  const requests = await terrain(page);
  await page.goto('./'); await openProfile(page); await generate(page);
  await originalSettings(page);
  const summary = (await page.getByRole('group', { name: 'Elevation summary' }).textContent())!;
  await page.getByRole('textbox', { name: 'Layer name', exact: true }).fill('Renamed route');
  await page.getByRole('textbox', { name: 'Layer name', exact: true }).press('Tab');
  await page.getByLabel('Route color', { exact: true }).fill('#123456');
  await expect(page.getByRole('img', { name: 'Renamed route elevation profile' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Elevation summary' })).toHaveText(summary);
  await expect(page.getByLabel('Profile curve color')).toHaveValue('#123456');
  expect(requests).toHaveLength(1);
  const longitude = page.getByRole('textbox', { name: 'Route anchor longitude' });
  await longitude.fill('16.25'); await longitude.press('Tab');
  await expect(page.locator('.elevation-chart')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.elevation-chart')).toHaveCount(0);
  expect(requests).toHaveLength(1);
  await generate(page);
  await expectOriginalSettings(page);
  await page.getByRole('combobox', { name: 'Convert route to' }).selectOption('arc');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.elevation-profile-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Generate elevation profile' })).toBeVisible();
  expect(requests).toHaveLength(2);
  await evidence(page, info, 'geometry-kind-invalidated');
});

test('UX039 local files override map geometry, survive navigation, and commit only after valid parsing', async ({ page }, info) => {
  const requests = await terrain(page);
  await page.goto('./'); await openProfile(page);
  await page.getByLabel('Profile route file').setInputFiles(localFile());
  await expect(page.getByRole('group', { name: 'Profile route source' })).toContainText('Local profile');
  await generate(page); await originalSettings(page);
  await page.getByLabel('Profile route file').setInputFiles({ name: 'invalid.geojson', mimeType: 'application/geo+json', buffer: Buffer.from('bad json') });
  await expect(page.getByRole('group', { name: 'Profile route source' }).getByRole('alert')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Local profile elevation profile' })).toBeVisible();
  await expectOriginalSettings(page);
  await page.getByRole('button', { name: 'Select Coffee stop' }).click();
  await openProfile(page);
  await expect(page.getByRole('img', { name: 'Local profile elevation profile' })).toBeVisible();
  const longitude = page.getByRole('textbox', { name: 'Route anchor longitude' });
  await longitude.fill('16.25'); await longitude.press('Tab');
  await expect(page.getByRole('img', { name: 'Local profile elevation profile' })).toBeVisible();
  expect(requests).toHaveLength(1);
  await evidence(page, info, 'local-source-and-failure-retained');
  await page.getByRole('button', { name: 'Use selected map route' }).click();
  await expect(page.locator('.elevation-chart')).toHaveCount(0);
  await generate(page);
  expect(requests).toHaveLength(2);
  expect(Number(requests[1].searchParams.get('longitude')!.split(',', 1)[0])).toBe(16.25);
  await expectOriginalSettings(page);
});

declare global {
  interface Window {
    releaseElevationFile: () => void;
    elevationPngGate: { isWaiting: boolean; release: () => void };
  }
}

test('UX039 pending file reads survive disclosure and cancel without clearing old data or stealing later focus', async ({ page }, info) => {
  const requests = await terrain(page);
  await page.goto('./'); await openProfile(page); await generate(page);
  await page.evaluate((contents) => {
    const original = File.prototype.text;
    const pending = new Promise<string>((resolve) => { Object.assign(window, { releaseElevationFile: () => resolve(contents) }); });
    File.prototype.text = new Proxy(original, { apply: (target, receiver: File, args) => receiver.name === 'pending.geojson' ? pending : Reflect.apply(target, receiver, args) });
  }, localFile('Late profile').buffer.toString());
  await page.getByLabel('Profile route file').setInputFiles({ ...localFile(), name: 'pending.geojson' });
  await expect(page.getByText(/Reading profile route file/)).toBeVisible();
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel file read' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel file read' }).click();
  await page.getByLabel('Profile print width', { exact: true }).fill('220');
  await page.evaluate(() => window.releaseElevationFile());
  await expect(page.getByLabel('Profile print width', { exact: true })).toBeFocused();
  await expect(page.getByRole('img', { name: 'Route 01 elevation profile' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Profile route source' })).toContainText('Selected map route');
  expect(requests).toHaveLength(1);
  await evidence(page, info, 'file-cancel-retains-last-good');
  await page.getByLabel('Profile route file').setInputFiles(localFile());
  await expect(page.getByRole('group', { name: 'Profile route source' })).toContainText('Local profile');
});

test('UX039 hidden explicit terrain can finish; a failed refresh retains chart and invalid numeric drafts', async ({ page }, info) => {
  let release!: () => void;
  let requests = 0;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  await page.route('https://api.open-meteo.com/v1/elevation**', async (route) => {
    requests += 1;
    if (requests === 2) { await route.fulfill({ status: 503, json: { reason: 'Controlled terrain failure' } }); return; }
    const count = new URL(route.request().url()).searchParams.get('latitude')!.split(',').length;
    await waiting;
    await route.fulfill({ json: { elevation: Array.from({ length: count }, () => 200) } });
  });
  await page.goto('./'); await openProfile(page);
  await page.getByRole('button', { name: 'Generate elevation profile' }).click();
  await expect.poll(() => requests).toBe(1);
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  release();
  await page.getByRole('button', { name: 'Select Coffee stop' }).click();
  await openProfile(page);
  await expect(page.getByRole('group', { name: 'Elevation summary' })).toBeVisible();
  await originalSettings(page);
  await page.getByLabel('Profile font size', { exact: true }).fill('71');
  await page.getByRole('button', { name: 'Refresh elevation profile' }).click();
  await expect(page.locator('.elevation-profile-panel > [role="alert"]')).toBeVisible();
  await expect(page.locator('.elevation-chart')).toBeVisible();
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  await expect(page.getByLabel('Profile font size', { exact: true })).toHaveValue('71');
  await expect(page.getByRole('button', { name: 'Download elevation SVG' })).toBeDisabled();
  await evidence(page, info, 'refresh-error-and-invalid-draft-retained');
  await page.getByRole('button', { name: 'Generate elevation profile' }).click();
  await expect(page.getByRole('button', { name: 'Refresh elevation profile' })).toBeVisible();
  await expect(page.getByLabel('Profile font size', { exact: true })).toHaveValue('71');
  expect(requests).toBe(3);
});

test('UX039 project replacement retires pending terrain and cannot revive old profiles', async ({ page }, info) => {
  let release!: () => void;
  let requests = 0, hasSettled = false;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  await page.route('https://api.open-meteo.com/v1/elevation**', async (route) => {
    requests += 1;
    const count = new URL(route.request().url()).searchParams.get('latitude')!.split(',').length;
    await waiting;
    await route.fulfill({ json: { elevation: Array.from({ length: count }, () => 300) } });
    hasSettled = true;
  });
  await page.goto('./'); await openProfile(page);
  await page.getByRole('button', { name: 'Generate elevation profile' }).click();
  await expect.poll(() => requests).toBe(1);
  const replacement = await page.evaluate(async () => {
    const path = '/src/domain/project.ts';
    const { createInitialProjectDocument } = await import(path);
    return { ...createInitialProjectDocument(), title: 'Replacement elevation session' };
  });
  await openPortable(page, replacement);
  await openProfile(page);
  release(); await expect.poll(() => hasSettled).toBe(true);
  await expect(page.getByRole('button', { name: 'Generate elevation profile' })).toBeVisible();
  await expect(page.locator('.elevation-chart')).toHaveCount(0);
  expect(requests).toBe(1);
  await evidence(page, info, 'new-epoch-ignores-old-terrain');
});

test('UX039 separate routes keep independent profiles and settings', async ({ page }, info) => {
  const requests = await terrain(page);
  await page.goto('./'); await openProfile(page); await generate(page); await originalSettings(page);
  await page.getByRole('button', { name: 'Layer menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Duplicate layer', exact: true }).click();
  const copyName = await page.getByRole('textbox', { name: 'Layer name', exact: true }).inputValue();
  await expect(page.getByRole('button', { name: 'Generate elevation profile' })).toBeVisible();
  await generate(page);
  await expect(page.getByRole('radio', { name: 'Metric' })).toBeChecked();
  await expect(page.getByLabel('Profile print width', { exact: true })).toHaveValue('150');
  await page.getByLabel('Profile font', { exact: true }).selectOption('mono');
  await openProfile(page);
  await expectOriginalSettings(page);
  await openProfile(page, copyName);
  await expect(page.getByLabel('Profile font', { exact: true })).toHaveValue('mono');
  expect(requests).toHaveLength(2);
  await evidence(page, info, 'independent-route-profile');
});

test('UX039 deleting and undoing a route cannot resume its retired request', async ({ page }, info) => {
  let release!: () => void;
  let requests = 0, hasSettled = false;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  await page.route('https://api.open-meteo.com/v1/elevation**', async (route) => {
    requests += 1;
    const count = new URL(route.request().url()).searchParams.get('latitude')!.split(',').length;
    await waiting;
    await route.fulfill({ json: { elevation: Array.from({ length: count }, () => 300) } });
    hasSettled = true;
  });
  await page.goto('./'); await openProfile(page);
  await page.getByRole('button', { name: 'Generate elevation profile' }).click();
  await expect.poll(() => requests).toBe(1);
  await page.getByRole('button', { name: 'Layer menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete layer', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await openProfile(page);
  release(); await expect.poll(() => hasSettled).toBe(true);
  await expect(page.getByRole('button', { name: 'Generate elevation profile' })).toBeVisible();
  await expect(page.locator('.elevation-chart')).toHaveCount(0);
  expect(requests).toBe(1);
  await evidence(page, info, 'deleted-owner-retired');
});

  test('UX039 stale native PNG completion cannot download or report errors into a newer source', async ({ page }, info) => {
    await terrain(page);
    const downloads: string[] = [], errors: string[] = [];
    page.on('download', (download) => { downloads.push(download.suggestedFilename()); });
    page.on('pageerror', (error) => { errors.push(error.message); });
    await page.goto('./'); await openProfile(page); await generate(page);
    await page.evaluate(() => {
      const original = HTMLCanvasElement.prototype.toBlob;
      const gate = { isWaiting: false, release: () => {} };
      Object.assign(window, { elevationPngGate: gate });
      HTMLCanvasElement.prototype.toBlob = new Proxy(original, {
        apply(target, canvas: HTMLCanvasElement, args: [BlobCallback, string?]) {
          if (!gate.isWaiting && canvas.width === 1800 && canvas.height === 900 && args[1] === 'image/png') {
            gate.isWaiting = true;
            gate.release = () => args[0](null);
            return;
          }
          Reflect.apply(target, canvas, args);
        },
      });
    });
    await page.getByRole('button', { name: 'Download elevation PNG' }).click();
    await expect.poll(() => page.evaluate(() => window.elevationPngGate.isWaiting)).toBe(true);
    await page.getByLabel('Profile route file').setInputFiles(localFile());
    await expect(page.getByRole('group', { name: 'Profile route source' })).toContainText('Local profile');
    await generate(page);
    const waiting = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download elevation PNG' }).click();
    const download = await waiting;
    await download.saveAs(info.outputPath('ux-fix-039-current-source.png'));
    await page.evaluate(() => window.elevationPngGate.release());
    await expect(page.getByRole('button', { name: 'Download elevation PNG' })).toBeEnabled();
    await expect(page.locator('.elevation-profile-ready [role="alert"]')).toHaveCount(0);
    expect(downloads).toEqual(['Local-profile.elevation.png']);
    expect(errors).toEqual([]);
    await evidence(page, info, 'stale-png-ignored');
  });

  test('UX039 deferred PDF jobs keep their source snapshot and only the current job downloads', async ({ page }, info) => {
    await terrain(page);
    let release!: () => void, hasStarted = false;
    const waitingModule = new Promise<void>((resolve) => { release = resolve; });
    const downloads: string[] = [];
    page.on('download', (download) => { downloads.push(download.suggestedFilename()); });
    await page.route('**/src/export/elevationProfilePdf.ts*', async (route) => {
      hasStarted = true; await waitingModule; await route.continue();
    });
    await page.goto('./'); await openProfile(page); await generate(page);
    await page.getByRole('button', { name: 'Download elevation PDF' }).click();
    await expect.poll(() => hasStarted).toBe(true);
    await page.getByLabel('Profile route file').setInputFiles(localFile());
    await expect(page.getByRole('group', { name: 'Profile route source' })).toContainText('Local profile');
    await generate(page);
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download elevation PDF' }).click();
    release();
    const download = await downloading;
    await download.saveAs(info.outputPath('ux-fix-039-current-source.pdf'));
    await expect(page.getByRole('button', { name: 'Download elevation PDF' })).toBeEnabled();
    expect(downloads).toEqual(['Local-profile.elevation.pdf']);
    await expect(page.getByRole('img', { name: 'Local profile elevation profile' })).toBeVisible();
  });

test('UX040 consumer: a 201-point local route keeps its 59.3 km distance with only 100 terrain samples', async ({ page }, info) => {
  let calls = 0, samples = 0;
  await page.route('https://api.open-meteo.com/v1/elevation**', async (route) => {
    calls += 1;
    samples = new URL(route.request().url()).searchParams.get('latitude')!.split(',').length;
    await route.fulfill({ json: { elevation: Array.from({ length: samples }, () => 100) } });
  });
  await page.goto('./'); await openProfile(page);
  const coordinates = Array.from({ length: 201 }, (_, index) => [16.37 + index % 2 * 0.004, 48.2 + index * 0.00005]);
  await page.getByLabel('Profile route file').setInputFiles({
    name: 'original-distance.geojson', mimeType: 'application/geo+json',
    buffer: Buffer.from(JSON.stringify({ type: 'Feature', properties: { name: 'Original route distance' }, geometry: { type: 'LineString', coordinates } })),
  });
  await expect(page.getByRole('group', { name: 'Profile route source' })).toContainText('Original route distance');
  expect(calls).toBe(0);
  await generate(page);
  expect(samples).toBe(100);
  expect(calls).toBe(1);
  const summary = page.getByRole('group', { name: 'Elevation summary' });
  await expect(summary).toContainText('59.3 km');
  const travel = page.getByRole('group', { name: 'Travel time estimates' });
  await expect(travel).toContainText('Walking · 5 km/h11 h 52 min');
  await expect(travel).toContainText('Cycling · 15 km/h3 h 57 min');
  await travel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('ux-fix-040-consumer-profile.png'), animations: 'disabled' });
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download elevation SVG' }).click();
  const download = await waiting;
  const output = info.outputPath('ux-fix-040-consumer-distance.svg');
  await download.saveAs(output);
  const svg = await readFile(output, 'utf8');
  expect(svg).toMatch(/>59\.3 km<\/text>/);
  expect(svg).toContain('59.3 km · ↑');
  await info.attach('ux-fix-040-consumer-measurements', { body: JSON.stringify({
    sourcePositions: coordinates.length, terrainSamples: samples, calls,
    visibleSummary: await summary.textContent(), visibleTravel: await travel.textContent(),
    svgFinalAxisLabel: '59.3 km',
  }), contentType: 'application/json' });
});
