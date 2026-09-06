import { writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { downloadProject, mapSnapshot, openInstrumentedMap } from './map-recovery-support';

const tokyo = JSON.stringify({
  type: 'Feature', properties: { name: 'Tokyo review point' },
  geometry: { type: 'Point', coordinates: [139.75, 35.68] },
});
const routes = JSON.stringify({
  type: 'Feature', properties: { name: 'Zero-width reviewed route' },
  geometry: { type: 'LineString', coordinates: [[16.36, 48.2], [16.38, 48.22]] },
});
const input = (page: Page) => page.locator('input[accept^=".geojson"]');
const review = (page: Page) => page.getByRole('dialog', { name: 'Import map data', exact: true });
const payload = (name: string, text: string) => ({ name, mimeType: 'application/geo+json', buffer: Buffer.from(text) });

async function choose(page: Page, name = 'tokyo.geojson', text = tokyo) {
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Import map data', exact: true }).click();
  const chooser = await choosing;
  await chooser.setFiles(payload(name, text));
}

async function drop(page: Page, text = tokyo) {
  const transfer = await page.evaluateHandle((contents) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([contents], 'tokyo.geojson', { type: 'application/geo+json' }));
    return transfer;
  }, text);
  await page.locator('.canvas-region').dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
}

async function holdReads(page: Page) {
  await page.addInitScript(() => {
    const pending: Record<string, () => void> = {};
    Object.assign(window, { importReadControls: pending });
    File.prototype.text = new Proxy(File.prototype.text, {
      apply(target, file: File, arguments_) {
        const text = Reflect.apply(target, file, arguments_) as Promise<string>;
        if (!file.name.startsWith('hold-')) return text;
        return new Promise<string>((resolve, reject) => {
          pending[file.name] = () => { void text.then(resolve).catch(reject); };
        });
      },
    });
  });
}

async function releaseRead(page: Page, name: string) {
  await page.evaluate((filename) => {
    const controls = (window as unknown as { importReadControls: Record<string, () => void> }).importReadControls;
    controls[filename]();
  }, name);
}

for (const method of ['chooser', 'drop'] as const) {
  for (const shouldFit of [true, false]) {
    test(`UX030 ${method}: explicit ${shouldFit ? 'Fit' : 'Keep'} choice for the identical Tokyo file`, async ({ page }, testInfo) => {
      await openInstrumentedMap(page);
      const before = await mapSnapshot(page);
      const layerCount = await page.locator('.layer-row').count();
      if (method === 'chooser') await choose(page);
      else await drop(page);
      await expect(review(page)).toBeVisible();
      await expect(review(page).getByText('tokyo.geojson', { exact: true })).toBeVisible();
      await expect(review(page).getByRole('radio', { name: 'Fit imported content' })).toBeChecked();
      await expect(page.locator('.layer-row')).toHaveCount(layerCount);
      await expect(page.locator('button[aria-label="Undo"]')).toBeDisabled();
      if (!shouldFit) await review(page).getByRole('radio', { name: 'Keep current view' }).check();
      await page.screenshot({ path: testInfo.outputPath(`ux-fix-030-${method}-${shouldFit ? 'fit' : 'keep'}-review.png`), animations: 'disabled' });
      await review(page).getByRole('button', { name: 'Import 1 file', exact: true }).click();
      await expect(page.locator('.layer-row')).toHaveCount(layerCount + 1);
      await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeFocused();
      if (shouldFit) {
        await expect.poll(async () => { const snapshot = await mapSnapshot(page); return snapshot.center[0]; }).toBeCloseTo(139.75, 3);
        expect(await page.evaluate(() => window.recoveryAudit.map!.getBounds().contains([139.75, 35.68]))).toBe(true);
      } else {
        const after = await mapSnapshot(page);
        expect(after.center).toEqual(before.center);
        expect(after.zoom).toBe(before.zoom);
      }
      const after = await mapSnapshot(page);
      await page.screenshot({ path: testInfo.outputPath(`ux-fix-030-${method}-${shouldFit ? 'fit' : 'keep'}-committed.png`), animations: 'disabled' });
      await writeFile(testInfo.outputPath('ux-fix-030-camera.json'), JSON.stringify({ method, shouldFit, before, after, layerCount }, null, 2));
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await expect(page.locator('.layer-row')).toHaveCount(layerCount);
      await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    });
  }
}

