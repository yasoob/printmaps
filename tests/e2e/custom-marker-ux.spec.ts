import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { ProjectDocument } from '../../src/domain/project';
import { downloadProject, openInstrumentedMap } from './map-recovery-support';
import { openPortable } from './portable-budget-support';

const smallCircleSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#2463eb"/></svg>';

test.beforeEach(() => test.setTimeout(120_000));

test.afterEach(async ({ page }, info) => {
  const errors = await page.evaluate(() => window.recoveryRuntimeErrors ?? []);
  const issue = info.title.match(/UX(\d+)/)?.[1];
  await writeFile(info.outputPath(`ux-fix-${issue}-runtime-errors.json`), JSON.stringify(errors));
  expect(errors).toEqual([]);
});

async function uploadSvg(page: Page, source = smallCircleSvg) {
  await page.getByLabel('Custom marker file', { exact: true }).setInputFiles({
    name: 'marker.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(source),
  });
}

async function saveProject(page: Page, info: TestInfo, name: string): Promise<ProjectDocument> {
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Download project', exact: true }).click();
  const download = await waiting;
  const path = info.outputPath(name + '.printmap.json');
  await download.saveAs(path);
  return JSON.parse(await readFile(path, 'utf8'));
}

async function exportMarker(page: Page, info: TestInfo, format: 'svg' | 'png', name: string) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('radio', { name: format === 'svg' ? /Layered SVG/ : /PNG/ }).click();
  const waiting = page.waitForEvent('download');
  await dialog.getByRole('button', { name: format === 'svg' ? 'Download layered SVG' : 'Download PNG', exact: true }).click();
  const download = await waiting;
  const path = info.outputPath(name + '.' + format);
  await download.saveAs(path);
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close export' }).click();
  return readFile(path);
}

async function nativeMarker(page: Page, assetId: string) {
  return page.evaluate((id) => {
    const map = window.recoveryAudit.map!;
    const image = map.getImage(`studio-marker-${id}`);
    const symbol = map.getStyle().layers.find((layer) => layer.type === 'symbol' && layer.layout?.['icon-image'] === `studio-marker-${id}`);
    return {
      image: image ? { width: image.data.width, height: image.data.height } : null,
      symbol,
    };
  }, assetId);
}

