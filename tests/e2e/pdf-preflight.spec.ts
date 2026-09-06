import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function setPageSize(page: Page, value: string) {
  for (const name of ['Page width', 'Page height']) {
    const field = page.getByRole('spinbutton', { name, exact: true });
    await field.fill(value);
    await field.press('Enter');
  }
}

async function largePage(page: Page) {
  await page.goto('./');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await setPageSize(page, '1330');
  await page.getByRole('button', { name: 'Select (V)', exact: true }).focus();
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`unsafe PDF is explained before download and alternatives stay usable at ${viewport.width}px`, async ({ page }, testInfo) => {
    await largePage(page);
    await page.setViewportSize(viewport);
    let downloads = 0;
    page.on('download', () => { downloads += 1; });
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Export map' });
    await dialog.getByRole('radio', { name: /^PDF / }).click();
    const download = dialog.getByRole('button', { name: 'Download PDF', exact: true });
    await expect(download).toBeDisabled();
    await expect(download).toHaveAccessibleDescription(/512 MiB safety limit/);
    const warning = dialog.getByRole('alert');
    await expect(warning).toContainText('Reduce the page dimensions');
    await expect(warning).toContainText('preview-resolution raster basemap');
    await expect(warning).not.toContainText('882993928');
    await warning.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('ux-fix-032-pdf-preflight.png'), animations: 'disabled' });
    await dialog.getByRole('radio', { name: /^Layered SVG / }).click();
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Download layered SVG' })).toBeEnabled();
    await dialog.getByRole('radio', { name: /^PDF / }).click();
    await expect(download).toBeDisabled();
    const settings = dialog.getByRole('region', { name: 'Export settings' });
    await settings.focus();
    await settings.press('End');
    if (viewport.height < 500) {
      await expect.poll(() => settings.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThanOrEqual(1);
      await expect(dialog.getByText(/Reduce the page dimensions/)).toBeInViewport();
    }
    const bounds = await download.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    expect(downloads).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('ux-fix-032-pdf-actions.png'), animations: 'disabled' });
    await dialog.getByRole('button', { name: 'Close export', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeFocused();
  });
}

test('correcting the page size enables a real PDF with the requested physical dimensions', async ({ page }, testInfo) => {
  await largePage(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('radio', { name: /^PDF / }).click();
  await expect(dialog.getByRole('button', { name: 'Download PDF', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Close export', exact: true }).click();
  await setPageSize(page, '25.4');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('radio', { name: /^PDF / }).click();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  const downloading = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PDF', exact: true }).click();
  const file = await downloading;
  const path = testInfo.outputPath('ux-fix-032-safe.pdf');
  await file.saveAs(path);
  const contents = await readFile(path);
  expect(contents.subarray(0, 8).toString('latin1')).toBe('%PDF-1.7');
  expect(contents.toString('latin1')).toContain('/MediaBox [0 0 72 72]');
  await expect(dialog.getByRole('status', { name: 'Export status' })).toContainText('Download started for PDF.');
  await page.screenshot({ path: testInfo.outputPath('ux-fix-032-safe-pdf.png'), animations: 'disabled' });
});
