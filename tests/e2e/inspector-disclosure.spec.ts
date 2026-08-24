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

  const desktopProperties = page.getByRole('complementary', { name: 'Properties sidebar' });
  const desktopPropertiesBounds = await desktopProperties.boundingBox();
  expect(desktopPropertiesBounds).not.toBeNull();
  expect(desktopPropertiesBounds!.width).toBeGreaterThanOrEqual(304);
  expect(desktopPropertiesBounds!.width).toBeLessThanOrEqual(320);
  await expect(page.getByRole('button', { name: 'Project menu' })).toHaveCount(0);
  expect(await desktopProperties.locator('.inspector-accordion').first().evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe('0px');
  const presetRowBounds = await page.getByRole('combobox', { name: 'Page preset' }).locator('xpath=../..').boundingBox();
  expect(presetRowBounds).not.toBeNull();
  expect(presetRowBounds!.height).toBeGreaterThanOrEqual(40);

  const pageSection = page.getByRole('button', { name: /Page/ });
  const mapStyle = page.getByRole('button', { name: /Map style/ });
  const camera = page.getByRole('button', { name: /Camera & location/ });
  const details = page.getByRole('button', { name: /Map details/ });
  await expect(pageSection).toHaveAttribute('aria-expanded', 'true');
  await expect(pageSection).not.toContainText('A4 landscape · 297 × 210 mm');
  await expect(mapStyle).toHaveAttribute('aria-expanded', 'true');
  await expect(mapStyle).not.toContainText('Liberty · Local names · 100%');
  await expect(camera).toHaveAttribute('aria-expanded', 'false');
  await expect(details).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('textbox', { name: 'Bearing' })).toHaveCount(0);

  await camera.focus();
  await camera.press('Enter');
  await expect(camera).not.toContainText('0° bearing · 0° pitch · Unlocked');
  await expect(page.getByRole('textbox', { name: 'Bearing' })).toBeVisible();
  const lockSwitch = page.getByRole('switch', { name: 'Lock map area' });
  await lockSwitch.check();
  await expect.poll(() => lockSwitch.locator('xpath=..').locator('.studio-switch-track').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(0, 0, 0)');
  await lockSwitch.uncheck();
  await details.click();
  const roads = page.getByRole('checkbox', { name: 'Show roads' });
  const checkedColors = await roads.locator('xpath=..').locator('.studio-checkbox-box').evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, foreground: style.color };
  });
  expect(checkedColors).toEqual({ background: 'rgb(0, 0, 0)', foreground: 'rgb(255, 255, 255)' });
  await roads.uncheck();
  await expect(details).not.toContainText('6 of 7 visible');
  await details.click();
  await expect(details).toContainText('6 of 7 visible');
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await expect(page.getByText('Layer properties')).toHaveCount(0);
  expect(await page.locator('.property-section').evaluateAll((elements) => elements.map((element) => getComputedStyle(element).borderTopWidth))).toEqual(expect.arrayContaining(['0px']));
  expect(await page.locator('.property-section').evaluateAll((elements) => elements.every((element) => getComputedStyle(element).borderTopWidth === '0px'))).toBe(true);
  const layerMenu = page.getByRole('button', { name: 'Layer menu' });
  await expect(layerMenu).toHaveText('');
  await expect(layerMenu.locator('svg')).toHaveAttribute('width', '16');
  const visibilitySwitch = page.getByRole('switch', { name: 'Toggle layer visibility' });
  const layerLockSwitch = page.getByRole('switch', { name: 'Toggle layer lock' });
  await expect(visibilitySwitch).toBeChecked();
  await visibilitySwitch.uncheck();
  await expect(visibilitySwitch).not.toBeChecked();
  await visibilitySwitch.check();
  await layerLockSwitch.check();
  await expect(layerLockSwitch).toBeChecked();
  await layerLockSwitch.uncheck();
  await expect(page.getByRole('checkbox', { name: 'Show travel-mode marker' })).toHaveClass(/studio-checkbox-native/);
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'docs/screenshots/latest-desktop.png' });
  await page.locator('.maplibregl-canvas').click({ position: { x: 80, y: 80 } });
  const restoredCamera = page.getByRole('button', { name: /Camera & location/ });
  await expect(restoredCamera).toHaveAttribute('aria-expanded', 'true');
  await restoredCamera.click();

  await page.screenshot({ path: testInfo.outputPath('project-inspector-desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 900, height: 844 });
  const compactDesktopBounds = await desktopProperties.boundingBox();
  expect(compactDesktopBounds).not.toBeNull();
  expect(compactDesktopBounds!.width).toBeGreaterThanOrEqual(304);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  await page.setViewportSize({ width: 899, height: 844 });
  const compactPropertiesTrigger = page.getByRole('button', { name: 'Open properties' });
  await expect(compactPropertiesTrigger).toBeVisible();
  await expect(desktopProperties).toBeHidden();
  await compactPropertiesTrigger.click();
  const compactPropertiesDialog = page.getByRole('dialog', { name: 'Properties sidebar' });
  await expect(compactPropertiesDialog).toBeVisible();
  await expect(compactPropertiesDialog.getByRole('button', { name: 'Close properties' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(compactPropertiesTrigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

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
  await properties.getByRole('button', { name: /Camera & location/ }).click();
  const mobileSwitchBounds = await properties.getByRole('switch', { name: 'Lock map area' }).locator('xpath=..').boundingBox();
  expect(mobileSwitchBounds).not.toBeNull();
  expect(mobileSwitchBounds!.height).toBeGreaterThanOrEqual(44);
  await properties.getByRole('button', { name: /Map details/ }).click();
  const mobileCheckboxBounds = await properties.getByRole('checkbox', { name: 'Show roads' }).locator('xpath=..').boundingBox();
  expect(mobileCheckboxBounds).not.toBeNull();
  expect(mobileCheckboxBounds!.height).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('project-inspector-mobile.png'), fullPage: true });
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'docs/screenshots/latest-mobile.png' });
  expect(consoleProblems).toEqual([]);
});
