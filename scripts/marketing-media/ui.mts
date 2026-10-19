import type { Locator, Page } from 'playwright';
import { tidy, waitForMap } from './editor.mts';

export type Box = { x: number; y: number; width: number; height: number };

export const SITE_ORIGIN = 'https://printmaps.yasoob.me';

export async function openTab(page: Page, name: 'Map' | 'Layout') {
  await page.getByRole('tab', { name, exact: true }).click();
  await page.waitForTimeout(400);
}

/** Expand or collapse an inspector accordion by its visible title. */
export async function accordion(page: Page, title: string, isOpen = true) {
  const trigger = page.locator('.right-sidebar').getByRole('button', { name: new RegExp(`^${title}`) }).first();
  await trigger.scrollIntoViewIfNeeded();
  const expanded = await trigger.getAttribute('aria-expanded');
  if ((expanded === 'true') !== isOpen) await trigger.click();
  await page.waitForTimeout(350);
}

export async function collapseAll(page: Page, titles: string[]) {
  for (const title of titles) {
    const trigger = page.locator('.right-sidebar').getByRole('button', { name: new RegExp(`^${title}`) }).first();
    if (await trigger.count() > 0 && await trigger.getAttribute('aria-expanded') === 'true') await trigger.click();
  }
  await page.waitForTimeout(300);
}

export async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  if (!found) throw new Error('Element is not visible.');
  return found;
}

export function pad(area: Box, padding: number, limit = { width: 1440, height: 900 }): Box {
  const x = Math.max(0, area.x - padding);
  const y = Math.max(0, area.y - padding);
  return {
    x, y,
    width: Math.min(limit.width - x, area.width + padding * 2),
    height: Math.min(limit.height - y, area.height + padding * 2),
  };
}

/** Screenshot a CSS-pixel region at the context's 2× device scale. */
export async function capture(page: Page, file: string, clip?: Box) {
  await tidy(page);
  await page.screenshot({ path: file, clip, animations: 'disabled', caret: 'hide' });
}

/** Show the production origin instead of the local dev server in share links. */
export async function useProductionOrigin(page: Page) {
  await page.evaluate((origin) => {
    for (const field of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')) {
      if (field.value.includes(location.origin)) field.value = field.value.replaceAll(location.origin, origin);
    }
  }, SITE_ORIGIN);
}

export async function openExport(page: Page, tab: 'Print' | 'Video' | '3D model') {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('tab', { name: tab, exact: true }).click();
  await page.waitForTimeout(2500);
  return dialog;
}

export async function selectLayer(page: Page, name: string) {
  await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
  await page.waitForTimeout(600);
}

export async function settle(page: Page, ms = 2500) {
  await waitForMap(page, ms);
  await tidy(page);
}