async function markerPixels(page: Page, imageBytes: Buffer, color: number[], mimeType = 'image/png') {
  return page.evaluate(async ({ encoded, rgb, type }) => {
    const image = new Image();
    image.src = `data:${type};base64,${encoded}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, image.width, image.height).data;
    let xMin = image.width, yMin = image.height, xMax = -1, yMax = -1, count = 0;
    for (let offset = 0; offset < data.length; offset += 4) {
      if (Math.abs(data[offset] - rgb[0]) > 2 || Math.abs(data[offset + 1] - rgb[1]) > 2 || Math.abs(data[offset + 2] - rgb[2]) > 2) continue;
      const x = offset / 4 % image.width, y = Math.floor(offset / 4 / image.width);
      xMin = Math.min(xMin, x); xMax = Math.max(xMax, x); yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); count += 1;
    }
    return { count, markerWidth: xMax - xMin + 1, markerHeight: yMax - yMin + 1, width: image.width, height: image.height };
  }, { encoded: imageBytes.toString('base64'), rgb: color, type: mimeType });
}

test('UX046 exact 24-unit SVG uploads, renders natively, survives portable reopen and exports SVG/PNG', async ({ page }, info) => {
  const markerWarnings: string[] = [];
  page.on('console', (message) => { if (message.text().includes('studio-marker-') && message.text().includes('could not be loaded')) markerWarnings.push(message.text()); });
  await openInstrumentedMap(page);
  await page.getByRole('button', { name: 'Select Coffee stop' }).click();
  // Isolate the marker's exported color from other translucent artwork.
  const initial = await downloadProject(page);
  for (const layer of initial.layers) {
    if (layer.geometry && layer.id !== 'poi-cafe' && layer.visible) {
      await page.getByRole('button', { name: `Hide ${layer.name}`, exact: true }).click();
    }
  }
  await expect(page.getByRole('button', { name: 'Upload custom marker' })).toHaveAccessibleDescription(/SVG: scalable/);
  await uploadSvg(page);
  await expect(page.getByRole('status', { name: 'Custom marker status' })).toHaveText('Custom marker · 24 × 24 SVG units · Scalable');
  await page.getByLabel('POI marker size', { exact: true }).fill('48');
  await page.getByLabel('POI marker size', { exact: true }).press('Tab');
  const project = await saveProject(page, info, 'ux-fix-046-original-24');
  const [asset] = Object.values(project.assets);
  expect(Buffer.from(asset.dataUri.split(',', 2)[1], 'base64').toString()).toBe(smallCircleSvg);
  expect(asset).toMatchObject({ width: 24, height: 24, mimeType: 'image/svg+xml' });
  await expect.poll(() => nativeMarker(page, asset.id)).toMatchObject({
    image: { width: 100, height: 100 }, symbol: { layout: { 'icon-size': 0.48 } },
  });
  await page.screenshot({ path: info.outputPath('ux-fix-046-24-native.png') });
  await openPortable(page, project);
  await page.getByRole('button', { name: 'Select Coffee stop' }).click();
  await expect(page.getByRole('status', { name: 'Custom marker status' })).toHaveText('Custom marker · 24 × 24 SVG units · Scalable');
  const reopened = await downloadProject(page);
  expect(reopened.assets).toEqual(project.assets);
  await expect.poll(() => nativeMarker(page, asset.id)).toMatchObject({ image: { width: 100, height: 100 } });
  const svg = await exportMarker(page, info, 'svg', 'ux-fix-046-original-24');
  expect(svg.toString()).toContain(asset.dataUri);
  const svgSize = await page.evaluate((text) => {
    const image = new DOMParser().parseFromString(text, 'image/svg+xml').querySelector(':scope [data-layer-id="poi-cafe"] image[data-poi-custom-marker]')!;
    return { width: Number(image.getAttribute('width')), height: Number(image.getAttribute('height')) };
  }, svg.toString());
  expect(svgSize.width).toBe(svgSize.height);
  expect(svgSize.width).toBeGreaterThan(0);
  const svgPixels = await markerPixels(page, svg, [36, 99, 235], 'image/svg+xml');
  expect(svgPixels.count).toBeGreaterThan(100);
  expect(svgPixels.markerWidth / svgPixels.markerHeight).toBeCloseTo(1, 1);
  const png = await exportMarker(page, info, 'png', 'ux-fix-046-original-24');
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const pixels = await markerPixels(page, png, [36, 99, 235]);
  expect(pixels.count).toBeGreaterThan(100);
  expect(pixels.markerWidth / pixels.markerHeight).toBeCloseTo(1, 1);
  await writeFile(info.outputPath('ux-fix-046-original-24-evidence.json'), JSON.stringify({ asset, native: await nativeMarker(page, asset.id), svgSize, svgPixels, png: pixels, markerWarnings, errors: await page.evaluate(() => window.recoveryRuntimeErrors) }, null, 2));
  expect(markerWarnings).toEqual([]);
  expect(await page.evaluate(() => window.recoveryRuntimeErrors)).toEqual([]);
});

test('UX046 namespace-free replacements are rejected without losing an exportable marker or adding history', async ({ page }, info) => {
  await openInstrumentedMap(page);
  await page.getByRole('button', { name: 'Select Coffee stop' }).click();
  await uploadSvg(page);
  await expect(page.getByRole('status', { name: 'Custom marker status' })).toBeVisible();
  const before = await downloadProject(page);
  for (const replacement of ['', ' xmlns="https://invalid.example/svg"']) {
    await uploadSvg(page, smallCircleSvg.replace(' xmlns="http://www.w3.org/2000/svg"', () => replacement));
    await expect(page.getByRole('alert', { name: 'Custom marker error' })).toContainText('xmlns="http://www.w3.org/2000/svg"');
    expect(await downloadProject(page)).toEqual(before);
  }
  await page.getByRole('alert', { name: 'Custom marker error' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('ux-fix-046-namespace-rejection.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Custom marker status' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(await downloadProject(page)).toEqual(before);
});

test('UX046 fractional non-square vectors preserve source aspect; 99px raster replacement rejects without erasure', async ({ page }, info) => {
  await openInstrumentedMap(page);
  await page.getByRole('button', { name: 'Select Coffee stop' }).click();
  const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 .5 .25"><rect width=".5" height=".25" fill="#ef137d"/></svg>';
  await uploadSvg(page, source);
  await expect(page.getByRole('status', { name: 'Custom marker status' })).toContainText('0.5 × 0.25 SVG units');
  await page.getByLabel('POI marker size', { exact: true }).fill('48'); await page.getByLabel('POI marker size', { exact: true }).press('Tab');
  const project = await saveProject(page, info, 'ux-fix-046-fractional');
  const [asset] = Object.values(project.assets);
  await expect.poll(() => nativeMarker(page, asset.id)).toMatchObject({ image: { width: 100, height: 50 }, symbol: { layout: { 'icon-size': 0.48 } } });
  const smallRaster = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 99; canvas.height = 100;
    return canvas.toDataURL('image/png').split(',', 2)[1];
  });
  await page.getByLabel('Custom marker file', { exact: true }).setInputFiles({ name: '99.png', mimeType: 'image/png', buffer: Buffer.from(smallRaster, 'base64') });
  await expect(page.getByRole('alert', { name: 'Custom marker error' })).toContainText('at least 100 × 100');
  const retained = await downloadProject(page);
  expect(retained.assets).toEqual(project.assets);
  await page.screenshot({ path: info.outputPath('ux-fix-046-raster-rejected-vector-retained.png') });
  await openPortable(page, project);
  const svg = await exportMarker(page, info, 'svg', 'ux-fix-046-fractional');
  const size = await page.evaluate((text) => {
    const image = new DOMParser().parseFromString(text, 'image/svg+xml').querySelector('image[data-poi-custom-marker]')!;
    return [Number(image.getAttribute('width')), Number(image.getAttribute('height'))];
  }, svg.toString());
  expect(size[0] / size[1]).toBe(2);
  const png = await exportMarker(page, info, 'png', 'ux-fix-046-fractional');
  const pixels = await markerPixels(page, png, [239, 19, 125]);
  expect(pixels.count).toBeGreaterThan(100);
  expect(pixels.markerWidth / pixels.markerHeight).toBeCloseTo(2, 1);
  await writeFile(info.outputPath('ux-fix-046-fractional-evidence.json'), JSON.stringify({ source, asset, svgSize: size, png: pixels }, null, 2));
});

test('UX047 disables only overridden controls, retains original style and makes relevant edits undoable on mobile', async ({ page }, info) => {
  await openInstrumentedMap(page);
  await page.getByRole('button', { name: 'Select Coffee stop' }).click();
  await page.getByLabel('POI color', { exact: true }).fill('#123456');
  await page.getByLabel('POI marker shape', { exact: true }).selectOption('diamond');
  await page.getByLabel('POI marker symbol', { exact: true }).selectOption('coffee');
  await uploadSvg(page);
  await expect(page.getByRole('status', { name: 'Custom marker status' })).toBeVisible();
  for (const label of ['POI color', 'POI marker shape', 'POI marker symbol']) {
    await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
    await expect(page.getByLabel(label, { exact: true })).toHaveAccessibleDescription(/Remove it to restore/);
  }
  await page.getByLabel('POI marker size', { exact: true }).fill('48'); await page.getByLabel('POI marker size', { exact: true }).press('Tab');
  await page.getByLabel('POI label', { exact: true }).fill('Custom café'); await page.getByLabel('POI label', { exact: true }).press('Tab');
  await page.getByLabel('Layer opacity', { exact: true }).fill('60'); await page.getByLabel('Layer opacity', { exact: true }).press('Tab');
  const project = await saveProject(page, info, 'ux-fix-047-custom-relevant-edits');
  const appearance = project.layers.find(({ id }) => id === 'poi-cafe')!.appearance;
  expect(appearance).toMatchObject({ color: '#123456', markerShape: 'diamond', markerSymbol: 'coffee', size: 48, label: 'Custom café' });
  const [asset] = Object.values(project.assets);
  await expect.poll(() => nativeMarker(page, asset.id)).toMatchObject({ symbol: { layout: { 'icon-size': 0.48 }, paint: { 'icon-opacity': 0.6 } } });
  const svg = await exportMarker(page, info, 'svg', 'ux-fix-047-custom-style');
  expect(svg.toString()).toContain('Custom café');
  await page.screenshot({ path: info.outputPath('ux-fix-047-disabled-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open properties' }).click();
  await page.locator('.custom-marker-help').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('ux-fix-047-mobile-explanation.png') });
  const remove = page.getByRole('button', { name: 'Remove custom marker' });
  await remove.scrollIntoViewIfNeeded();
  const target = await remove.boundingBox();
  expect(target!.height).toBeGreaterThanOrEqual(44);
  const font = await page.locator('.custom-marker-help').first().evaluate((element) => Number(getComputedStyle(element).fontSize.replace('px', '')));
  expect(font).toBeGreaterThanOrEqual(12);
  await page.screenshot({ path: info.outputPath('ux-fix-047-disabled-mobile.png') });
  await remove.focus(); await remove.press('Enter');
  for (const [label, value] of [['POI color', '#123456'], ['POI marker shape', 'diamond'], ['POI marker symbol', 'coffee']]) {
    await expect(page.getByLabel(label, { exact: true })).toBeEnabled();
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('POI marker shape', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByLabel('POI marker shape', { exact: true })).toBeEnabled();
  await saveProject(page, info, 'ux-fix-047-restored-standard');
  await writeFile(info.outputPath('ux-fix-047-mobile-measurements.json'), JSON.stringify({ target, helpFontPx: font }));
});

test('UX048 a delayed file read cannot attach after selection or project replacement; fresh upload remains usable', async ({ page }, info) => {
  await openInstrumentedMap(page);
  const before = await downloadProject(page);
  for (const transition of ['selection', 'project'] as const) {
    await page.getByRole('button', { name: 'Select Coffee stop', exact: true }).click();
    await page.evaluate(() => {
      const read = File.prototype.arrayBuffer;
      File.prototype.arrayBuffer = async function (this: File) {
        if (this.name === 'delayed-marker.svg') {
          File.prototype.arrayBuffer = read;
          await new Promise<void>((resolve) => { Object.assign(window, { releaseMarkerRead: resolve }); });
        }
        return read.call(this);
      };
    });
    await page.getByLabel('Custom marker file', { exact: true }).setInputFiles({
      name: 'delayed-marker.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(smallCircleSvg),
    });
    await expect(page.getByRole('button', { name: 'Upload custom marker' })).toBeDisabled();
    if (transition === 'selection') {
      await page.getByRole('button', { name: 'Select City center', exact: true }).click();
    } else {
      await openPortable(page, { ...before, title: 'New upload owner' });
      await page.getByRole('button', { name: 'Select Coffee stop', exact: true }).click();
    }
    await page.evaluate(() => (window as unknown as { releaseMarkerRead: () => void }).releaseMarkerRead());
    await expect.poll(async () => {
      const project = await downloadProject(page);
      return Object.keys(project.assets).length;
    }).toBe(0);
    await page.getByRole('button', { name: 'Select Coffee stop', exact: true }).click();
    await uploadSvg(page);
    await expect(page.getByRole('status', { name: 'Custom marker status' })).toBeVisible();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Upload custom marker' })).toBeEnabled();
  }
  await saveProject(page, info, 'ux-fix-048-retired-uploads');
  await page.screenshot({ path: info.outputPath('ux-fix-048-retired-uploads.png') });
});

for (const kind of ['count', 'encoded', 'decoded', 'portable'] as const) {
  test(`UX048 ${kind} rejection is explicit, preserves downloaded state and retries after freeing capacity`, async ({ page }, info) => {
    await openInstrumentedMap(page);
    const fixture = await page.evaluate(async (mode) => {
      const markerPath = '/tests/fixtures/customMarkerCapacity.ts', bytePath = '/tests/fixtures/portableBudget.ts';
      const markers = await import(markerPath), bytes = await import(bytePath);
      return mode === 'portable' ? bytes.byteBudgetProject() : markers.markerCapacityProject(mode);
    }, kind) as ProjectDocument;
    await openPortable(page, fixture);
    const targetId = kind === 'portable' ? 'marker-5' : 'poi-cafe';
    const targetName = kind === 'portable' ? 'Marker 5' : 'Coffee stop';
    await page.getByRole('button', { name: `Select ${targetName}`, exact: true }).click();
    const before = await saveProject(page, info, `ux-fix-048-${kind}-before`);
    const source = await page.evaluate(async ({ mode, document, target }) => {
      const path = '/tests/fixtures/portableBudget.ts';
      const { paddedMarker } = await import(path);
      if (mode === 'encoded') return atob(paddedMarker(99, 400_000).dataUri.split(',', 2)[1]);
      if (mode === 'portable') {
        const layer = document.layers.find(({ id }) => id === target)!;
        if (layer.appearance?.kind !== 'poi' || !layer.appearance.customAssetId) throw new Error('Expected marker');
        const current = document.assets[layer.appearance.customAssetId];
        const bytes = atob(current.dataUri.split(',', 2)[1]).length;
        const next = paddedMarker(5, bytes + 3);
        return atob(next.dataUri.split(',', 2)[1]);
      }
      return null;
    }, { mode: kind, document: before, target: targetId });
    await uploadSvg(page, source ?? smallCircleSvg);
    const message = { count: '64 custom marker assets', encoded: '8 MiB encoded', decoded: 'decoded pixel budget', portable: '10 MB portable limit' }[kind];
    await expect(page.getByRole('alert', { name: 'Custom marker error' })).toContainText(message);
    await expect(page.getByRole('alert', { name: 'Custom marker error' })).toContainText('try again');
    await expect(page.getByRole('button', { name: kind === 'portable' ? 'Replace custom marker' : 'Upload custom marker' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    expect(await saveProject(page, info, `ux-fix-048-${kind}-rejected`)).toEqual(before);
    await page.screenshot({ path: info.outputPath(`ux-fix-048-${kind}-feedback.png`) });
    await page.getByRole('button', { name: 'Select Marker 0', exact: true }).click();
    await page.getByRole('button', { name: 'Remove custom marker' }).click();
    await page.getByRole('button', { name: `Select ${targetName}`, exact: true }).click();
    await uploadSvg(page, source ?? smallCircleSvg);
    await expect(page.getByRole('status', { name: 'Custom marker status' })).toBeVisible();
    await expect(page.getByRole('alert', { name: 'Custom marker error' })).toHaveCount(0);
    const after = await saveProject(page, info, `ux-fix-048-${kind}-retry`);
    expect(after.layers.find(({ id }) => id === targetId)!.appearance).not.toEqual(before.layers.find(({ id }) => id === targetId)!.appearance);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    const undone = await downloadProject(page);
    expect(undone.layers.find(({ id }: { id: string }) => id === targetId)!.appearance).toEqual(before.layers.find(({ id }) => id === targetId)!.appearance);
    const projectBytes = Buffer.byteLength(JSON.stringify(before));
    await writeFile(info.outputPath(`ux-fix-048-${kind}-evidence.json`), JSON.stringify({
      limit: kind, rejection: message, beforeAssetCount: Object.keys(before.assets).length,
      retryAssetCount: Object.keys(after.assets).length,
      encodedBytes: Object.values(before.assets).reduce((sum, asset) => sum + asset.dataUri.length, 0),
      projectBytes, unchangedOnRejection: true, retrySucceeded: true,
    }, null, 2));
  });
}
