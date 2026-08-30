import { expect, type Page } from '@playwright/test';

export async function waitForAutosaveReady(page: Page) {
  const status = page.getByRole('status', { name: 'Autosave status' });
  await expect(status).toHaveText('Autosave ready', { timeout: 20_000 });
}
