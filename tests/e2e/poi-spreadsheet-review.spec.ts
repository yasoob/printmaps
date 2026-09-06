import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { admissionFixture, openAdmissionProject, savedAdmissionRecord } from './project-admission-support';
import { downloadPortable, portableFixture, stagePortable } from './portable-budget-support';
import { trackWrites } from './autosave-conflict-support';

type Suggestion = { label: string; coordinates: [number, number] };
const matched = (label = 'Herrengasse 14, Vienna, Austria'): Suggestion => ({ label, coordinates: [16.365, 48.2105] });
function payload(suggestions: Suggestion[]) {
  return { type: 'FeatureCollection', features: suggestions.map((suggestion, index) => ({
    id: `address.match-${index}`, geometry: { type: 'Point', coordinates: suggestion.coordinates },
    properties: { full_address: suggestion.label },
  })) };
}
async function openList(page: Page) {
  await page.getByRole('button', { name: 'Place (P)' }).click();
  await page.getByRole('button', { name: 'Paste POI list' }).click();
}
async function lookUp(page: Page, text: string) {
  await page.getByRole('radio', { name: 'Addresses' }).check();
  await page.getByRole('textbox', { name: 'POI spreadsheet rows' }).fill(text);
  await page.getByRole('button', { name: 'Look up addresses' }).click();
  await expect(page.getByRole('button', { name: 'Stop lookup' })).toHaveCount(0);
}
async function saveEvidence(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`ux-fix-${name}.png`), animations: 'disabled' });
}
async function controlledProvider(page: Page) {
  const queries: string[] = [];
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', async (route) => {
    const url = new URL(route.request().url());
    queries.push(url.searchParams.get('q')!);
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('autocomplete')).toBe('false');
    await route.fulfill({ json: payload([matched()]) });
  });
  return queries;
}

