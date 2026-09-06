import { buffer } from 'node:stream/consumers';
import { expect, test, type Download, type Page } from '@playwright/test';
import type { ProjectDocument } from '../../src/domain/project';
import { downloadProject } from './map-recovery-support';
import { openProject } from './advanced-route-test-support';
import { savedAdmissionRecord } from './project-admission-support';

declare global {
  interface Window { newProjectRead: { finished: boolean } }
}

async function blankDocument(page: Page): Promise<ProjectDocument> {
  return page.evaluate(async () => {
    const path = '/src/domain/project.ts';
    const module = await import(path);
    return module.createNewProjectDocument();
  });
}

async function requestNew(page: Page) {
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New project', exact: true }).click();
}

async function downloadedProject(download: Download): Promise<ProjectDocument> {
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Project backup stream unavailable');
  const contents = await buffer(stream);
  return JSON.parse(contents.toString('utf8'));
}

test('New protects the outgoing project, resets all document defaults, and preserves normal autosave restoration', async ({ page }, testInfo) => {
  await page.goto('./');
  const blank = await blankDocument(page);
  await page.getByRole('combobox', { name: 'Page preset', exact: true }).selectOption('A3');
  await page.getByRole('radio', { name: /^Night Ink:/ }).click();
  await page.getByRole('combobox', { name: 'Map language', exact: true }).selectOption('de');
  await page.getByRole('spinbutton', { name: 'Bearing', exact: true }).fill('15');
  await page.getByRole('spinbutton', { name: 'Bearing', exact: true }).press('Enter');
  await page.getByRole('switch', { name: 'Lock map area', exact: true }).check();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  await page.getByRole('button', { name: 'Select Route 01', exact: true }).click();
  const original = await downloadProject(page);
  const stored = await savedAdmissionRecord(page);
  await requestNew(page);
  const decision = page.getByRole('dialog', { name: 'Start a new project?' });
  await expect(decision.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await expect(decision).toContainText('Starting a new project');
  const downloading = page.waitForEvent('download');
  await decision.getByRole('button', { name: 'Download current project' }).click();
  const backup = await downloading;
  await backup.saveAs(testInfo.outputPath('ux-fix-036-outgoing.printmap.json'));
  expect(await downloadedProject(backup)).toEqual(original);
  expect(await savedAdmissionRecord(page)).toEqual(stored);
  await expect(decision).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('ux-fix-036-new-project-choice.png'), animations: 'disabled' });
  await decision.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('button', { name: 'Select Route 01', exact: true })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  expect(await downloadProject(page)).toEqual(original);

  await requestNew(page);
  await decision.getByRole('button', { name: 'Start new project' }).click();
  await expect(page.getByRole('button', { name: 'Untitled map', exact: true })).toBeVisible();
  await expect(page.locator('.layer-row')).toHaveCount(1);
  expect(await downloadProject(page)).toEqual(blank);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-style-preset', 'paper');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await expect(page.getByRole('switch', { name: 'Lock map area' })).not.toBeChecked();
  await page.screenshot({ path: testInfo.outputPath('ux-fix-036-fresh-document.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Untitled map', exact: true }).click();
  await page.getByRole('textbox', { name: 'Project title' }).fill('Second map');
  await page.getByRole('textbox', { name: 'Project title' }).press('Enter');
  await page.getByRole('button', { name: 'Portrait', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Second map', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Portrait', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.layer-row')).toHaveCount(1);
});

test('New from pristine defaults does not ask to discard nonexistent work', async ({ page }) => {
  await page.goto('./');
  const blank = await blankDocument(page);
  await openProject(page, blank);
  await requestNew(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await downloadProject(page)).toEqual(blank);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
});

test('New warns about unadded lists, preserves them on cancel, and retires them only after confirmation', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Place (P)' }).click();
  await page.getByRole('button', { name: 'Paste POI list' }).click();
  const input = page.getByRole('textbox', { name: 'POI spreadsheet rows' });
  await input.fill('Unadded list point\t16.4\t48.2');
  await requestNew(page);
  const decision = page.getByRole('dialog', { name: 'Discard unfinished work?' });
  await expect(decision).toContainText('POI lists');
  await decision.getByRole('button', { name: 'Keep editing' }).click();
  await expect(input).toHaveValue('Unadded list point\t16.4\t48.2');
  await requestNew(page);
  await decision.getByRole('button', { name: 'Start new project' }).click();
  await expect(page.getByRole('form', { name: 'Place multiple points' })).toHaveCount(0);
  await expect(page.locator('.layer-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Place (P)' }).click();
  await page.getByRole('button', { name: 'Paste POI list' }).click();
  await expect(input).toHaveValue('');
  await expect(page.getByRole('status', { name: 'Unfinished POI lists' })).toHaveCount(0);
});

test('New is reachable and safely confirmed through the narrow Project menu', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('./');
  const blank = await blankDocument(page);
  await requestNew(page);
  const decision = page.getByRole('dialog', { name: 'Start a new project?' });
  await expect(decision.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  const bounds = await decision.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-036-mobile-choice.png'), animations: 'disabled' });
  await decision.getByRole('button', { name: 'Start new project' }).click();
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Project actions' });
  await expect(menu.getByText('Untitled map', { exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Undo', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await expect(menu.getByRole('menuitem', { name: 'Redo', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');
  expect(await downloadProject(page)).toEqual(blank);
});

test('New supersedes an older pending project read instead of letting it replace the fresh document', async ({ page }) => {
  await page.goto('./');
  const blank = await blankDocument(page);
  const old = { ...await downloadProject(page), title: 'Delayed incoming map' };
  await page.evaluate(() => {
    const text = File.prototype.text;
    Object.assign(window, { newProjectRead: { finished: false } });
    File.prototype.text = async function (this: File) {
      if (this.name === 'old.printmap.json') {
        await new Promise<void>((resolve) => window.addEventListener('release-old-project', () => resolve(), { once: true }));
      }
      const result = await text.call(this);
      if (this.name === 'old.printmap.json') window.newProjectRead.finished = true;
      return result;
    };
  });
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Open project', exact: true }).click();
  const chooser = await choosing;
  await chooser.setFiles({ name: 'old.printmap.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) });
  await requestNew(page);
  await page.getByRole('button', { name: 'Start new project' }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('release-old-project')));
  await page.waitForFunction(() => window.newProjectRead.finished);
  expect(await downloadProject(page)).toEqual(blank);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
