import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const isHeadlessWebGlDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
);

async function downloadFormat(
  page: import('@playwright/test').Page,
  name: string,
  outputPath: string,
) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name }).click();
  const download = await downloadPromise;
  await download.saveAs(outputPath);
  return readFile(outputPath);
}

test('a selected route generates an attributed elevation profile with SVG, PNG, and PDF downloads', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if (
      (message.type() === 'error' || message.type() === 'warning')
      && !isHeadlessWebGlDiagnostic(message.text())
    ) consoleProblems.push(message.text());
  });
  let requestedSamples = 0;
  await page.route('https://api.open-meteo.com/v1/elevation**', async (route) => {
    const requestUrl = new URL(route.request().url());
    requestedSamples = requestUrl.searchParams.get('latitude')?.split(',').length ?? 0;
    await route.fulfill({
      body: JSON.stringify({ elevation: Array.from({ length: requestedSamples }, (_, index) => 160 + index * 3) }),
      contentType: 'application/json',
      status: 200,
    });
  });

  await page.goto('/');
  await expect(page.locator('[data-map-ready="true"]').or(page.getByText('Map preview unavailable'))).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await page.getByRole('button', { name: 'Generate elevation profile' }).click();

  const chart = page.getByRole('img', { name: 'Route 01 elevation profile' });
  await expect(chart).toBeVisible();
  expect(requestedSamples).toBeGreaterThanOrEqual(2);
  expect(requestedSamples).toBeLessThanOrEqual(100);
  await expect(page.getByLabel('Elevation summary')).toContainText('km');
  await expect(page.getByText('Copernicus DEM GLO-90 via Open-Meteo')).toBeVisible();

  await page.getByRole('radio', { name: 'Imperial' }).check();
  await page.getByLabel('Profile curve color').fill('#2457a6');
  await page.getByLabel('Profile fill color').fill('#f2b84b');
  await page.getByLabel('Elevation marker color').fill('#7c3aed');
  await page.getByRole('spinbutton', { name: 'Profile font size' }).fill('71');
  await expect(page.getByRole('button', { name: 'Download elevation SVG' })).toBeDisabled();
  await page.getByRole('spinbutton', { name: 'Profile font size' }).fill('56');
  await expect(page.getByRole('button', { name: 'Download elevation SVG' })).toBeEnabled();
  await page.getByRole('checkbox', { name: 'Horizontal grid' }).uncheck();
  await expect(page.getByLabel('Elevation summary')).toContainText('mi');
  await expect(chart.locator('.elevation-markers circle')).toHaveCount(2);
  await expect(chart.locator('.elevation-marker-label')).toHaveCount(2);
  if (testInfo.project.name === 'chromium') {
    await chart.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'docs/screenshots/latest-desktop.png' });
  }

  const svgBytes = await downloadFormat(page, 'Download elevation SVG', testInfo.outputPath('route-01.elevation.svg'));
  const svg = svgBytes.toString('utf8');
  expect(svg).toContain('data-elevation-profile="true"');
  expect(svg).toContain('Copernicus DEM GLO-90 via Open-Meteo');
  expect(svg).toContain('stroke="#2457a6"');
  expect(svg).toContain('fill="#f2b84b"');
  expect(svg).toContain('data-elevation-markers="true"');
  expect(svg).toContain('fill="#7c3aed"');
  expect(svg).toContain('font-size="56"');
  expect(svg).toContain('data-grid-axis="vertical"');
  expect(svg).not.toContain('data-grid-axis="horizontal"');
  expect(svg).toContain('data-profile-fill="true"');
  expect(svg).toContain(' mi');

  const png = await downloadFormat(page, 'Download elevation PNG', testInfo.outputPath('route-01.elevation.png'));
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.readUInt32BE(16)).toBe(1800);
  expect(png.readUInt32BE(20)).toBe(900);

  const pdf = await downloadFormat(page, 'Download elevation PDF', testInfo.outputPath('route-01.elevation.pdf'));
  const pdfText = pdf.toString('latin1');
  expect(pdfText.startsWith('%PDF-1.7')).toBe(true);
  expect(pdfText).toContain('/MediaBox [0 0 425.19685 212.598425]');
  expect(pdfText).toContain('Copernicus DEM GLO-90 via Open-Meteo');
  expect(pdfText).toContain('0.141176 0.341176 0.65098 RG');
  expect(pdfText).toContain('% profile fill color 0.94902 0.721569 0.294118');
  expect(pdfText).toContain('% elevation markers');
  expect(pdfText).toContain('0.486275 0.227451 0.929412 rg');
  expect(pdfText).toContain('BT /F1 16.8 Tf');
  expect(pdfText).not.toContain('% grid horizontal');
  expect(pdfText).toContain('% profile fill');
  expect(pdfText).toContain(' mi | ascent ');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open properties' }).click();
  await expect(chart).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await expect.poll(() => page.evaluate(() => (
    document.querySelector<SVGElement>('.elevation-chart')?.getBoundingClientRect().right ?? 9999
  ))).toBeLessThanOrEqual(390);

  await page.getByRole('button', { name: 'Close properties' }).click();
  await page.getByRole('button', { name: 'Open layers' }).click();
  await page.getByRole('button', { name: 'Select Coffee stop' }).click();
  await page.getByRole('button', { name: 'Open layers' }).click();
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await page.getByRole('button', { name: 'Open properties' }).click();
  const mobileGenerate = page.getByRole('button', { name: 'Generate elevation profile' });
  await expect(mobileGenerate).toBeVisible();
  await mobileGenerate.click();
  await expect(chart).toBeVisible();
  expect(consoleProblems).toEqual([]);
});
