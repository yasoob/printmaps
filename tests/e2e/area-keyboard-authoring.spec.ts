import { writeFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function tabTo(page: Page, target: Locator) {
  for (let index = 0; index < 100; index += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Could not reach ${await target.getAttribute('aria-label')} using Tab.`);
}

async function enterPoint(page: Page, longitude: string, latitude: string) {
  await tabTo(page, page.getByRole('textbox', { name: 'New area point longitude' }));
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(longitude);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'New area point latitude' })).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(latitude);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'New area point longitude' })).toBeFocused();
}

async function startKeyboardArea(page: Page) {
  await page.keyboard.press('s');
  await tabTo(page, page.getByRole('tab', { name: 'Find administrative area' }));
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Draw custom area' })).toBeFocused();
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 320, height: 568 },
]) {
  test(`custom areas can be created and corrected without a pointer at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    const map = page.getByTestId('map-canvas');
    await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
    const originalMap = await map.boundingBox();
    const originalFrame = await page.locator('.print-frame').boundingBox();
    const originalGeometry = await map.getAttribute('data-map-layer-geometry');
    const errors: string[] = [];
    page.on('pageerror', (error) => { errors.push(error.message); });
    await startKeyboardArea(page);
    const panel = page.locator('.shape-authoring-panel');
    const status = page.getByRole('status', { name: 'Area drawing status' });
    await expect(panel).toHaveAttribute('data-settings-expanded', 'true');

    await enterPoint(page, '181', '48.2');
    await expect(page.getByRole('alert')).toContainText('Longitude must be between -180 and 180.');
    await expect(status).toHaveText('0 vertices');
    await enterPoint(page, '16.35', '48.2');
    await enterPoint(page, '16.38', '48.2');
    await expect(status).toHaveText('2 vertices');
    await expect(panel).toHaveAttribute('data-settings-expanded', 'true');
    await expect(page.getByRole('button', { name: 'Finish area', exact: true })).toBeDisabled();
    await enterPoint(page, '16.38', '48.2');
    await expect(status).toHaveText('2 vertices');
    await expect(page.getByRole('alert')).toContainText('That area point is already present.');

    await tabTo(page, page.getByRole('button', { name: 'Hide area settings' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Show area settings' })).toBeFocused();
    await expect(page.getByRole('alert')).toBeVisible();
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('textbox', { name: 'New area point longitude' })).toHaveValue('16.38');
    await tabTo(page, page.getByRole('tab', { name: 'Draw custom area' }));
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('textbox', { name: 'New area point longitude' })).toHaveValue('16.38');

    await tabTo(page, page.getByRole('textbox', { name: 'New area point longitude' }));
    await page.keyboard.press('Escape');
    await expect(map).toHaveAttribute('data-interaction-mode', 'shape');
    await tabTo(page, page.getByRole('button', { name: 'Add area point', exact: true }));
    await page.keyboard.press('Escape');
    await expect(map).toHaveAttribute('data-interaction-mode', 'select');
    await page.keyboard.press('s');
    if (viewport.width < 900) {
      await tabTo(page, page.getByRole('button', { name: 'Show area settings' }));
      await page.keyboard.press('Enter');
    }
    await expect(status).toHaveText('2 vertices');
    await enterPoint(page, '16.38', '48.22');
    await expect(status).toHaveText('3 vertices');
    await expect(panel).toHaveAttribute('data-settings-expanded', 'true');
    await tabTo(page, page.locator('.maplibregl-canvas'));
    await page.keyboard.press('Backspace');
    await expect(status).toHaveText('2 vertices');
    await expect(page.getByRole('textbox', { name: 'New area point latitude' })).toHaveValue('48.22');
    await tabTo(page, page.getByRole('button', { name: 'Add area point', exact: true }));
    await page.keyboard.press('Enter');
    await expect(status).toHaveText('3 vertices');
    await expect(panel).toHaveAttribute('data-settings-expanded', 'true');
    expect(await map.boundingBox()).toEqual(originalMap);
    expect(await page.locator('.print-frame').boundingBox()).toEqual(originalFrame);
    const contentBox = await panel.locator('.shape-drawing-content').boundingBox();
    const actionBox = await panel.locator('.tool-card-actions').boundingBox();
    expect(contentBox!.y + contentBox!.height).toBeLessThanOrEqual(actionBox!.y);
    await page.screenshot({ path: testInfo.outputPath(`ux-fix-013-keyboard-draft-${viewport.width}.png`) });

    await tabTo(page, page.getByRole('button', { name: 'Finish area', exact: true }));
    await page.keyboard.press('Enter');
    await expect(map).toHaveAttribute('data-selected-layer', 'shape-01');
    const finishedGeometry = await map.getAttribute('data-map-layer-geometry');
    expect(finishedGeometry).toContain('[[[16.35,48.2],[16.38,48.2],[16.38,48.22],[16.35,48.2]]]');
    await expect(page.getByRole('button', { name: 'Select (V)' })).toBeFocused();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(map).not.toHaveAttribute('data-map-layer-order', /shape-01/);
    await expect(map).toHaveAttribute('data-map-layer-geometry', originalGeometry!);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(map).toHaveAttribute('data-map-layer-order', /shape-01/);
    await page.screenshot({ path: testInfo.outputPath(`ux-fix-013-keyboard-finished-${viewport.width}.png`) });
    await writeFile(testInfo.outputPath(`ux-fix-013-keyboard-${viewport.width}.json`), JSON.stringify({
      viewport, finishedGeometry, originalMap, originalFrame, errors,
      pointerActions: 0, preservedAcrossSettingsAndSources: true, undoRedo: true, compactValidationVisible: true,
    }, null, 2));
    expect(errors).toEqual([]);
  });
}

test('area shortcuts do not escape menus or dialogs and explicit Cancel discards only the draft', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const map = page.getByTestId('map-canvas');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const committedGeometry = await map.getAttribute('data-map-layer-geometry');
  await startKeyboardArea(page);
  await enterPoint(page, '16.35', '48.2');
  await enterPoint(page, '16.38', '48.2');
  await enterPoint(page, '16.38', '48.22');
  const geometry = await map.getAttribute('data-map-layer-geometry');
  await tabTo(page, page.getByRole('button', { name: 'Project', exact: true }));
  await page.keyboard.press('Enter');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Escape');
  await expect(map).toHaveAttribute('data-interaction-mode', 'shape');
  await expect(page.getByRole('status', { name: 'Area drawing status' })).toHaveText('3 vertices');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Rename project' }).click();
  const close = page.getByRole('dialog', { name: 'Rename project' }).getByRole('button', { name: 'Cancel' });
  await close.focus();
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Enter');
  await expect(map).toHaveAttribute('data-interaction-mode', 'shape');
  await expect(map).toHaveAttribute('data-map-layer-geometry', geometry!);
  await tabTo(page, page.locator('.maplibregl-canvas'));
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await expect(page.getByRole('status', { name: 'Area drawing status' })).toHaveText('3 vertices');
  await tabTo(page, page.getByRole('button', { name: 'Show area settings' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: 'Cancel area' }));
  await page.keyboard.press('Enter');
  await expect(map).toHaveAttribute('data-interaction-mode', 'select');
  await page.keyboard.press('s');
  await expect(page.getByRole('status', { name: 'Area drawing status' })).toHaveText('0 vertices');
  await expect(map).toHaveAttribute('data-map-layer-geometry', committedGeometry!);
  await tabTo(page, page.getByRole('button', { name: 'Project', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Undo', exact: true })).toBeDisabled();
});
