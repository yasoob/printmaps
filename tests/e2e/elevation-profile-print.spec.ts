import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { profilePngChunks, profilePngCrc } from '../fixtures/profilePng';

async function inspectSvg(page: Page, svg: string) {
  return page.evaluate(async (source) => {
    document.querySelector('#elevation-print-probe')?.remove();
    const frame = document.createElement('iframe');
    frame.id = 'elevation-print-probe';
    Object.assign(frame.style, { position: 'fixed', left: '0', top: '0', width: '900px', height: '450px', border: '0', zIndex: '10000', background: 'white' });
    document.body.append(frame);
    const target = frame.contentDocument!;
    target.body.style.margin = '0';
    target.body.innerHTML = source;
    const chart = target.querySelector('svg')!;
    Object.assign(chart.style, { display: 'block', width: '900px', height: '450px' });
    await target.fonts.ready;
    return [...chart.querySelectorAll<SVGGraphicsElement>('[data-profile-text]')].map((node) => {
      const rect = node.getBBox();
      const role = node.dataset.profileText;
      const outline = role === 'marker' ? 2 : 0;
      return {
        role, text: node.textContent, font: frame.contentWindow!.getComputedStyle(node).fontFamily,
        weight: frame.contentWindow!.getComputedStyle(node).fontWeight,
        x: rect.x - outline, y: rect.y - outline, width: rect.width + outline * 2, height: rect.height + outline * 2,
      };
    });
  }, svg);
}

test('UX042 broad glyph bounds honor bold text and inherited fallback fonts without clipping', async ({ page }, info) => {
      await page.goto('./');
      const cases = await page.evaluate(async () => {
        const exportPath = '/src/export/elevationProfile.ts';
        const fixturePath = '/tests/fixtures/elevationProfile.ts';
        const metricsPath = '/src/export/elevationProfileFontMetrics.ts';
        const { serializeElevationProfileSvg } = await import(exportPath);
        const { printProfile } = await import(fixturePath);
        const { measuredProfileTextWidth } = await import(metricsPath);
        if (measuredProfileTextWidth('H', 'serif', 600) === undefined) throw new Error('Native font measurement is unavailable.');
        const patterns = {
          H: 'H'.repeat(200),
          capitals: 'ABCDEFGHKNOPQRSTUVWXYZ'.repeat(10).slice(0, 200),
          lowercase: 'mw'.repeat(100),
          accents: 'HÓMWGÆQÖÐŴĄ'.repeat(20).slice(0, 200),
          unicode: '山界ΩЖÅÉ'.repeat(34).slice(0, 200),
          ligature: '﷽'.repeat(200),
        };
        const fallbacks = {
          serif: '"Unavailable Profile Font", "Times New Roman", serif',
          sans: '"Unavailable Profile Font", Arial, sans-serif',
          mono: '"Unavailable Profile Font", Menlo, monospace',
        };
        const choices = ['serif', 'sans', 'mono'].flatMap((fontFamily) => ['title', 'source'].flatMap((role) => [false, true].map((inherited) => ({ fontFamily, role, inherited }))));
        return choices.flatMap(({ fontFamily, role, inherited }) => Object.entries(patterns).map(([pattern, text]) => {
          const title = role === 'title' ? text : 'Broad attribution';
          const profile = role === 'source' ? { ...printProfile, sourceLabel: text } : printProfile;
          let svg = serializeElevationProfileSvg(profile, title, { fontFamily, fontSize: 70 });
          if (inherited) {
            const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
            const root = document.querySelector('svg')!;
            root.setAttribute('font-family', fallbacks[fontFamily as keyof typeof fallbacks]);
            root.setAttribute('font-weight', '600');
            for (const node of root.querySelectorAll<SVGElement>('[data-profile-text]')) {
              node.removeAttribute('font-family');
              if (node.dataset.profileText === 'title' || node.dataset.profileText === 'marker') node.removeAttribute('font-weight');
            }
            svg = new XMLSerializer().serializeToString(root);
          }
          return { name: `${fontFamily}-${role}-${pattern}-${inherited ? 'inherited' : 'native'}`, role, text, svg };
        }));
      });
      const measured = [];
      for (const entry of cases) {
        const boxes = await inspectSvg(page, entry.svg);
        measured.push({ name: entry.name, role: entry.role, originalText: entry.text, boxes });
        await writeFile(info.outputPath(`ux-fix-042-broad-${entry.name}.svg`), entry.svg);
        if (entry.name === 'serif-title-H-native') {
          await page.locator('#elevation-print-probe').screenshot({ path: info.outputPath('ux-fix-042-broad-serif-H.png') });
        }
      }
      await writeFile(info.outputPath('ux-fix-042-broad-glyphs.json'), JSON.stringify(measured, null, 2));
      expect(measured).toHaveLength(72);
      for (const entry of measured) {
        assertTextBounds(entry.boxes);
        expect(entry.boxes.filter((box) => box.role === entry.role).map((box) => box.text).join('')).toBe(entry.originalText);
      }
});

