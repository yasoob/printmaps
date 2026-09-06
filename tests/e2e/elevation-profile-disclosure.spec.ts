import { expect, test } from '@playwright/test';
import { openAdvanced } from './advanced-route-test-support';

for (const width of [1440, 390]) {
  test(`session-only profile disclosure remains readable at ${width}px without requesting terrain`, async ({ page }, testInfo) => {
    let requests = 0;
    await page.route('https://api.open-meteo.com/v1/elevation**', async (route) => {
      requests += 1;
      await route.abort();
    });
    await page.goto('./');
    await page.getByRole('button', { name: 'Select Route 01', exact: true }).click();
    await openAdvanced(page);
    await page.setViewportSize({ width, height: 844 });
    const note = page.locator('.elevation-profile-panel > small').filter({ hasText: 'Profile data, file choices and settings' });
    await note.scrollIntoViewIfNeeded();
    await expect(note).toBeVisible();
    await expect(note).toContainText('not saved in project files');
    expect(await note.evaluate((element) => Number(getComputedStyle(element).fontSize.replace(/px$/, '')))).toBeGreaterThanOrEqual(12);
    expect(requests).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('ux-fix-039-session-disclosure.png'), animations: 'disabled' });
  });
}
