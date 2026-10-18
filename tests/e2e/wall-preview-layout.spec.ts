import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  for (const orientation of ['Portrait', 'Landscape'] as const) {
    test(`wall preview has padded regions and a proportionate frame at ${viewport.width}px ${orientation}`, async ({ page }, info) => {
      await page.setViewportSize(viewport);
      await page.route('**/styles/*.json', (route) => route.fulfill({ json: {
        version: 8,
        sources: { fixture: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: 'Wall layout fixture' } },
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#f3eee3' } },
          { id: 'fixture', type: 'circle', source: 'fixture' },
        ],
      } }));
      await page.goto('./');
      await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 30_000 });
      if (viewport.width < 900) await page.getByRole('button', { name: 'Open properties' }).click();
      await page.getByRole('tab', { name: 'Layout', exact: true }).click();
      await page.getByRole('radio', { name: orientation, exact: true }).click();
      if (viewport.width < 900) await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Export', exact: true }).click();
      await page.getByRole('button', { name: 'Preview on wall', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Export map' });
      await expect(dialog.getByRole('img', { name: /finished map poster/ })).toBeVisible();
      await dialog.getByLabel('Frame finish').selectOption('oak');
      const matWidth = dialog.getByRole('spinbutton', { name: 'Mat width', exact: true });
      await matWidth.fill('18');
      await matWidth.press('Tab');
      await expect(matWidth).toHaveValue('18');

      await expect.poll(() => dialog.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const title = element.querySelector('h2')!.getBoundingClientRect();
        const scene = element.querySelector('.studio-wall-scene')!.getBoundingClientRect();
        const controls = element.querySelector('.studio-wall-controls')!.getBoundingClientRect();
        return Math.min(title.left - bounds.left, scene.left - bounds.left,
          bounds.right - scene.right, controls.left - bounds.left, bounds.right - controls.right);
      })).toBeGreaterThanOrEqual(15.5);
      const expectedRatio = orientation === 'Portrait' ? 246 / 333 : 333 / 246;
      await expect.poll(() => dialog.locator('.studio-wall-frame').evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const [left, right, top, bottom] = [
          style.borderLeftWidth, style.borderRightWidth, style.borderTopWidth, style.borderBottomWidth,
        ].map((value) => Number(value.replace(/px$/, '')));
        return (bounds.width - left - right) / (bounds.height - top - bottom);
      })).toBeCloseTo(expectedRatio, 2);
      expect(await dialog.locator('.studio-wall-frame').evaluate((element) => {
        const frame = element.getBoundingClientRect();
        const scene = element.closest('.studio-wall-scene')!.getBoundingClientRect();
        return frame.width > 0 && frame.height > 0 && frame.left >= scene.left
          && frame.right <= scene.right && frame.top >= scene.top && frame.bottom <= scene.bottom;
      })).toBe(true);

      const headerTop = await dialog.locator('.export-dialog-header').evaluate((element) => element.getBoundingClientRect().top);
      await dialog.locator('.studio-wall-body').evaluate((element) => { element.scrollTop = element.scrollHeight; });
      await expect(dialog.getByRole('switch', { name: 'Cast frame shadow' })).toBeVisible();
      const afterScroll = await dialog.locator('.export-dialog-header').evaluate((element) => element.getBoundingClientRect().top);
      expect(afterScroll).toBeCloseTo(headerTop, 1);
      expect(await dialog.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const controls = element.querySelector('.studio-wall-controls')!.getBoundingClientRect();
        return bounds.bottom - controls.bottom;
      })).toBeGreaterThanOrEqual(15.5);
      await page.screenshot({ path: info.outputPath(`wall-${viewport.width}-${orientation.toLowerCase()}.png`) });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    });
  }
}
