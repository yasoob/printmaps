import { readFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { initializeCanvas, readPsd, type Layer, type PixelData, type Psd } from 'ag-psd';

initializeCanvas(
  () => { throw new Error('PSD pixel validation does not create canvases.'); },
  (width, height) => ({
    colorSpace: 'srgb',
    data: new Uint8ClampedArray(width * height * 4),
    height,
    width,
  }) as ImageData,
);

function requiredPixelData(data: PixelData | undefined, name: string): PixelData {
  if (!data) throw new Error(`${name} has no decoded pixel data.`);
  return data;
}

function pixelAt(data: PixelData, x: number, y: number): number[] {
  const offset = (y * data.width + x) * 4;
  return [...data.data.subarray(offset, offset + 4)];
}

function layerPixelAt(layer: Layer, x: number, y: number): number[] | null {
  const data = layer.imageData;
  const localX = x - (layer.left ?? 0);
  const localY = y - (layer.top ?? 0);
  if (!data || localX < 0 || localY < 0 || localX >= data.width || localY >= data.height) return null;
  return pixelAt(data, localX, localY);
}

function areOpaqueDifferent(first: number[] | null, second: number[] | null): boolean {
  return first?.[3] === 255
    && second?.[3] === 255
    && first.slice(0, 3).join(',') !== second.slice(0, 3).join(',');
}

function opaqueOverlap(first: Layer, second: Layer): Readonly<{ x: number; y: number }> {
  const left = Math.max(first.left ?? 0, second.left ?? 0);
  const top = Math.max(first.top ?? 0, second.top ?? 0);
  const right = Math.min(first.right ?? 0, second.right ?? 0);
  const bottom = Math.min(first.bottom ?? 0, second.bottom ?? 0);
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const firstPixel = layerPixelAt(first, x, y);
      const secondPixel = layerPixelAt(second, x, y);
      if (areOpaqueDifferent(firstPixel, secondPixel)) return { x, y };
    }
  }
  throw new Error(`No opaque overlap found between ${first.name} and ${second.name}.`);
}

function expectCompositeWinner(psd: Psd, topName: string, lowerName: string): void {
  const topLayer = psd.children?.find(({ name }) => name === topName);
  const lowerLayer = psd.children?.find(({ name }) => name === lowerName);
  if (!topLayer || !lowerLayer) throw new Error('Expected overlapping PSD layers.');
  const point = opaqueOverlap(topLayer, lowerLayer);
  const topPixel = layerPixelAt(topLayer, point.x, point.y);
  const lowerPixel = layerPixelAt(lowerLayer, point.x, point.y);
  const composite = requiredPixelData(psd.imageData, 'PSD composite');
  expect(topPixel).not.toBeNull();
  expect(topPixel?.slice(0, 3)).not.toEqual(lowerPixel?.slice(0, 3));
  expect(pixelAt(composite, point.x, point.y).slice(0, 3)).toEqual(topPixel?.slice(0, 3));
}

function expectOpacityComposite(previous: Psd, current: Psd, options: Readonly<{
  layerName: string;
  opacity: number;
  overlapName: string;
}>): void {
  const { layerName, opacity, overlapName } = options;
  const layer = current.children?.find(({ name }) => name === layerName);
  const overlap = current.children?.find(({ name }) => name === overlapName);
  if (!layer || !overlap) throw new Error('Expected overlapping PSD layers.');
  const point = opaqueOverlap(layer, overlap);
  const layerPixel = layerPixelAt(layer, point.x, point.y);
  if (!layerPixel) throw new Error(`${layerName} has no overlap pixel.`);
  const previousPixel = pixelAt(requiredPixelData(previous.imageData, 'Previous composite'), point.x, point.y);
  const currentPixel = pixelAt(requiredPixelData(current.imageData, 'Current composite'), point.x, point.y);
  expect(currentPixel.slice(0, 3)).not.toEqual(previousPixel.slice(0, 3));
  for (let channel = 0; channel < 3; channel += 1) {
    const expected = Math.round((layerPixel[channel] ?? 0) * opacity + (previousPixel[channel] ?? 0) * (1 - opacity));
    expect(Math.abs((currentPixel[channel] ?? 0) - expected)).toBeLessThanOrEqual(1);
  }
}

function readValidatedPsd(bytes: Buffer): Psd {
  return readPsd(bytes, {
    skipThumbnail: true,
    throwForMissingFeatures: true,
    useImageData: true,
  });
}

