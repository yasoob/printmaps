import { expect, type Page } from '@playwright/test';

export async function discardUnexpectedAutosaveDraft(page: Page) {
  const status = page.getByRole('status', { name: 'Autosave status' });
  await expect(status).toHaveText(/^(Autosave ready|Local draft found)$/, { timeout: 20_000 });
  const recovery = page.getByRole('dialog', { name: 'Recover local draft' });
  if (!await recovery.isVisible()) return;
  await recovery.getByRole('button', { name: 'Discard draft' }).click();
  await expect(recovery).not.toBeVisible();
  await expect(status).toHaveText('Autosave ready');
}
