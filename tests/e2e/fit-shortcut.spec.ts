import { expect, test } from '@playwright/test';

test('physical Shift+Digit1 fits the page without hijacking text, locked maps, or modals', async ({ page }) => {
  await page.goto('./');
  const map = page.getByTestId('map-canvas');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const select = page.getByRole('button', { name: 'Select (V)' });
  await select.focus();
  await page.keyboard.press('Shift+Digit1');
  await expect(map).toHaveAttribute('data-fit-request', '1');
  const search = page.getByRole('combobox', { name: 'Search places and addresses' });
  await search.press('Shift+Digit1');
  await expect(search).toHaveValue('!');
  await expect(map).toHaveAttribute('data-fit-request', '1');
  await search.fill('');

  const lock = page.getByRole('switch', { name: 'Lock map area' });
  await lock.click();
  await select.press('Shift+Digit1');
  await expect(map).toHaveAttribute('data-fit-request', '1');
  await lock.click();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const close = page.getByRole('button', { name: 'Close export' });
  await close.press('Shift+Digit1');
  await expect(map).toHaveAttribute('data-fit-request', '1');
  await close.click();
  await select.press('Shift+Digit1');
  await expect(map).toHaveAttribute('data-fit-request', '2');
});
