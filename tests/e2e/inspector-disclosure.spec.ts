import { expect, test } from '@playwright/test';

const disclosureKeys = [
  'page',
  'map-style',
  'camera-location',
  'map-details',
  'provider-services',
  'technical-export',
].map((section) => `print-map-studio:inspector:project:${section}`);

const isHeadlessWebGlDiagnostic = (message: string) => message.includes('GPU stall due to ReadPixels');

test('project inspector progressively discloses advanced controls on desktop and mobile', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isHeadlessWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });
  await page.addInitScript((keys) => {
    for (const key of keys) window.localStorage.removeItem(key);
  }, disclosureKeys);

  await page.goto('/');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });

  const pageSection = page.getByRole('button', { name: /Page/ });
  const mapStyle = page.getByRole('button', { name: /Map style/ });
  const camera = page.getByRole('button', { name: /Camera & location/ });
  const details = page.getByRole('button', { name: /Map details/ });
  await expect(pageSection).toHaveAttribute('aria-expanded', 'true');
  await expect(pageSection).toContainText('A4 landscape · 297 × 210 mm');
  await expect(mapStyle).toHaveAttribute('aria-expanded', 'true');
  await expect(camera).toHaveAttribute('aria-expanded', 'false');
  await expect(details).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('textbox', { name: 'Bearing' })).toHaveCount(0);

  await camera.focus();
  await camera.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Bearing' })).toBeVisible();
  await details.click();
  await page.getByRole('checkbox', { name: 'Show roads' }).uncheck();
  await expect(details).toContainText('6 of 7 visible');
  await details.click();
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await page.locator('.maplibregl-canvas').click({ position: { x: 80, y: 80 } });
  const restoredCamera = page.getByRole('button', { name: /Camera & location/ });
  await expect(restoredCamera).toHaveAttribute('aria-expanded', 'true');
  await restoredCamera.click();

  await page.screenshot({ path: testInfo.outputPath('project-inspector-desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true');
  await page.getByRole('button', { name: 'Open properties' }).click();
  const properties = page.getByRole('dialog', { name: 'Properties sidebar' });
  const propertiesBounds = await properties.boundingBox();
  const portraitBounds = await properties.getByRole('button', { name: 'Portrait' }).boundingBox();
  expect(propertiesBounds).not.toBeNull();
  expect(portraitBounds).not.toBeNull();
  expect(propertiesBounds!.width).toBeGreaterThanOrEqual(300);
  expect(portraitBounds!.x + portraitBounds!.width).toBeLessThanOrEqual(propertiesBounds!.x + propertiesBounds!.width);
  await expect(properties.getByRole('button', { name: 'Close properties' })).toBeVisible();
  await expect(properties.getByRole('button', { name: /Camera & location/ })).toHaveAttribute('aria-expanded', 'false');
  const mobileToggleBounds = await properties.getByRole('button', { name: /Camera & location/ }).boundingBox();
  expect(mobileToggleBounds).not.toBeNull();
  expect(mobileToggleBounds!.height).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('project-inspector-mobile.png'), fullPage: true });
  expect(consoleProblems).toEqual([]);
});