function assertTextBounds(boxes: Awaited<ReturnType<typeof inspectSvg>>) {
  for (const [index, box] of boxes.entries()) {
    expect(box.x, `${box.role}: ${box.text}`).toBeGreaterThanOrEqual(-0.1);
    expect(box.y, `${box.role}: ${box.text}`).toBeGreaterThanOrEqual(-0.1);
    expect(box.x + box.width, `${box.role}: ${box.text}`).toBeLessThanOrEqual(900.1);
    expect(box.y + box.height, `${box.role}: ${box.text}`).toBeLessThanOrEqual(450.1);
    const remaining = boxes.slice(index + 1);
    for (const other of remaining) {
      const width = Math.min(box.x + box.width, other.x + other.width) - Math.max(box.x, other.x);
      const height = Math.min(box.y + box.height, other.y + other.height) - Math.max(box.y, other.y);
      expect(width > 0.1 && height > 0.1, `${box.role} "${box.text}" overlaps ${other.role} "${other.text}"`).toBe(false);
    }
  }
}

async function download(page: Page, info: TestInfo, format: string, filename: string) {
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: `Download elevation ${format}`, exact: true }).click();
  const result = await waiting;
  await result.saveAs(info.outputPath(filename));
  return readFile(info.outputPath(filename));
}

test('UX042 original Serif 60 output is collision-free and the preview is the complete exported scene', async ({ page }, info) => {
  await page.route('https://api.open-meteo.com/v1/elevation**', async (route) => {
    const count = new URL(route.request().url()).searchParams.get('latitude')!.split(',').length;
    await route.fulfill({ json: { elevation: Array.from({ length: count }, (_, index) => 150 + index * 10) } });
  });
  await page.goto('./');
  await expect(page.locator('[data-map-ready="true"]').or(page.getByText('Map preview unavailable'))).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Select Route 01', exact: true }).click();
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  await page.getByRole('button', { name: 'Generate elevation profile', exact: true }).click();
  await page.getByRole('radio', { name: 'Imperial' }).check();
  await page.getByLabel('Profile font', { exact: true }).selectOption('serif');
  await page.getByLabel('Profile font size', { exact: true }).fill('60');
  await page.getByLabel('Profile print width', { exact: true }).fill('220');
  const chart = page.getByRole('img', { name: 'Route 01 elevation profile', exact: true });
  await page.locator('.elevation-settings').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('ux-fix-042-original-settings.png'), animations: 'disabled' });
  await chart.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('ux-fix-042-original-preview.png'), animations: 'disabled' });
  const svgBytes = await download(page, info, 'SVG', 'ux-fix-042-original.svg');
  const svg = svgBytes.toString('utf8');
  await download(page, info, 'PNG', 'ux-fix-045-original-220mm.png');
  const pdfBytes = await download(page, info, 'PDF', 'ux-fix-042-pdf-regression-220mm.pdf');
  const pdf = pdfBytes.toString('latin1');
  expect(pdf).toContain('/MediaBox [0 0 623.622047 311.811024]');
  expect(pdf).toContain('/BaseFont /Times-Roman');
  expect(pdf).toContain('BT /F1 18 Tf');
  expect(await page.evaluate((output) => {
    const preview = document.querySelector('svg.elevation-chart')!;
    const id = preview.getAttribute('aria-labelledby')!.replace(/-title$/, '');
    const expected = document.createElement('div');
    expected.innerHTML = output;
    return preview.outerHTML.replaceAll(id, 'elevation-profile') === expected.querySelector('svg')!.outerHTML;
  }, svg)).toBe(true);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('button', { name: 'Open properties', exact: true }).click();
  await chart.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await chart.evaluate((element) => element.getBoundingClientRect().right)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: info.outputPath('ux-fix-042-mobile-preview.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 900 });
  const boxes = await inspectSvg(page, svg);
  assertTextBounds(boxes);
  await writeFile(info.outputPath('ux-fix-042-original-bounds.json'), JSON.stringify(boxes, null, 2));
  await page.locator('#elevation-print-probe').screenshot({ path: info.outputPath('ux-fix-042-original-print.png') });
});

