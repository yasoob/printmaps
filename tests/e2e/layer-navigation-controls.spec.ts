import { expect, test, type Locator, type Page } from '@playwright/test';
import { openSearch, search, start, status } from './layer-navigation-support';

async function headerBounds(page: Page) {
  return page.locator('#layers-panel .panel-header button, #layers-panel .panel-header button > svg').evaluateAll((elements) => (
    elements.map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    })
  ));
}

async function buttonAppearance(button: Locator) {
  return button.evaluate((element) => {
    const { backgroundColor, color, borderRadius } = getComputedStyle(element);
    return { backgroundColor, color, borderRadius };
  });
}

test('compact header reveals focused search and clears hidden filters', async ({ page }, info) => {
  await start(page);
  const panel = page.getByRole('complementary', { name: 'Layers sidebar' });
  const toggle = page.getByRole('button', { name: 'Search layers', exact: true });
  await expect(search(page)).toHaveCount(0);
  await expect(status(page)).toBeEmpty();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  expect(await panel.locator('.panel-header button').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))).toEqual([
    'Layer keyboard shortcuts', 'Search layers', 'Collapse layers',
  ]);
  await panel.screenshot({ path: info.outputPath('layers-compact-desktop.png') });

  await openSearch(page);
  await expect(status(page)).toBeEmpty();
  await search(page).fill(' '.repeat(3));
  await expect(status(page)).toBeEmpty();
  await search(page).fill('keep');
  await expect(status(page)).toHaveText('3 of 6 layers');
  await expect(page.locator('#layers-list > li')).toHaveCount(3);
  await toggle.click();
  await expect(search(page)).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(status(page)).toBeEmpty();
  await expect(page.locator('#layers-list > li')).toHaveCount(6);
  await openSearch(page);
  await expect(search(page)).toHaveValue('');
  await search(page).fill('absent');
  await expect(status(page)).toHaveText('0 of 6 layers');
  await expect(page.getByText('No matching layers. Change or clear the filter.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(search(page)).toHaveCount(0);
  await expect(page.locator('#layers-list > li')).toHaveCount(6);
});

test('shortcuts support hover, keyboard focus, click pinning and dismissal without moving layers', async ({ page }, info) => {
  await start(page);
  const help = page.getByRole('button', { name: 'Layer keyboard shortcuts' });
  const title = page.getByRole('complementary', { name: 'Layers sidebar' }).getByText('Layers', { exact: true });
  const tooltip = page.getByRole('tooltip');
  const firstRow = page.locator('#layers-list > li').first();
  const before = await firstRow.boundingBox();
  const headerBefore = await headerBounds(page);
  await help.hover();
  await expect(tooltip).toBeVisible();
  expect(await headerBounds(page)).toEqual(headerBefore);
  await expect(tooltip).toContainText('Alt +');
  await tooltip.hover();
  await expect(tooltip).toBeVisible();
  await title.hover();
  await expect(tooltip).toHaveCount(0);
  expect(await headerBounds(page)).toEqual(headerBefore);
  await page.getByRole('button', { name: 'Search layers', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(help).toBeFocused();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tooltip).toHaveCount(0);
  await expect(help).toBeFocused();
  await help.click();
  await title.hover();
  await expect(tooltip).toBeVisible();
  expect(await firstRow.boundingBox()).toEqual(before);
  expect(await headerBounds(page)).toEqual(headerBefore);
  await page.screenshot({ path: info.outputPath('layers-shortcuts-desktop.png') });
  await help.click();
  await expect(tooltip).toHaveCount(0);
  await help.click();
  await title.click();
  await expect(tooltip).toHaveCount(0);
});

for (const width of [320, 390]) {
  test.describe(`compact mobile header ${width}px`, () => {
    test.use({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true });

    test('matches the close button hover style without shifting header icons', async ({ page }, info) => {
      await start(page);
      await page.getByRole('button', { name: 'Open layers' }).tap();
      const close = page.getByRole('button', { name: 'Close layers' });
      const help = page.getByRole('button', { name: 'Layer keyboard shortcuts' });
      const toggle = page.getByRole('button', { name: 'Search layers', exact: true });
      await expect(close).toBeFocused();
      const before = await headerBounds(page);
      await close.hover();
      const closeAppearance = await buttonAppearance(close);
      await help.hover();
      await expect(page.getByRole('tooltip')).toBeVisible();
      expect(await headerBounds(page)).toEqual(before);
      expect(await buttonAppearance(help)).toEqual(closeAppearance);
      await help.click();
      expect(await buttonAppearance(help)).toEqual(closeAppearance);
      await page.screenshot({ path: info.outputPath(`layers-help-hover-${width}.png`) });
      await help.click();
      await toggle.hover();
      expect(await buttonAppearance(toggle)).toEqual(closeAppearance);
      await toggle.click();
      await expect(search(page)).toBeFocused();
      expect(await buttonAppearance(toggle)).toEqual(closeAppearance);
      expect(await headerBounds(page)).toEqual(before);
      await page.screenshot({ path: info.outputPath(`layers-search-hover-${width}.png`) });
    });

    test('keeps touch help inside the drawer and dismisses it before the drawer', async ({ page }, info) => {
      await start(page);
      await page.getByRole('button', { name: 'Open layers' }).tap();
      const panel = page.getByRole('dialog', { name: 'Layers sidebar' });
      const help = page.getByRole('button', { name: 'Layer keyboard shortcuts' });
      await expect(page.getByRole('button', { name: 'Close layers' })).toBeFocused();
      await expect(search(page)).toHaveCount(0);
      await expect(status(page)).toBeEmpty();
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      await panel.screenshot({ path: info.outputPath(`layers-compact-${width}.png`) });
      for (const button of [help, page.getByRole('button', { name: 'Search layers', exact: true })]) {
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await help.tap();
      const tooltip = page.getByRole('tooltip');
      await expect(tooltip).toBeVisible();
      const box = (await tooltip.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: info.outputPath(`layers-shortcuts-${width}.png`) });
      await page.keyboard.press('Escape');
      await expect(tooltip).toHaveCount(0);
      await expect(panel).toBeVisible();
      await help.tap();
      await expect(tooltip).toBeVisible();
      await help.tap();
      await expect(tooltip).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Open layers' })).toBeFocused();
    });
  });
}
