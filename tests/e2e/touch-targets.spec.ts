import { expect, test, type Locator } from '@playwright/test';

async function expectTouchTarget(control: Locator) {
  const bounds = await control.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  return bounds!;
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1024, height: 768 },
]) {
  test(`coarse-pointer controls provide non-overlapping touch targets at ${viewport.width}px`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    try {
      await page.goto('./');
      const map = page.getByTestId('map-canvas');
      await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
      if (viewport.width < 900) await page.getByRole('button', { name: 'Open layers' }).tap();
      for (const name of ['Hide Coffee stop', 'Select Coffee stop', 'Lock Coffee stop', 'Reorder Coffee stop']) {
        await expectTouchTarget(page.getByRole('button', { name, exact: true }));
      }
      const rowBounds = await page.locator('[data-layer-id="poi-cafe"] button').evaluateAll((buttons) => (
        buttons.map((button) => {
          const rect = button.getBoundingClientRect();
          return { left: rect.left, right: rect.right };
        })
      ));
      for (let index = 1; index < rowBounds.length; index += 1) {
        expect(rowBounds[index].left).toBeGreaterThanOrEqual(rowBounds[index - 1].right);
      }
      if (viewport.width < 900) await page.getByRole('button', { name: 'Close layers' }).tap();
      for (const name of ['Select (V)', 'Place (P)', 'Route (R)', 'Area (S)', 'Fit page', 'Zoom in', 'Zoom out']) {
        await expectTouchTarget(page.getByRole('button', { name, exact: true }));
      }

      if (viewport.width < 900) await page.getByRole('button', { name: 'Open properties' }).tap();
      const styleSection = page.getByRole('button', { name: 'Map style', exact: true });
      if (await styleSection.getAttribute('aria-expanded') === 'false') await styleSection.click();
      await page.getByRole('button', { name: 'Customize colors', exact: true }).click();
      await page.locator('.map-style-customizer').evaluate(async (element) => {
        await Promise.all(element.getAnimations().map((animation) => animation.finished));
      });
      const colors = page.locator('.map-style-color-row input[type="color"]');
      expect(await colors.count()).toBe(11);
      const colorInputs = await colors.all();
      for (const color of colorInputs) await expectTouchTarget(color);
      for (const name of ['Contrast', 'Detail']) await expectTouchTarget(page.getByRole('slider', { name, exact: true }));
      await page.getByLabel('Water color', { exact: true }).fill('#00ff00');
      const reset = page.getByRole('button', { name: 'Reset Water color', exact: true });
      await expectTouchTarget(reset);
      await reset.tap();
      await expect(map).toHaveAttribute('data-map-style-customized', 'false');

      const contrast = page.getByRole('slider', { name: 'Contrast', exact: true });
      const contrastBounds = await expectTouchTarget(contrast);
      await contrast.tap({ position: { x: contrastBounds.width * 0.75, y: contrastBounds.height / 2 } });
      await expect(contrast).not.toHaveValue('50');
      await expect(map).toHaveAttribute('data-map-style-customized', 'true');
    } finally {
      await context.close();
    }
  });
}
