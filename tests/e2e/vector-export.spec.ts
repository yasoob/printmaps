import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument, PDFName } from 'pdf-lib';

async function vectorDownload(page: Page, format: 'svg' | 'pdf') {
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('radio', { name: format === 'svg' ? /Layered SVG/ : /^PDF/ }).click();
  await dialog.getByLabel('Basemap rendering').selectOption('vector');
  const result = page.waitForEvent('download');
  await dialog.getByRole('button', { name: format === 'svg' ? 'Download layered SVG' : 'Download PDF' }).click();
  const error = async () => {
    await dialog.getByRole('alert').waitFor({ state: 'visible', timeout: 45_000 });
    throw new Error(await dialog.getByRole('alert').textContent() ?? 'Vector export failed');
  };
  return Promise.race([
    result,
    error(),
  ]);
}

test('Paper exports real vector basemap paths and editable reflowed labels in SVG and PDF', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto('./');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 40_000 });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const svgDownload = await vectorDownload(page, 'svg');
  const svgPath = testInfo.outputPath('paper-vector.svg');
  await svgDownload.saveAs(svgPath);
  const svg = await readFile(svgPath, 'utf8');
  expect(svg).toContain('data-basemap-content="vector"');
  expect(svg).not.toContain('<image');
  expect(svg.match(/data-map-style-layer=/g)!.length).toBeGreaterThan(10);
  expect(svg.match(/<path /g)!.length).toBeGreaterThan(100);
  expect(svg.match(/<text /g)!.length).toBeGreaterThan(5);
  expect(svg).toContain('data:font/woff;base64,');
  const pdfDownload = await vectorDownload(page, 'pdf');
  const pdfPath = testInfo.outputPath('paper-vector.pdf');
  await pdfDownload.saveAs(pdfPath);
  const pdf = await PDFDocument.load(await readFile(pdfPath));
  const objects = pdf.context.enumerateIndirectObjects();
  expect(objects.some(([, object]) => 'dict' in object && (object.dict as { get: (name: PDFName) => unknown }).get(PDFName.of('Subtype')) === PDFName.of('Image'))).toBe(false);
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(297 / 25.4 * 72, 4);
  await page.setContent(svg);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('paper-vector-preview.png') });
  await testInfo.attach('Vector SVG', { path: svgPath, contentType: 'image/svg+xml' });
  await testInfo.attach('Vector PDF', { path: pdfPath, contentType: 'application/pdf' });
});