test('UX042 actual SVG glyph bounds cover font, units, large negative terrain and long-title stress cases', async ({ page }, info) => {
  await page.goto('./');
  const cases = await page.evaluate(async () => {
    const exportPath = '/src/export/elevationProfile.ts';
    const fixturePath = '/tests/fixtures/elevationProfile.ts';
    const { serializeElevationProfileSvg } = await import(exportPath);
    const { printProfile, stressPrintProfile } = await import(fixturePath);
    const entries: { name: string; svg: string }[] = [];
    const choices = ['sans', 'serif', 'mono'].flatMap((fontFamily) => ['metric', 'imperial'].flatMap((units) => [20, 40, 60, 70].map((fontSize) => ({ fontFamily, units, fontSize }))));
    for (const options of choices) {
      for (const [kind, profile] of [['ordinary', printProfile], ['extreme', stressPrintProfile()]]) {
        entries.push({ name: `${options.fontFamily}-${options.units}-${options.fontSize}-${kind}`, svg: serializeElevationProfileSvg(profile, 'Alpine route', options) });
      }
    }
    for (const fontFamily of ['sans', 'serif', 'mono']) {
      entries.push({ name: `${fontFamily}-long-title`, svg: serializeElevationProfileSvg(stressPrintProfile(), '山'.repeat(200), { fontFamily, units: 'imperial', fontSize: 70 }) });
    }
    return entries;
  });
  const results = [];
  for (const entry of cases) {
    const boxes = await inspectSvg(page, entry.svg);
    assertTextBounds(boxes);
    results.push({ name: entry.name, boxes });
    await writeFile(info.outputPath(`ux-fix-042-${entry.name}.svg`), entry.svg);
    if (['mono-imperial-70-extreme', 'serif-long-title'].includes(entry.name)) {
      await page.locator('#elevation-print-probe').screenshot({ path: info.outputPath(`ux-fix-042-${entry.name}.png`) });
    }
  }
  expect(results).toHaveLength(51);
  await writeFile(info.outputPath('ux-fix-042-stress-bounds.json'), JSON.stringify(results, null, 2));
});

test('UX045 native PNG output encodes exact selected millimetres and preserves the SVG raster data', async ({ page }, info) => {
  await page.goto('./');
  const results = [];
  for (const widthMm of [50, 220, 300]) {
    const output = await page.evaluate(async (printWidthMm) => {
      const exportPath = '/src/export/elevationProfile.ts';
      const rasterPath = '/src/export/rasterizeElevationProfile.ts';
      const fixturePath = '/tests/fixtures/elevationProfile.ts';
      const { createElevationProfilePng, serializeElevationProfileSvg } = await import(exportPath);
      const { rasterizeElevationProfile } = await import(rasterPath);
      const { stressPrintProfile } = await import(fixturePath);
      const profile = stressPrintProfile();
      const options = { printWidthMm, units: 'imperial', fontFamily: 'serif', fontSize: 60 };
      const svg = serializeElevationProfileSvg(profile, 'Physical print profile', options);
      let raw!: Blob;
      let rasterSource = '';
      const png = await createElevationProfilePng(profile, 'Physical print profile', {
        ...options,
        rasterize: async (source: string, width: number, height: number) => {
          rasterSource = source;
          raw = await rasterizeElevationProfile(source, width, height);
          return raw;
        },
      });
      return { svg, sameSvg: svg === rasterSource, raw: [...new Uint8Array(await raw.arrayBuffer())], png: [...new Uint8Array(await png.arrayBuffer())] };
    }, widthMm);
    expect(output.sameSvg).toBe(true);
    const bytes = Uint8Array.from(output.png);
    const chunks = profilePngChunks(bytes);
    expect(chunks.slice(0, 2).map((chunk) => chunk.type)).toEqual(['IHDR', 'pHYs']);
    expect(chunks.filter((chunk) => chunk.type === 'pHYs')).toHaveLength(1);
    const header = new DataView(chunks[0].data.buffer, chunks[0].data.byteOffset);
    const density = new DataView(chunks[1].data.buffer, chunks[1].data.byteOffset);
    expect(header.getUint32(0)).toBe(widthMm * 12);
    expect(header.getUint32(4)).toBe(widthMm * 6);
    expect(density.getUint32(0)).toBe(12_000);
    expect(density.getUint32(4)).toBe(12_000);
    expect(density.getUint8(8)).toBe(1);
    expect(header.getUint32(0) / density.getUint32(0) * 1000).toBe(widthMm);
    for (const chunk of chunks) expect(profilePngCrc(chunk.raw.subarray(4, -4))).toBe(chunk.crc);
    const original = profilePngChunks(Uint8Array.from(output.raw));
    expect(chunks.filter((chunk) => chunk.type === 'IDAT')).toEqual(original.filter((chunk) => chunk.type === 'IDAT'));
    await writeFile(info.outputPath(`ux-fix-045-${widthMm}mm.png`), bytes);
    await writeFile(info.outputPath(`ux-fix-045-${widthMm}mm-raw.png`), Uint8Array.from(output.raw));
    await writeFile(info.outputPath(`ux-fix-042-${widthMm}mm-raster-source.svg`), output.svg);
    results.push({
      widthMm, widthPx: header.getUint32(0), heightPx: header.getUint32(4),
      physicalWidthMm: header.getUint32(0) / density.getUint32(0) * 1000,
      physicalHeightMm: header.getUint32(4) / density.getUint32(4) * 1000,
      pixelsPerMetreX: density.getUint32(0), pixelsPerMetreY: density.getUint32(4),
      dpi: density.getUint32(0) * 0.0254, unit: density.getUint8(8),
      pHYsCount: chunks.filter((chunk) => chunk.type === 'pHYs').length, pHYsIndex: chunks.findIndex((chunk) => chunk.type === 'pHYs'),
      idatUnchanged: true, allChunkCrcsValid: true,
    });
  }
  await writeFile(info.outputPath('ux-fix-045-native-metadata.json'), JSON.stringify(results, null, 2));
});
