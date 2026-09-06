import type { Page } from '@playwright/test';

export async function expandToolSettings(page: Page, tool: 'area' | 'route') {
  const button = page.getByRole('button', { name: `Show ${tool} settings` });
  if (await button.isVisible()) await button.click();
}
