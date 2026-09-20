import { expect, test } from '@playwright/test';

test('video dialog fits mobile, cancels without a download, and restores keyboard focus', async ({ page }, testInfo) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.route('**/video-dialog-harness', async (route) => {
    const response = await route.fetch({ url: new URL('/', route.request().url()).href });
    const responseHtml = await response.text();
    const html = responseHtml.replace('<script type="module" src="/src/main.tsx"></script>', '');
    await route.fulfill({ response, body: html });
  });
  await page.goto('/video-dialog-harness');
  await page.evaluate(async () => {
    const path = '/tests/e2e/video-dialog-harness.tsx';
    const { mountVideoDialogHarness } = await import(path) as typeof import('./video-dialog-harness');
    await mountVideoDialogHarness();
  });
  const trigger = page.getByRole('button', { name: 'Open video export' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Export map video' });
  await expect(dialog).toBeVisible();
  const inspectorZ = await page.getByLabel('Project inspector').evaluate((element) => Number(getComputedStyle(element).zIndex));
  const dialogZ = await dialog.evaluate((element) => Number(getComputedStyle(element).zIndex));
  const backdropZ = await page.locator('[data-slot="dialog-overlay"]').evaluate((element) => Number(getComputedStyle(element).zIndex));
  expect(dialogZ).toBeGreaterThan(inspectorZ);
  expect(backdropZ).toBeGreaterThan(inspectorZ);
  expect(dialogZ).toBeGreaterThan(backdropZ);
  await expect(dialog.getByLabel('Duration')).toHaveValue('5');
  await dialog.getByLabel('Video aspect').selectOption('4:5');
  await expect(dialog.getByLabel('Video aspect')).toHaveValue('4:5');
  const bounds = await dialog.boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(360);
  expect(bounds?.height).toBeLessThanOrEqual(716);
  let downloads = 0;
  page.on('download', () => { downloads++; });
  const download = dialog.getByRole('button', { name: 'Download MP4' });
  if (await download.isDisabled()) {
    await expect(dialog.getByRole('alert')).toContainText(/MP4|canvas/);
    testInfo.annotations.push({ type: 'unsupported-mp4', description: await dialog.getByRole('alert').textContent() ?? 'MP4 unsupported' });
    return;
  }
  await download.click();
  const cancel = dialog.getByRole('button', { name: 'Cancel recording' });
  await expect(cancel).toBeFocused();
  await expect(dialog.getByRole('progressbar')).toBeVisible();
  await expect(dialog.getByRole('status')).toContainText(/Recording \d+%/, { timeout: 15_000 });
  await cancel.click();
  await expect(dialog.getByRole('status')).toContainText('cancelled');
  await expect(download).toBeFocused();
  await expect(page.locator('[data-video-export-renderer]')).toHaveCount(0);
  expect(downloads).toBe(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