test('UX033 reviews actual ambiguous locality, corrects queries and excludes rows before one atomic addition', async ({ page }, info) => {
  const queries: string[] = [];
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q')!;
    queries.push(query);
    const suggestions = query === 'Springfield'
      ? [
        { label: 'Main Street, Springfield, Illinois, United States', coordinates: [-89.65, 39.78] as [number, number] },
        { label: 'Main Street, Springfield, Massachusetts, United States', coordinates: [-72.5898, 42.1015] as [number, number] },
      ]
      : (query === 'Correct Vienna' ? [matched('Correct address, Vienna, Austria')] : []);
    await route.fulfill({ json: payload(suggestions) });
  });
  await page.goto('./');
  await openList(page);
  await lookUp(page, 'Our café\tSpringfield\nOur museum\tUnknown\nDo not add\tMissing');
  await expect(page.getByText('First suggestion (not selected): Main Street, Springfield, Illinois, United States')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add selected POIs' })).toBeDisabled();
  await expect(page.locator('.layer-row')).toHaveCount(4);
  await saveEvidence(page, info, '033-actual-locality-before-commit');
  await page.getByText('Review or correct row 1', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Matched location for row 1' }).selectOption('1');
  await page.getByText('Review or correct row 2', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Address for row 2' }).fill('Correct Vienna');
  await page.getByRole('button', { name: 'Look up row 2 again' }).click();
  await expect(page.getByText('Matched location: Correct address, Vienna, Austria')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Include row 3: Do not add' }).uncheck();
  await page.getByRole('button', { name: 'Add selected POIs' }).click();
  await expect(page.locator('.layer-row')).toHaveCount(6);
  const downloaded = await downloadPortable(page, info, '033-reviewed-names-and-coordinates');
  expect(downloaded.document.layers.filter(({ name }) => ['Our café', 'Our museum'].includes(name))).toMatchObject([
    { name: 'Our café', geometry: { coordinates: [-72.5898, 42.1015] } },
    { name: 'Our museum', geometry: { coordinates: [16.365, 48.2105] } },
  ]);
  expect(downloaded.document.layers.some(({ name }) => name === 'Do not add')).toBe(false);
  expect(queries).toEqual(['Springfield', 'Unknown', 'Missing', 'Correct Vienna']);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.layer-row')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
});

test('UX035 preserves both raw buffers and corrected review through back navigation and mode switches without replay', async ({ page }, info) => {
  const queries = await controlledProvider(page);
  await page.goto('./');
  await openList(page);
  const input = page.getByRole('textbox', { name: 'POI spreadsheet rows' });
  const coordinates = '  Local point\t16.4\t48.2\n';
  const addresses = 'My name\tVienna\n';
  await input.fill(coordinates);
  await lookUp(page, addresses);
  await page.getByText('Review or correct row 1', { exact: true }).click();
  await page.getByRole('textbox', { name: 'POI name for row 1' }).fill('Desired name');
  await page.getByRole('textbox', { name: 'Address for row 1' }).fill('Corrected Vienna');
  await page.getByRole('button', { name: 'Look up row 1 again' }).click();
  await expect(page.getByRole('button', { name: 'Stop lookup' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to pasted rows' }).click();
  await expect(input).toHaveValue(addresses);
  await page.getByRole('radio', { name: 'Coordinates' }).check();
  await expect(input).toHaveValue(coordinates);
  await saveEvidence(page, info, '035-coordinate-buffer-restored');
  await page.getByRole('radio', { name: 'Addresses' }).check();
  await expect(input).toHaveValue(addresses);
  await page.getByRole('button', { name: 'Return to review' }).click();
  await page.getByText('Review or correct row 1', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'POI name for row 1' })).toHaveValue('Desired name');
  await expect(page.getByRole('textbox', { name: 'Address for row 1' })).toHaveValue('Corrected Vienna');
  await saveEvidence(page, info, '035-review-corrections-retained');
  expect(queries).toEqual(['Vienna', 'Corrected Vienna']);
  await page.getByRole('button', { name: 'Add selected POIs' }).click();
  await expect(input).toHaveValue(coordinates);
  await expect(page.getByRole('status', { name: 'Unfinished POI lists' })).toBeVisible();
  await page.getByRole('button', { name: 'Add POIs', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Place multiple points' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Select Desired name' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Local point' })).toBeVisible();
});

test('UX033 retains partial successes and provides explicit retry after a provider failure', async ({ page }, info) => {
  const attempts = new Map<string, number>();
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q')!;
    const count = (attempts.get(query) ?? 0) + 1;
    attempts.set(query, count);
    if (query === 'Failure' && count === 1) await route.fulfill({ status: 503, json: { message: 'Unavailable' } });
    else await route.fulfill({ json: payload(query === 'Missing' && count === 1 ? [] : [matched(`${query}, Vienna, Austria`)]) });
  });
  await page.goto('./');
  await openList(page);
  await lookUp(page, 'First\tFound\nSecond\tFailure\nThird\tMissing');
  await expect(page.getByText(/Lookup failed:/)).toBeVisible();
  await expect(page.getByText(/No matches found/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add selected POIs' })).toBeDisabled();
  await saveEvidence(page, info, '033-partial-failure-retained');
  await page.getByRole('button', { name: 'Retry unfinished addresses' }).click();
  await expect(page.getByRole('button', { name: 'Add selected POIs' })).toBeEnabled();
  expect(Object.fromEntries(attempts)).toEqual({ Found: 1, Failure: 2, Missing: 2 });
  await expect(page.locator('.layer-row')).toHaveCount(4);
  await page.getByRole('button', { name: 'Add selected POIs' }).click();
  await expect(page.locator('.layer-row')).toHaveCount(7);
});

test('UX035 stopping an old lookup retains work and only the latest request can publish results', async ({ page }, info) => {
  let release!: () => void;
  let calls = 0;
  let isOldSettled = false;
  const old = new Promise<void>((resolve) => { release = resolve; });
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', async (route) => {
    calls += 1;
    const isOld = calls === 1;
    if (isOld) await old;
    await route.fulfill({ json: payload([matched(isOld ? 'Obsolete suggestion' : 'Current suggestion, Vienna, Austria')]) });
    if (isOld) isOldSettled = true;
  });
  await page.goto('./');
  await openList(page);
  await page.getByRole('radio', { name: 'Addresses' }).check();
  await page.getByRole('textbox', { name: 'POI spreadsheet rows' }).fill('Desired name\tVienna');
  await page.getByRole('button', { name: 'Look up addresses' }).click();
  await expect.poll(() => calls).toBe(1);
  await expect(page.getByText('0 of 1 addresses checked. Nothing has been added.')).toBeVisible();
  await page.getByRole('button', { name: 'Close POI list' }).click();
  const dialog = page.getByRole('dialog', { name: 'Discard unadded POI lists?' });
  await expect(dialog.getByRole('button', { name: 'Keep editing lists' })).toBeFocused();
  await page.keyboard.press('r'); await page.keyboard.press('Delete'); await page.keyboard.press('ControlOrMeta+z');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep editing lists' }).click();
  await page.getByRole('button', { name: 'Retry unfinished addresses' }).click();
  await expect(page.getByText('Matched location: Current suggestion, Vienna, Austria')).toBeVisible();
  release();
  await expect.poll(() => isOldSettled).toBe(true);
  await expect(page.getByText('Obsolete suggestion', { exact: false })).toHaveCount(0);
  await saveEvidence(page, info, '035-latest-request-retained');
  await expect(page.locator('.layer-row')).toHaveCount(4);
  expect(calls).toBe(2);
});

test('UX035 a replaced document retires pending lookup without reviving old work or taking focus', async ({ page }, info) => {
  let release!: () => void;
  let isStarted = false, isSettled = false;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', async (route) => {
    isStarted = true;
    await blocked;
    await route.fulfill({ json: payload([matched('Old document suggestion')]) });
    isSettled = true;
  });
  await page.goto('./');
  await openList(page);
  await page.getByRole('radio', { name: 'Addresses' }).check();
  await page.getByRole('textbox', { name: 'POI spreadsheet rows' }).fill('Old work\tOld address');
  await page.getByRole('button', { name: 'Look up addresses' }).click();
  await expect.poll(() => isStarted).toBe(true);
  const replacement = { ...await admissionFixture(page), title: 'New document during lookup' };
  await stagePortable(page, replacement);
  await page.getByRole('button', { name: 'Discard unfinished work and open' }).click();
  await expect(page.getByRole('button', { name: replacement.title, exact: true })).toBeVisible();
  await openList(page);
  const input = page.getByRole('textbox', { name: 'POI spreadsheet rows' });
  await input.fill('New work\t16.4\t48.2');
  release();
  await expect.poll(() => isSettled).toBe(true);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('New work\t16.4\t48.2');
  await expect(page.getByText('Old document suggestion', { exact: false })).toHaveCount(0);
  await expect(page.locator('.layer-row')).toHaveCount(1);
  await saveEvidence(page, info, '035-new-epoch-late-response-ignored');
});

for (const budget of ['layers', 'positions', 'bytes'] as const) {
  test(`UX033 ${budget} admission rejects atomically and leaves chosen matches and buffers correctable`, async ({ page }, info) => {
    test.setTimeout(180_000);
    await controlledProvider(page);
    await page.goto('./');
    const document = budget === 'bytes' ? await portableFixture(page) : await admissionFixture(page, budget);
    await openAdmissionProject(page, document);
    const saved = await savedAdmissionRecord(page);
    await trackWrites(page);
    await openList(page);
    await lookUp(page, 'Retained name\tVienna');
    await page.getByRole('button', { name: 'Add selected POIs' }).click();
    const error = page.getByRole('region', { name: 'POI list messages' }).getByRole('alert');
    await expect(error).toContainText(budget === 'bytes' ? 'portable limit' : (budget === 'layers' ? 'layers' : 'positions'));
    await expect(error).toBeInViewport();
    await expect(page.getByText('Matched location: Herrengasse 14, Vienna, Austria')).toBeVisible();
    expect(await savedAdmissionRecord(page)).toEqual(saved);
    expect(await page.evaluate(() => window.conflictInstrumentation.puts)).toBe(0);
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    await saveEvidence(page, info, `033-${budget}-rejection-retained`);
    await page.getByRole('button', { name: 'Back to pasted rows' }).click();
    await expect(page.getByRole('textbox', { name: 'POI spreadsheet rows' })).toHaveValue('Retained name\tVienna');
  });
}

test('UX035 replacement and native unload protect lists while downloads and reloads contain only completed layers', async ({ page }, info) => {
  await controlledProvider(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Portrait', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  const original = await savedAdmissionRecord(page);
  await openList(page);
  await lookUp(page, 'Never persisted\tVienna');
  const download = await downloadPortable(page, info, '035-completed-only-backup');
  expect(download.document).toEqual(original.document);
  expect(await savedAdmissionRecord(page)).toEqual(original);
  const replacement = { ...await admissionFixture(page), title: 'New epoch without old lists' };
  await stagePortable(page, replacement);
  const dialog = page.getByRole('dialog', { name: 'Discard unfinished work?' });
  await expect(dialog).toContainText('POI lists');
  await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await saveEvidence(page, info, '035-replacement-warning');
  await dialog.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByText('Matched location: Herrengasse 14, Vienna, Austria')).toBeVisible();
  const prompting = page.waitForEvent('dialog');
  const reloading = page.evaluate(() => window.location.reload());
  const native = await prompting;
  expect(native.type()).toBe('beforeunload'); await native.dismiss(); await reloading;
  await expect(page.getByRole('region', { name: 'Address match review' })).toBeVisible();
  await stagePortable(page, replacement);
  await dialog.getByRole('button', { name: 'Discard unfinished work and open' }).click();
  await expect(page.getByRole('button', { name: replacement.title, exact: true })).toBeVisible();
  await openList(page);
  await expect(page.getByRole('textbox', { name: 'POI spreadsheet rows' })).toHaveValue('');
  await page.getByRole('radio', { name: 'Addresses' }).check();
  await expect(page.getByRole('textbox', { name: 'POI spreadsheet rows' })).toHaveValue('');
  await lookUp(page, 'Reload loses me\tVienna');
  const nextPrompt = page.waitForEvent('dialog'), nextReload = page.reload();
  const accepting = await nextPrompt;
  expect(accepting.type()).toBe('beforeunload'); await accepting.accept(); await nextReload;
  await openList(page);
  await expect(page.getByRole('textbox', { name: 'POI spreadsheet rows' })).toHaveValue('');
  await page.getByRole('radio', { name: 'Addresses' }).check();
  await expect(page.getByRole('textbox', { name: 'POI spreadsheet rows' })).toHaveValue('');
});

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`UX033 mobile ${viewport.width} review pages and fixed actions are keyboard reachable`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await controlledProvider(page);
    await page.goto('./');
    await openList(page);
    await lookUp(page, Array.from({ length: 25 }, (_, index) => `POI ${index + 1}\tAddress ${index + 1}`).join('\n'));
    const panel = page.getByRole('form', { name: 'Place multiple points' });
    const body = page.getByRole('region', { name: 'POI list workspace' });
    const rows = page.getByRole('list', { name: 'Reviewed address rows' }).getByRole('listitem');
    await expect(rows).toHaveCount(5);
    await body.focus(); await body.press('End');
    await expect.poll(() => body.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Next addresses' }).click();
    await expect(rows.first()).toContainText('6. POI 6');
    await expect(rows.first().locator('.poi-address-match')).toBeInViewport({ ratio: 1 });
    await expect(body).toBeFocused();
    await expect(page.getByRole('button', { name: 'Add selected POIs' })).toBeInViewport();
    const box = await panel.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.body.scrollWidth > innerWidth)).toBe(false);
    await saveEvidence(page, info, `033-mobile-${viewport.width}-review`);
    await page.getByRole('button', { name: 'Cancel list' }).click();
    const dialog = page.getByRole('dialog', { name: 'Discard unadded POI lists?' });
    await expect(dialog.getByRole('button', { name: 'Keep editing lists' })).toBeFocused();
    await saveEvidence(page, info, `035-mobile-${viewport.width}-discard-choice`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Cancel list' })).toBeFocused();
    await expect(panel).toBeVisible();
  });
}
