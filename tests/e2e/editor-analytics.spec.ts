import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    editorAnalyticsCalls: Parameters<NonNullable<Window['gtag']>>[];
  }
}

test('records editor actions once across buttons and shortcuts without collecting user content', async ({ page }) => {
  await page.addInitScript(() => {
    const calls: Window['editorAnalyticsCalls'] = [];
    Object.defineProperties(window, {
      editorAnalyticsCalls: { configurable: true, value: calls },
      gtag: {
        configurable: true,
        value: (...args: Window['editorAnalyticsCalls'][number]) => { calls.push(args); },
      },
    });
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Project', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.editorAnalyticsCalls.map((call) => call[2].action)))
    .toEqual(['editorOpened']);

  await page.getByRole('button', { name: 'Select Coffee stop' }).click();
  const name = page.getByRole('textbox', { name: 'Layer name' });
  await name.fill('Private place name');
  await name.press('Tab');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByRole('button', { name: 'Select Private place name' })).toBeVisible();

  const calls = await page.evaluate(() => window.editorAnalyticsCalls);
  const actions = calls.map((call) => call[2].action);
  for (const action of ['selectLayer', 'renameLayer', 'undo', 'redo']) {
    expect(actions.filter((candidate) => candidate === action)).toHaveLength(1);
  }
  expect(calls.every((call) => call[0] === 'event' && call[1] === 'editor_action')).toBe(true);
  expect(JSON.stringify(calls)).not.toMatch(/Private place name|Coffee stop|poi-cafe|coordinates/);
});

test('keeps the editor usable when analytics is unavailable', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Project', exact: true })).toBeVisible();
  expect(await page.evaluate(() => typeof window.gtag)).toBe('undefined');
  await page.getByRole('button', { name: 'Hide Route 01' }).click();
  await expect(page.getByRole('button', { name: 'Show Route 01' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hide Route 01' })).toBeVisible();
});
