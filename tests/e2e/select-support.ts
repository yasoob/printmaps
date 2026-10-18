import { expect, type Locator, type Page } from '@playwright/test';

type Scope = Page | Locator;

function pageOf(scope: Scope): Page {
  return 'goto' in scope ? scope : scope.page();
}

function selectControl(scope: Scope, label: string | RegExp) {
  return scope.getByRole('combobox', { name: label, exact: typeof label === 'string' });
}

/**
 * Chooses the option whose visible label is `option` in the select named `label`.
 * Handles the shared shadcn select (combobox trigger + portaled listbox) and native `<select>`.
 */
export async function chooseOption(scope: Scope, label: string | RegExp, option: string) {
  const control = selectControl(scope, label);
  if (await control.evaluate((element) => element instanceof HTMLSelectElement)) {
    await control.selectOption({ label: option });
    return;
  }
  await control.click();
  const listbox = pageOf(scope).getByRole('listbox');
  await listbox.getByRole('option', { name: option, exact: true }).click();
  await expect(control).toHaveAttribute('aria-expanded', 'false');
}

/**
Asserts the raw selected value (`data-value` on the shared select, `value` on a native select).
*/
export async function expectSelectValue(scope: Scope, label: string | RegExp, value: string) {
  const control = selectControl(scope, label);
  if (await control.evaluate((element) => element instanceof HTMLSelectElement)) {
    await expect(control).toHaveValue(value);
  } else {
    await expect(control).toHaveAttribute('data-value', value);
  }
}
