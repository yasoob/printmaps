import { expect, test } from '@playwright/test';

test('project file menu keeps autosave authoritative on desktop and mobile', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save ZIP' })).toHaveCount(0);
  const trigger = page.locator('.project-title');
  await trigger.focus();
  await trigger.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Project file menu' });
  await expect(menu.getByRole('menuitem', { name: 'Open project' })).toBeFocused();
  await expect(menu.getByRole('menuitem', { name: 'Download project', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Download project archive' })).toBeVisible();
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'docs/screenshots/latest-desktop.png' });
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();

  const chooserPromise = page.waitForEvent('filechooser');
  await trigger.click();
  await menu.getByRole('menuitem', { name: 'Open project' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles([]);
  await expect(trigger).toBeFocused();

  const invalidChooserPromise = page.waitForEvent('filechooser');
  await trigger.click();
  await menu.getByRole('menuitem', { name: 'Open project' }).click();
  const invalidChooser = await invalidChooserPromise;
  await invalidChooser.setFiles({ name: 'renamed.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  const fileAlert = page.getByRole('alert', { name: 'Project file status' });
  await expect(fileAlert).toContainText('.printmap.json');
  expect(await fileAlert.evaluate((element) => getComputedStyle(element).position)).toBe('fixed');
  const alertBounds = await fileAlert.boundingBox();
  expect(alertBounds).not.toBeNull();
  expect(alertBounds!.x).toBeGreaterThanOrEqual(0);
  expect(alertBounds!.x + alertBounds!.width).toBeLessThanOrEqual(1440);
  await expect(trigger).toBeFocused();

  const downloadPromise = page.waitForEvent('download');
  await trigger.click();
  await menu.getByRole('menuitem', { name: 'Download project', exact: true }).click();
  await downloadPromise;
  await expect(fileAlert).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  const menuItems = await menu.getByRole('menuitem').all();
  for (const item of menuItems) {
    const bounds = await item.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'docs/screenshots/latest-mobile.png' });
});
