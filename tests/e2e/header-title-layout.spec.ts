import { expect, test, type Page } from '@playwright/test';

async function expectHeaderActionsVisible(page: Page, width: number) {
  const names = width >= 900 ? ['Project', 'Export', 'Undo', 'Redo'] : ['Project', 'Export'];
  for (const name of names) {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    const bounds = await button.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  }
}

for (const width of [1440, 1024, 900, 600]) {
  test(`long project names cannot displace header actions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./');
    await page.getByRole('button', { name: 'Vienna field guide' }).click();
    const input = page.getByRole('textbox', { name: 'Project title' });
    await input.fill('W'.repeat(120));
    await expectHeaderActionsVisible(page, width);
    await input.press('Enter');
    await expectHeaderActionsVisible(page, width);
    const title = page.locator('.project-title');
    await expect(title).toHaveText('W'.repeat(120));
    expect(await title.locator('span').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Download project' })).toBeVisible();
  });
}
