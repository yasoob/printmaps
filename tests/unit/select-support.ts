import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

type QueryScope = Pick<typeof screen, 'getByRole'>;

/**
 * Chooses `option` in the select named `label`. Works for the shared shadcn select
 * (`@/components/ui/select`, a role="combobox" trigger with a portaled listbox) and for native
 * `<select>` elements, so call sites can migrate independently of their tests.
 */
export async function chooseOption(user: UserEvent, label: string | RegExp, option: string | RegExp, scope: QueryScope = screen) {
  const control = scope.getByRole('combobox', { name: label });
  if (control instanceof HTMLSelectElement) {
    await user.selectOptions(control, within(control).getByRole('option', { name: option }));
    return;
  }
  await user.click(control);
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByRole('option', { name: option }));
}

/**
Raw selected value of a shared select (its `data-value`) or a native select.
*/
export function selectedValue(control: HTMLElement) {
  return control instanceof HTMLSelectElement ? control.value : control.dataset.value;
}
