import { expect, test, type Page } from '@playwright/test';

async function colorBucketCount(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Screenshot pixel inspection is unavailable.');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const buckets = new Set<string>();
    for (let offset = 0; offset < pixels.length; offset += 64) {
      buckets.add(`${pixels[offset] >> 4},${pixels[offset + 1] >> 4},${pixels[offset + 2] >> 4}`);
    }
    return buckets.size;
  }, png.toString('base64'));
}

test('basemap visibility hides and restores the rendered map beneath content', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleProblems.push(message.text());
  });
  await page.goto('./');
  const map = page.locator('[data-map-ready="true"]');
  const fallback = page.getByText('Map preview unavailable');
  await expect(map.or(fallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await fallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so visibility cannot be exercised.');

  const mapRoot = page.getByTestId('map-canvas');
  const visibleBuckets = await colorBucketCount(page, await mapRoot.screenshot());
  await page.getByRole('button', { name: 'Hide Paper basemap' }).click();
  await expect(mapRoot).toHaveAttribute('data-map-basemap-visible', 'false');
  await expect(mapRoot).toHaveAttribute('data-map-ready', 'true');
  const hiddenBuckets = await colorBucketCount(page, await mapRoot.screenshot());

  expect(hiddenBuckets).toBeLessThan(visibleBuckets);
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ path: 'docs/screenshots/basemap-hidden-20260830.png' });
  }
  await page.getByRole('button', { name: 'Show Paper basemap' }).click();
  await expect(mapRoot).toHaveAttribute('data-map-basemap-visible', 'true');
  await expect(mapRoot).toHaveAttribute('data-map-ready', 'true');
  const restoredBuckets = await colorBucketCount(page, await mapRoot.screenshot());
  expect(restoredBuckets).toBeGreaterThan(hiddenBuckets);
  expect(consoleProblems).toEqual([]);
});
