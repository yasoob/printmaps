import { expect, test } from '@playwright/test';

for (const field of [
  { name: 'Page width', invalid: '0', valid: '240', explanation: 'at least 0.1 mm' },
  { name: 'Page height', invalid: '-1', valid: '180', explanation: 'at least 0.1 mm' },
  { name: 'Bearing', invalid: '181', valid: '30', explanation: 'between -180 and 180' },
  { name: 'Pitch', invalid: '61', valid: '15', explanation: 'between 0 and 60' },
  { name: 'Text scale', invalid: '250', valid: '125', explanation: 'between 50 and 200' },
]) {
  test(`${field.name} explains rejected values and commits once on Enter`, async ({ page }) => {
    await page.goto('./');
    const input = page.getByRole('spinbutton', { name: field.name, exact: true });
    const original = await input.inputValue();
    await input.fill(field.invalid);
    const error = page.locator('.validated-number-field').filter({ has: input }).getByRole('alert');
    await expect(error).toContainText(field.explanation);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await input.press('Tab');
    await expect(input).toHaveValue(original);
    await expect(error).toContainText('Previous value kept.');
    await expect(input).toHaveAttribute('aria-describedby', (await error.getAttribute('id'))!);
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();

    await input.fill(field.valid);
    await input.press('Enter');
    await expect(input).toHaveValue(field.valid);
    await expect(input).toBeFocused();
    await expect(error).toHaveCount(0);
    if (field.name === 'Page width') {
      await expect(page.locator('.print-frame')).toHaveCSS('aspect-ratio', '240 / 210');
      await expect(page.getByRole('combobox', { name: 'Page preset' })).toHaveValue('Custom');
    }
    await input.press('Tab');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(input).toHaveValue(original);

    await input.fill(field.invalid);
    await input.press('Escape');
    await expect(input).toHaveValue(original);
    await expect(input).toBeFocused();
    await expect(error).toHaveCount(0);
  });
}
