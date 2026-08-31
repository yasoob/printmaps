import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { waitForAutosaveReady } from './autosave-fixture';

async function openCustomizer(page: Page) {
  await page.getByRole('button', { name: /Customize colors|Edit custom palette/ }).click();
  await expect(page.getByRole('heading', { name: 'Customize map' })).toBeFocused();
}

async function setRange(slider: Locator, value: number) {
  await slider.fill(String(value));
  await slider.blur();
}

async function customizePaper(page: Page) {
  await openCustomizer(page);
  await page.getByRole('button', { name: 'Warm' }).click();
  await setRange(page.getByRole('slider', { name: 'Contrast' }), 72);
  await setRange(page.getByRole('slider', { name: 'Detail' }), 35);
  await page.getByLabel('Water color', { exact: true }).fill('#123456');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-style-customized', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
}

test('a maker quick-tunes, overrides one semantic color, and returns to the main inspector', async ({ page }) => {
  await page.goto('./');
  await waitForAutosaveReady(page);
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });

  await customizePaper(page);
  const waterRow = page.getByLabel('Water color', { exact: true }).locator('..');
  await expect(waterRow).toContainText('Custom');
  await expect(page.getByLabel('Reset Water color')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/map-style-customization-desktop-20260830.png' });

  await page.getByRole('button', { name: 'Back to project properties' }).click();
  await expect(page.getByRole('button', { name: /Edit custom palette/ })).toBeFocused();
  await expect(page.getByRole('button', { name: /Edit custom palette/ })).not.toContainText('Quick Tune');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'docs/screenshots/map-style-customization-main-20260830.png' });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project' }).click();
  await page.getByRole('menuitem', { name: 'Download project' }).click();
  const download = await downloadPromise;
  const projectPath = await download.path();
  expect(projectPath).not.toBeNull();
  const project = JSON.parse(await readFile(projectPath!, 'utf8'));
  expect(project).toMatchObject({
    schemaVersion: 25,
    style: {
      preset: 'paper',
      customization: {
        tone: 'warm',
        contrast: 72,
        detail: 35,
        colors: { water: '#123456' },
      },
    },
  });
});

test('a cautious maker can reset one color or the complete style and undo either choice', async ({ page }) => {
  await page.goto('./');
  await waitForAutosaveReady(page);
  await page.getByRole('radio', { name: /^Night Ink:/ }).click();
  await customizePaper(page);

  await page.getByLabel('Reset Water color').click();
  await expect(page.getByLabel('Reset Water color')).toBeHidden();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('Reset Water color')).toBeVisible();

  await page.getByRole('button', { name: 'Reset to Paper' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-style-preset', 'paper');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-style-customized', 'false');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-style-preset', 'night-ink');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-style-customized', 'true');

  await page.getByRole('button', { name: 'Clear tuning and overrides' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-style-preset', 'night-ink');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-style-customized', 'false');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-style-customized', 'true');

  await page.getByRole('button', { name: 'Back to project properties' }).click();
  await page.getByRole('button', { name: 'Reset to Paper' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-style-preset', 'paper');
  await expect(page.getByRole('button', { name: /Customize colors/ })).toBeVisible();
});

test('custom styling survives autosave reload and remains exportable', async ({ page }) => {
  await page.goto('./');
  await waitForAutosaveReady(page);
  await customizePaper(page);
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');

  await page.reload();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-style-customized', 'true', { timeout: 20_000 });
  await openCustomizer(page);
  await expect(page.getByRole('button', { name: 'Warm' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('slider', { name: 'Contrast' })).toHaveValue('72');
  await expect(page.getByLabel('Water color', { exact: true })).toHaveValue('#123456');

  await page.getByRole('button', { name: 'Back to project properties' }).click();
  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const download = await downloadPromise;
  expect(await download.path()).not.toBeNull();
});

test('existing map details survive customization and choosing a new base clears only custom styling', async ({ page }) => {
  await page.goto('./');
  await waitForAutosaveReady(page);
  await customizePaper(page);
  await page.getByRole('button', { name: 'Back to project properties' }).click();

  await page.getByRole('combobox', { name: 'Map language' }).selectOption('de');
  await page.getByRole('spinbutton', { name: 'Text scale' }).fill('125');
  await page.getByRole('spinbutton', { name: 'Text scale' }).blur();
  await page.getByRole('checkbox', { name: 'Show roads' }).uncheck();
  await openCustomizer(page);
  await expect(page.getByLabel('Water color', { exact: true })).toHaveValue('#123456');
  await page.getByRole('button', { name: 'Back to project properties' }).click();

  await page.getByRole('radio', { name: /^Graphite:/ }).click();

  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-style-preset', 'graphite');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-style-customized', 'false');
  await expect(page.getByRole('combobox', { name: 'Map language' })).toHaveValue('de');
  await expect(page.getByRole('spinbutton', { name: 'Text scale' })).toHaveValue('125');
  await expect(page.getByRole('checkbox', { name: 'Show roads' })).not.toBeChecked();
});

test('keyboard and mobile users can enter, leave, and reset the customization flow', async ({ page }) => {
  await page.goto('./');
  await waitForAutosaveReady(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open properties' }).click();
  await openCustomizer(page);
  await page.getByRole('button', { name: 'Cool' }).click();
  await page.screenshot({ path: 'docs/screenshots/map-style-customization-mobile-20260830.png' });

  await page.getByRole('heading', { name: 'Customize map' }).press('Escape');
  await expect(page.getByRole('button', { name: /Edit custom palette/ })).toBeFocused();
  const reset = page.getByRole('button', { name: 'Reset to Paper' });
  await reset.scrollIntoViewIfNeeded();
  await reset.click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-style-customized', 'false');
  expect(await page.evaluate(() => document.body.scrollWidth - window.innerWidth)).toBe(0);
});
