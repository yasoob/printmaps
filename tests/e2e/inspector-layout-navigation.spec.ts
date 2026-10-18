import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function projectDocument(page: Page) {
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Download project', exact: true }).click();
  const download = await downloading;
  const path = await download.path();
  if (!path) throw new Error('Project download was not created.');
  return JSON.parse(await readFile(path, 'utf8'));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('./');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 30_000 });
});

for (const width of [1440, 390, 320]) {
  test(`coherent inspector sections and template views at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    if (width < 760) await page.getByRole('button', { name: 'Open properties' }).click();
    const inspector = page.getByRole('complementary', { name: 'Properties sidebar' }).or(page.getByRole('dialog', { name: 'Properties sidebar' }));
    for (const [tab, sections] of [
      ['Map', ['Style', 'Labels & details', 'Terrain', 'View']],
      ['Layout', ['Page', 'Map frame', 'Text', 'Photos', 'Map elements']],
    ] as const) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      const expandedSections = await inspector.locator('.inspector-accordion > h3 > button[aria-expanded="true"]:visible').all();
      for (const expanded of expandedSections) await expanded.click();
      await page.screenshot({ path: testInfo.outputPath(`${tab.toLowerCase()}-overview.png`), animations: 'disabled' });
      for (const name of sections) {
        const toggle = inspector.getByRole('button', { name, exact: true });
        await toggle.click();
        await toggle.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`${name.toLowerCase().replaceAll(/[^a-z]+/g, '-')}.png`), animations: 'disabled' });
        const suffixesFit = await inspector.locator('.input-group-addon:visible').evaluateAll((elements) => elements.every((element) => {
          const group = element.parentElement!.getBoundingClientRect();
          const suffix = element.getBoundingClientRect();
          return suffix.left >= group.left && suffix.right <= group.right;
        }));
        expect(suffixesFit).toBe(true);
        const fieldGeometry = await inspector.locator('.property-control > [data-slot="select-trigger"]:visible, .property-control > [data-slot="input"]:visible, .input-group:visible, .color-field:visible, .studio-color-field:visible').evaluateAll((elements) =>
          elements.map((element) => Math.round(element.getBoundingClientRect().height)));
        expect(fieldGeometry.every((height) => height === (width < 900 ? 44 : 32))).toBe(true);
        const labelGutters = await inspector.locator('.property-row:visible').evaluateAll((elements) => elements.map((element) => {
          const label = element.querySelector('span')!.getBoundingClientRect();
          const control = element.querySelector('.property-control')!.getBoundingClientRect();
          return control.left - label.right;
        }));
        expect(labelGutters.every((gap) => gap >= 8)).toBe(true);
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(await inspector.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        await toggle.click();
      }
    }
    await page.getByRole('button', { name: 'Change layout', exact: true }).click();
    await expect(page.getByRole('button', { name: /Lisbon/ })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('change-layout.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Back to Layout' }).click();
    if (width < 760) await page.getByRole('button', { name: 'Close properties', exact: true }).click();
    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await page.getByRole('menuitem', { name: 'New from template' }).click();
    const gallery = page.getByRole('dialog', { name: 'New from template' });
    await expect(gallery).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('new-template.png'), animations: 'disabled' });
    await gallery.getByRole('button', { name: /Lisbon/ }).click();
    const replacement = page.getByRole('dialog', { name: 'Start a new project?' });
    await expect(replacement).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('new-template-replacement.png'), animations: 'disabled' });
    await replacement.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('navigation is ephemeral, keeps field nodes, and returns from every contextual layer without remounting the map', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const before = await projectDocument(page);
  const map = await page.locator('canvas.maplibregl-canvas').elementHandle();
  await page.getByRole('tab', { name: 'Map', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Layout' })).toBeFocused();
  const field = await page.getByRole('spinbutton', { name: 'Top margin' }).elementHandle();
  for (const name of ['Route 01', 'Coffee stop', 'City center']) {
    await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Project settings', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Project', exact: true })).toBeFocused();
  }
  await page.screenshot({ path: testInfo.outputPath('contextual-return.png') });
  expect(await field?.evaluate((node) => node === document.querySelector('[aria-label="Top margin"]'))).toBe(true);
  expect(await map?.evaluate((node) => node === document.querySelector('canvas.maplibregl-canvas'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  expect(await projectDocument(page)).toEqual(before);
});

test('layout design preserves content and location; a starter replaces only after explicit confirmation', async ({ page }) => {
  const before = await projectDocument(page);
  await page.getByRole('tab', { name: 'Layout' }).click();
  await page.getByRole('button', { name: 'Change layout', exact: true }).click();
  await page.getByRole('button', { name: /^City edition/ }).click();
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await page.getByLabel('Title text', { exact: true }).fill('A personal title');
  await page.getByRole('button', { name: 'Change layout', exact: true }).click();
  await page.getByRole('button', { name: /^Quiet lines/ }).click();
  const applied = await projectDocument(page);
  expect(applied.layers).toEqual(before.layers);
  expect(applied.camera).toEqual(before.camera);
  expect(applied.studio.poster.title.text).toBe('A personal title');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New from template' }).click();
  await page.getByRole('button', { name: /Lisbon/ }).click();
  const backup = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download current project' }).click();
  const backupDownload = await backup;
  const backupPath = await backupDownload.path();
  if (!backupPath) throw new Error('Backup was not downloaded.');
  expect(JSON.parse(await readFile(backupPath, 'utf8'))).toEqual(applied);
  await page.getByRole('button', { name: 'Start new project', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  const created = await projectDocument(page);
  expect(created.title).toBe('Lisbon');
  expect(created.studio.poster.title.text).toBe('Lisbon');
  expect(created.camera.center).toEqual([-9.1427, 38.7369]);
  expect(created.layers).toHaveLength(1);
});