async function downloadPsd(page: Page, testInfo: TestInfo, outputName: string): Promise<Readonly<{
  dialog: ReturnType<Page['getByRole']>;
  psd: Psd;
}>> {
  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('radio', { name: /Layered PSD/ }).click();
  await expect(dialog).toContainText('300 × 300 px — 300 DPI');
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download layered PSD' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('vienna-field-guide.layered.psd');
  const outputPath = testInfo.outputPath(outputName);
  await download.saveAs(outputPath);
  await expect(dialog.getByRole('status')).toContainText('Download started for layered PSD');
  return { dialog, psd: readValidatedPsd(await readFile(outputPath)) };
}

function expectSmartObjectStructure(psd: Psd, expectedStorageOrder: string[]): void {
  expect(psd).toMatchObject({ width: 300, height: 300 });
  expect(psd.children?.map(({ name }) => name)).toEqual(expectedStorageOrder);
  const smartObjectLayers = psd.children?.filter(({ placedLayer }) => placedLayer) ?? [];
  expect(smartObjectLayers).toHaveLength(4);
  expect(smartObjectLayers.every(({ bottom, left, placedLayer, right, top }) => (
    (bottom ?? 0) > (top ?? 0)
    && (right ?? 0) > (left ?? 0)
    && placedLayer?.type === 'vector'
    && placedLayer.transform.join(',') === '0,0,300,0,300,300,0,300'
    && placedLayer.id !== placedLayer.placed
  ))).toBe(true);
  expect(psd.children?.find(({ name }) => name === 'Paper basemap')?.placedLayer).toBeUndefined();
  expect(psd.linkedFiles).toHaveLength(4);
  expect(psd.linkedFiles?.every(({ data, id, name, type }) => (
    type === undefined
    && name.endsWith('.svg')
    && data
    && new TextDecoder().decode(data).startsWith('<svg')
    && smartObjectLayers.some(({ placedLayer }) => placedLayer?.id === id)
  ))).toBe(true);
  expect(psd.imageResources?.resolutionInfo).toMatchObject({
    horizontalResolution: 300,
    horizontalResolutionUnit: 'PPI',
    verticalResolution: 300,
    verticalResolutionUnit: 'PPI',
  });
}

test('layered PSD respects editor order for real route and point overlaps', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.goto('./');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so export cannot be exercised.');

  for (const name of ['Page width', 'Page height']) {
    const field = page.getByRole('spinbutton', { name });
    await field.fill('25.4');
    await field.press('Tab');
  }

  const routeTop = await downloadPsd(page, testInfo, 'route-over-point.psd');
  expectSmartObjectStructure(routeTop.psd, [
    'Paper basemap',
    'City center',
    'Coffee stop',
    'Route 01',
    'Attribution',
  ]);
  expectCompositeWinner(routeTop.psd, 'Route 01', 'Coffee stop');
  const svgByFilename = new Map(routeTop.psd.linkedFiles?.map(({ data, name }) => [
    name,
    new TextDecoder().decode(data ?? new Uint8Array()),
  ]));
  expect(svgByFilename.get('001-route-01.svg')).toContain('<path');
  expect(svgByFilename.get('002-coffee-stop.svg')).toContain('<circle');
  expect(svgByFilename.get('003-city-center.svg')).toContain('<path');
  expect(svgByFilename.get('004-attribution.svg')).toContain('<text');
  await routeTop.dialog.getByRole('button', { name: 'Cancel' }).click();

  const coffeeHandle = page.getByRole('button', { name: 'Reorder Coffee stop' });
  await coffeeHandle.press('Alt+ArrowUp');
  await expect(page.getByRole('list', { name: 'Map layers' }).getByRole('listitem').first()).toContainText('Coffee stop');

  const pointTop = await downloadPsd(page, testInfo, 'point-over-route.psd');
  expectSmartObjectStructure(pointTop.psd, [
    'Paper basemap',
    'City center',
    'Route 01',
    'Coffee stop',
    'Attribution',
  ]);
  expectCompositeWinner(pointTop.psd, 'Coffee stop', 'Route 01');
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ path: 'docs/screenshots/layered-psd-export-20260830.png' });
  }
  await pointTop.dialog.getByRole('button', { name: 'Cancel' }).click();

  const cityHandle = page.getByRole('button', { name: 'Reorder City center' });
  await cityHandle.press('Alt+ArrowUp');
  await cityHandle.press('Alt+ArrowUp');
  await expect(page.getByRole('list', { name: 'Map layers' }).getByRole('listitem').first()).toContainText('City center');

  const shapeTop = await downloadPsd(page, testInfo, 'shape-over-point-and-route.psd');
  expectSmartObjectStructure(shapeTop.psd, [
    'Paper basemap',
    'Route 01',
    'Coffee stop',
    'City center',
    'Attribution',
  ]);
  expectOpacityComposite(pointTop.psd, shapeTop.psd, {
    layerName: 'City center',
    opacity: 0.28,
    overlapName: 'Route 01',
  });
});
