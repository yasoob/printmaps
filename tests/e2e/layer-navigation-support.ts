import { writeFile } from 'node:fs/promises';
import { expect, type Page, type TestInfo } from '@playwright/test';
import type { ProjectDocument } from '../../src/domain/project';
import { downloadProject, openProject } from './advanced-route-test-support';
import { mapSnapshot, openInstrumentedMap } from './map-recovery-support';

export const search = (page: Page) => page.getByRole('searchbox', { name: 'Filter layers by name' });
export const status = (page: Page) => page.getByRole('status', { name: 'Layer navigation' });
export const row = (page: Page, id: string) => page.locator(`[data-layer-select="${id}"]`);

export async function openSearch(page: Page) {
  await page.getByRole('button', { name: 'Search layers', exact: true }).click();
  await expect(search(page)).toBeFocused();
}

export async function start(page: Page, count: number | null = null) {
  await page.route('https://api.mapbox.com/**', (route) => route.abort());
  await openInstrumentedMap(page);
  const project: ProjectDocument = await page.evaluate(async (size) => {
    const path = '/tests/fixtures/layerNavigationProject.ts';
    const fixtures = await import(path) as typeof import('../fixtures/layerNavigationProject');
    return size === null ? fixtures.filteredLayerNavigationProject() : fixtures.layerNavigationProject(size);
  }, count);
  await openProject(page, project);
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', project.layers.filter((layer) => layer.type !== 'basemap').map((layer) => layer.id).join(','));
  await expect(page.locator('[role="status"][aria-label="Autosave status"]')).toHaveText('All changes saved locally');
}

export async function tabCounts(page: Page) {
  return page.locator('#layers-panel').evaluate((panel) => {
    const rowButtons = [...panel.querySelectorAll<HTMLButtonElement>(':scope .layer-tree button')];
    const focusable = [...panel.querySelectorAll<HTMLElement>('button, input, a[href], [tabindex]')]
      .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
    return {
      rowButtonCount: rowButtons.length,
      rowTabStops: rowButtons.filter((button) => button.tabIndex >= 0 && !button.disabled).length,
      sidebarTabStops: focusable.length,
      activeIds: [...new Set(rowButtons.filter((button) => button.tabIndex >= 0 && !button.disabled).map((button) => button.closest<HTMLElement>('[data-layer-id]')!.dataset.layerId))],
    };
  });
}

export async function documentAt(page: Page, info: TestInfo, label: string) {
  const result = await downloadProject(page, info, `ux-fix-049-${label}`);
  return result.project;
}

export async function expectActive(page: Page, id: string) {
  const counts = await tabCounts(page);
  expect(counts.activeIds).toEqual([id]);
}

export async function evidence(page: Page, info: TestInfo, label: string, data: object) {
  expect(await page.evaluate(() => window.recoveryRuntimeErrors)).toEqual([]);
  await writeFile(info.outputPath(`ux-fix-049-${label}.json`), JSON.stringify({
    ...data, tabCounts: await tabCounts(page), native: await mapSnapshot(page),
    providerRequestsMocked: false, paidProviderRequestsBlocked: true,
  }, null, 2));
  await page.screenshot({ path: info.outputPath(`ux-fix-049-${label}.png`), animations: 'disabled' });
}

export async function beginDrag(page: Page, sourceName: string, targetName: string) {
  const handle = page.getByRole('button', { name: `Reorder ${sourceName}`, exact: true });
  const target = page.getByRole('button', { name: `Reorder ${targetName}`, exact: true });
  const from = (await handle.boundingBox())!, to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 8, { steps: 3 });
  await expect(page.locator('.layer-tree .is-dragging')).toHaveCount(1);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
}

export async function finishDrag(page: Page) {
  await page.mouse.up();
  await expect(page.locator('.layer-tree .is-dragging')).toHaveCount(0);
}

export function ids(project: ProjectDocument) { return project.layers.map((layer) => layer.id); }
