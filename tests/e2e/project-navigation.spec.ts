import { expect, test } from '@playwright/test';

test('Project menu actions round-trip the portable project', async ({ page }, testInfo) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Portrait' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Download project' }).click();
  const download = await downloadPromise;
  const projectPath = testInfo.outputPath('direct-save.printmap.json');
  await download.saveAs(projectPath);
  expect(download.suggestedFilename()).toBe('vienna-field-guide.printmap.json');

  await page.getByRole('button', { name: 'Landscape' }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Open project' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(projectPath);
  await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
});

test('Project actions and Export remain reachable in the mobile header', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  const project = page.getByRole('button', { name: 'Project' });
  const exportAction = page.getByRole('button', { name: 'Export' });
  await expect(project).toBeVisible();
  await expect(exportAction).toBeVisible();
  await project.click();
  const menu = page.getByRole('menu', { name: 'Project actions' });
  const items = menu.getByRole('menuitem');
  await expect(items).toHaveCount(3);
  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.x).toBeGreaterThanOrEqual(8);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(382);
  const menuItems = await items.all();
  for (const item of menuItems) {
    const itemBox = await item.boundingBox();
    expect(itemBox).not.toBeNull();
    expect(itemBox!.height).toBeGreaterThanOrEqual(44);
  }
  await page.keyboard.press('Escape');
  const visibleHeaderItems = [page.locator('.project-title'), project, exportAction];
  const itemBoxes = await Promise.all(visibleHeaderItems.map(async (item) => (
    await item.isVisible() ? item.boundingBox() : null
  )));
  const boxes = itemBoxes.filter((box) => box !== null);
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index - 1].x + boxes[index - 1].width).toBeLessThanOrEqual(boxes[index].x + 1);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
