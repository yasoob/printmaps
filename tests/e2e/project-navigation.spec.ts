import { expect, test } from '@playwright/test';

test('direct Open and Save actions round-trip the portable project', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Portrait' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save' }).click();
  const download = await downloadPromise;
  const projectPath = testInfo.outputPath('direct-save.printmap.json');
  await download.saveAs(projectPath);
  expect(download.suggestedFilename()).toBe('vienna-field-guide.printmap.json');

  await page.getByRole('button', { name: 'Landscape' }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(projectPath);
  await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
});

test('Open, Save, and Export remain reachable in the mobile header', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const open = page.getByRole('button', { name: 'Open', exact: true });
  const save = page.getByRole('button', { name: 'Save' });
  const importAction = page.getByRole('button', { name: 'Import' });
  const exportAction = page.getByRole('button', { name: 'Export' });
  await expect(open).toBeVisible();
  await expect(save).toBeVisible();
  await expect(importAction).toBeVisible();
  await expect(exportAction).toBeVisible();
  const visibleHeaderItems = [page.locator('.project-title'), open, save, importAction, exportAction];
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