test('UX030 cancelled IO cannot settle or steal focus from a newer read; the same filename can retry', async ({ page }, testInfo) => {
  await holdReads(page);
  await page.goto('./');
  await choose(page, 'hold-old.geojson');
  await expect(review(page).getByRole('status')).toHaveText('Checking files…');
  await expect(review(page).getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('ux-fix-030-checking.png'), animations: 'disabled' });
  await review(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(input(page)).toBeEnabled();
  await choose(page, 'hold-new.geojson');
  const close = review(page).getByRole('button', { name: 'Close map data import' });
  await close.focus();
  await releaseRead(page, 'hold-old.geojson');
  await expect(review(page).getByRole('status')).toHaveText('Checking files…');
  await expect(input(page)).toBeDisabled();
  await expect(close).toBeFocused();
  await releaseRead(page, 'hold-new.geojson');
  await expect(review(page).getByRole('button', { name: 'Import 1 file', exact: true })).toBeEnabled();
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await choose(page, 'tokyo.geojson');
  await review(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await choose(page, 'tokyo.geojson');
  await review(page).getByRole('button', { name: 'Import 1 file', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select Tokyo review point' })).toHaveCount(1);
});

test('UX030 a new document retires an active read and never resurrects its review', async ({ page }, testInfo) => {
  await holdReads(page);
  await page.goto('./');
  await choose(page, 'hold-old.geojson');
  const next = await page.evaluate(async () => {
    const path = '/src/domain/project.ts';
    const { createNewProjectDocument } = await import(path);
    return { ...createNewProjectDocument(), title: 'New document during import' };
  });
  await page.locator('input[accept^=".printmap"]').setInputFiles({
    name: 'new.printmap.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(next)),
  });
  await page.getByRole('button', { name: 'Replace project', exact: true }).click();
  await expect(review(page)).not.toBeVisible();
  await expect(page.getByRole('alert', { name: 'Map data import status' })).toContainText('Import cancelled because a different project was opened');
  await expect(input(page)).toBeEnabled();
  await releaseRead(page, 'hold-old.geojson');
  await expect(page.getByRole('button', { name: 'New document during import', exact: true })).toBeVisible();
  await expect(page.locator('.layer-row')).toHaveCount(1);
  await expect(review(page)).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('ux-fix-030-epoch-retirement.png'), animations: 'disabled' });
});

for (const width of [1440, 390]) {
  test(`UX031 blank style stays correctable and explicit zero imports atomically at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 740 : 900 });
    await page.goto('./');
    await choose(page, 'routes.geojson', routes);
    const field = review(page).getByRole('textbox', { name: 'Import route width', exact: true });
    const commit = review(page).getByRole('button', { name: 'Import 1 file', exact: true });
    await field.fill('');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription('Route width is required. Enter 0 px or greater.');
    const explanation = review(page).getByText('Route width is required. Enter 0 px or greater.', { exact: true });
    expect(await explanation.evaluate((element) => Number(getComputedStyle(element).fontSize.replace(/px$/, '')))).toBeGreaterThanOrEqual(12);
    await expect(commit).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath(`ux-fix-031-blank-${width}.png`), animations: 'disabled' });
    const box = await review(page).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(width === 390 ? 740 : 900);
    await field.fill(' '.repeat(3));
    await expect(commit).toBeDisabled();
    await field.fill('0');
    await expect(field).toHaveAttribute('aria-invalid', 'false');
    await expect(commit).toBeEnabled();
    await commit.click();
    const saved = await downloadProject(page);
    expect(saved.layers.find((layer: { name: string }) => layer.name === 'Zero-width reviewed route').appearance.width).toBe(0);
    await writeFile(testInfo.outputPath('ux-fix-031-zero-project.json'), JSON.stringify(saved, null, 2));
  });
}

test('UX030 review protects background tool/history/delete shortcuts and preserves cancel state', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Portrait', exact: true }).click();
  await page.getByRole('button', { name: 'Select Route 01', exact: true }).click();
  const before = await downloadProject(page);
  await choose(page);
  await review(page).getByRole('button', { name: 'Cancel', exact: true }).focus();
  for (const key of ['p', 's', 'r', 'v', 'ControlOrMeta+z', 'ControlOrMeta+y', 'Delete', 'Backspace']) {
    await page.keyboard.press(key);
  }
  await page.keyboard.press('Escape');
  expect(await downloadProject(page)).toEqual(before);
  await expect(page.getByRole('heading', { name: 'Route 01', exact: true })).toBeVisible();
});

test('UX030 a content edit during checking is visibly rejected without applying any data', async ({ page }, testInfo) => {
  await holdReads(page);
  await page.goto('./');
  const before = await downloadProject(page);
  await choose(page, 'hold-stale.geojson');
  await page.getByRole('button', { name: 'Portrait', exact: true, includeHidden: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  await releaseRead(page, 'hold-stale.geojson');
  await expect(review(page).getByRole('alert')).toHaveText('The project changed while checking these files. Nothing was imported. Choose the files again.');
  await expect(review(page).getByRole('button', { name: 'Import 1 file', exact: true })).toHaveCount(0);
  await expect(review(page).getByText('hold-stale.geojson', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('ux-fix-030-stale-read.png'), animations: 'disabled' });
  await review(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  const after = await downloadProject(page);
  expect(after.layers).toEqual(before.layers);
  expect(after.page.orientation).toBe('portrait');
});

test('UX031 POI size and shape outline share the same required-field and submit contract', async ({ page }, testInfo) => {
  await page.goto('./');
  await input(page).setInputFiles('tests/fixtures/import/supported.geojson');
  const commit = review(page).getByRole('button', { name: 'Import 1 file', exact: true });
  for (const [label, message, corrected] of [
    ['Import POI marker size', 'POI size is required. Enter 8–48 px.', '22'],
    ['Import shape outline width', 'Shape outline width is required. Enter 0.5–12 px.', '3'],
  ]) {
    const field = review(page).getByRole('textbox', { name: label, exact: true });
    await field.fill('');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(message);
    await expect(commit).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath(`ux-fix-031-${corrected}-blank.png`), animations: 'disabled' });
    await field.fill(corrected);
    await expect(commit).toBeEnabled();
  }
  await commit.click();
  const saved = await downloadProject(page);
  expect(saved.layers.find((layer: { name: string }) => layer.name === 'Café Central').appearance.size).toBe(22);
  expect(saved.layers.find((layer: { name: string }) => layer.name === 'Inner district').appearance.strokeWidth).toBe(3);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select Café Central', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
});
