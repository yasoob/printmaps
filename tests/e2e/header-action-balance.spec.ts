import { expect, test } from '@playwright/test';

for (const width of [1440, 900, 600, 390, 320]) {
  test(`document actions share typography, alignment and spacing at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./');
    const actions = ['Project', 'Share', 'Export'].map((name) => page.getByRole('button', { name, exact: true }));
    for (const action of actions) await expect(action).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const metrics = await Promise.all(actions.map((action) => action.evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      const label = button.querySelector('span')!;
      const icon = button.querySelector('svg')!;
      const labelBounds = label.getBoundingClientRect();
      const iconBounds = icon.getBoundingClientRect();
      const style = getComputedStyle(button);
      return {
        x: bounds.x, right: bounds.right, height: bounds.height, centerY: bounds.y + bounds.height / 2,
        labelCenterY: labelBounds.y + labelBounds.height / 2, iconCenterY: iconBounds.y + iconBounds.height / 2,
        iconWidth: iconBounds.width, iconHeight: iconBounds.height, stroke: icon.getAttribute('stroke-width'),
        fontSize: style.fontSize, fontWeight: style.fontWeight, fontFamily: style.fontFamily,
        padding: [style.paddingLeft, style.paddingRight], background: style.backgroundColor,
      };
    })));
    for (const metric of metrics) {
      expect(metric.fontSize).toBe('13px');
      expect(metric.fontWeight).toBe('500');
      expect(metric.fontFamily).toBe(metrics[0].fontFamily);
      expect(metric.padding).toEqual(metrics[0].padding);
      expect(metric.height).toBe(width < 900 ? 44 : 32);
      expect(metric.centerY).toBeCloseTo(metrics[0].centerY, 1);
      expect(metric.labelCenterY).toBeCloseTo(metrics[0].labelCenterY, 1);
      expect(metric.iconCenterY).toBeCloseTo(metric.centerY, 1);
      expect(metric.iconWidth).toBe(14);
      expect(metric.iconHeight).toBe(14);
      expect(metric.stroke).toBe('1.8');
      expect(metric.x).toBeGreaterThanOrEqual(0);
      expect(metric.right).toBeLessThanOrEqual(width);
    }
    const gap = width <= 560 ? 4 : 8;
    expect(metrics[1].x - metrics[0].right).toBeCloseTo(gap, 1);
    expect(metrics[2].x - metrics[1].right).toBeCloseTo(gap, 1);
    const home = await page.getByRole('link', { name: 'Print Map Studio home' }).boundingBox();
    expect(home!.x + home!.width).toBeLessThanOrEqual(metrics[0].x);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(width);
    const exportFill = await actions[2].evaluate((button, mobile) =>
      getComputedStyle(button, mobile ? '::before' : undefined).backgroundColor, width < 900);
    expect(exportFill).not.toBe(metrics[1].background);
    await page.locator('.document-actions').screenshot({ path: info.outputPath(`header-actions-${width}.png`) });
    await page.locator('.topbar').screenshot({ path: info.outputPath(`header-${width}.png`) });

    if (width !== 390) return;
    await actions[0].click();
    await expect(page.getByRole('menuitem', { name: 'Download project' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(actions[0]).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(actions[1]).toBeFocused();
    await page.keyboard.press('Enter');
    const share = page.getByRole('dialog', { name: 'Share this map' });
    await expect(share).toBeVisible();
    await share.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(actions[1]).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(actions[2]).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Export map', exact: true })).toBeVisible();
  });
}
