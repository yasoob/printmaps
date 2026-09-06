import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  downloadProject, expectCoherentCamera, failNextWebGlProbe, loseAnimatingRenderer, loseRenderer,
  mapSnapshot, normalizedViewport, openInstrumentedMap,
} from './map-recovery-support';

test.afterEach(async ({ page }, testInfo) => {
  const errors = await page.evaluate(() => window.recoveryRuntimeErrors ?? []);
  await writeFile(testInfo.outputPath('ux-fix-024-runtime.json'), JSON.stringify({ errors }, null, 2));
  expect(errors).toEqual([]);
});

test('interrupted native Zoom commits one coherent camera step and no-op recovery preserves redo', async ({ page }, testInfo) => {
  await openInstrumentedMap(page);
  const before = await expectCoherentCamera(page);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await page.evaluate(() => {
    const map = window.recoveryAudit.map!;
    const extension = map.getCanvas().getContext('webgl2')!.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('WebGL context loss unavailable');
    const initialZoom = map.getZoom();
    const zoomIn = map.zoomIn;
    map.zoomIn = (options, eventData) => {
      map.zoomIn = zoomIn;
      return zoomIn.call(map, { ...options, duration: 10_000, essential: true }, eventData);
    };
    const interrupt = () => {
      if (map.getZoom() <= initialZoom + 0.0001) return;
      map.off('zoom', interrupt);
      extension.loseContext();
    };
    map.on('zoom', interrupt);
  });
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry map' })).toBeEnabled();
  const loss = await mapSnapshot(page);
  expect(loss.zoom).toBeGreaterThan(before.native.zoom);
  expect(loss.zoom).toBeLessThan(before.native.zoom + 1);
  await page.getByRole('button', { name: 'Retry map' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const recovered = await expectCoherentCamera(page);
  expect(normalizedViewport(recovered.native)).toEqual(normalizedViewport(loss));
  await page.screenshot({ path: testInfo.outputPath('ux-fix-024-coherent-zoom.png') });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled();
  const undone = await expectCoherentCamera(page);
  expect(undone.document).toEqual(before.document);
  await loseRenderer(page);
  await page.getByRole('button', { name: 'Retry map' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  expect(await downloadProject(page)).toEqual(undone.document);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  const redone = await expectCoherentCamera(page);
  expect(redone.document).toEqual(recovered.document);
  await writeFile(testInfo.outputPath('ux-fix-024-coherent-zoom.json'), JSON.stringify({ before, loss, recovered, undone, redone }, null, 2));
});

test('canonical Undo after failed creation supersedes the old capture without consuming redo', async ({ page }, testInfo) => {
  await openInstrumentedMap(page);
  const before = await expectCoherentCamera(page);
  const loss = await loseAnimatingRenderer(page);
  await expect(page.getByRole('button', { name: 'Retry map' })).toBeEnabled();
  await failNextWebGlProbe(page);
  await page.getByRole('button', { name: 'Retry map' }).click();
  await expect(page.getByText('WebGL 2 is unavailable in this browser. Your project can still be edited.')).toBeVisible();
  const captured = await downloadProject(page);
  expect(normalizedViewport(captured.camera)).toEqual(normalizedViewport(loss));
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  expect(await downloadProject(page)).toEqual(before.document);
  await failNextWebGlProbe(page);
  await page.getByRole('button', { name: 'Retry map' }).click();
  await expect(page.getByText('WebGL 2 is unavailable in this browser. Your project can still be edited.')).toBeVisible();
  expect(await downloadProject(page)).toEqual(before.document);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Retry map' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const recovered = await expectCoherentCamera(page);
  expect(recovered.document).toEqual(before.document);
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  const redone = await expectCoherentCamera(page);
  expect(redone.document).toEqual(captured);
  await writeFile(testInfo.outputPath('ux-fix-024-obsolete-camera.json'), JSON.stringify({ before, loss, captured, recovered, redone }, null, 2));
});
