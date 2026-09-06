import {
  MAX_CUSTOM_MARKER_BYTES,
  assertCustomMarkerDimensions,
  customMarkerRasterDimensions,
  sha256Hex,
  validateCustomMarkerAssetCollection,
  validateCustomMarkerFile,
  validateStoredCustomMarkerAsset,
} from '../../src/domain/customMarkerAssets';

function svgFile(source: string, name = 'marker.svg', type = 'image/svg+xml') {
  return new File([source], name, { type });
}

function pngFile(width: number, height: number) {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes.set([8, 6, 0, 0, 0], 24);
  return new File([bytes], 'marker.png', { type: 'image/png' });
}

describe('custom POI marker assets', () => {
  it('computes the canonical SHA-256 content identity synchronously', () => {
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('accepts a safe 100px SVG and returns deterministic hash-owned canonical data', async () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><path fill="#123456" d="M50 0L100 120H0Z"/></svg>';

    const first = await validateCustomMarkerFile(svgFile(source));
    const second = await validateCustomMarkerFile(svgFile(source, 'renamed.svg'));

    expect(first.id).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ mimeType: 'image/svg+xml', width: 100, height: 120 });
    expect(first.dataUri).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it.each(['', ' xmlns="https://invalid.example/svg"'])('rejects an SVG source with a missing or incorrect namespace %j at both boundaries', async (namespace) => {
    const source = `<svg${namespace} viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>`;
    await expect(validateCustomMarkerFile(svgFile(source))).rejects.toThrow('xmlns');
    const bytes = new TextEncoder().encode(source);
    expect(() => validateStoredCustomMarkerAsset({
      id: `sha256-${sha256Hex(bytes)}`, mimeType: 'image/svg+xml', width: 100, height: 100,
      dataUri: `data:image/svg+xml;base64,${btoa(source)}`,
    })).toThrow('xmlns');
  });

  it.each([
    ['script content', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><script>alert(1)</script></svg>', 'active content'],
    ['event handlers', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path onload="alert(1)" d="M0 0"/></svg>', 'event handlers'],
    ['external links', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><image href="https://example.com/a.png"/></svg>', 'external references'],
    ['foreign objects', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><foreignObject width="100" height="100"/></svg>', 'active content'],
    ['processing instructions', '<?xml-stylesheet href="https://example.com/a.css"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0"/></svg>', 'processing instructions'],
    ['SMIL animation', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><set attributeName="href" to="https://example.com"/></svg>', 'element is not supported'],
    ['CSS-escaped external paint', String.raw`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="u\72l(\68ttps\3a\2f\2fevil.test/a)" d="M0 0"/></svg>`, 'attribute value is not supported'],
    ['namespace-free child', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle xmlns="" r="40"/></svg>', 'xmlns'],
  ])('rejects SVG %s', async (_label, source, message) => {
    await expect(validateCustomMarkerFile(svgFile(source))).rejects.toThrow(message);
  });

  it.each([
    [24, 24, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>'],
    [99.5, 100, '<svg xmlns="http://www.w3.org/2000/svg" width="99.5" height="100"><path d="M0 0H99V100H0Z"/></svg>'],
    [2048.4, 100, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048.4 100"><path d="M0 0H2048V100H0Z"/></svg>'],
    [0.5, 0.25, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 .5 .25"><path d="M0 0H.5V.25H0Z"/></svg>'],
    [1e100, 1e100, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1e100 1e100"><circle r="1"/></svg>'],
  ])('accepts vector units %s × %s without applying raster quality limits', async (width, height, source) => {
    const asset = await validateCustomMarkerFile(svgFile(source));
    expect(asset).toMatchObject({ width, height });
    expect(() => validateStoredCustomMarkerAsset(asset)).not.toThrow();
    const raster = customMarkerRasterDimensions(asset);
    expect(Math.max(raster.width, raster.height)).toBe(100);
    expect(raster.width).toBeGreaterThanOrEqual(1);
    expect(raster.height).toBeGreaterThanOrEqual(1);
    expect(raster.drawWidth / raster.drawHeight).toBeCloseTo(width / height);
    expect(raster.width * raster.height).toBeLessThanOrEqual(10_000);
  });

  it.each([[0, 24], [-1, 24], [Infinity, 24], [NaN, 24], [Number.MIN_VALUE, Number.MAX_VALUE]])('rejects unrenderable vector dimensions %s × %s', (width, height) => {
    expect(() => assertCustomMarkerDimensions('image/svg+xml', width, height)).toThrow('positive, finite');
  });

  it('counts rounded vector allocation rather than fractional source units', () => {
    expect(customMarkerRasterDimensions({ mimeType: 'image/svg+xml', width: 24, height: 7 })).toEqual({
      width: 100, height: 30, drawWidth: 100, drawHeight: 7 / 24 * 100,
    });
  });

  it('rejects raster markers below 100 × 100 pixels', async () => {
    await expect(validateCustomMarkerFile(pngFile(99, 100))).rejects.toThrow('at least 100 × 100 pixels');
  });

  it('retains the raster upper bound and whole-pixel requirement', async () => {
    await expect(validateCustomMarkerFile(pngFile(2049, 100))).rejects.toThrow('no larger than 2048 × 2048');
    expect(() => assertCustomMarkerDimensions('image/png', 100.5, 100)).toThrow('whole-pixel dimensions');
  });

  it('rejects unsupported types and files above the byte limit before parsing', async () => {
    const oversized = new Uint8Array(MAX_CUSTOM_MARKER_BYTES + 1);
    await expect(validateCustomMarkerFile(new File(['gif'], 'marker.gif', { type: 'image/gif' })))
      .rejects.toThrow('PNG, JPEG, or SVG');
    await expect(validateCustomMarkerFile(new File([oversized], 'large.png', { type: 'image/png' })))
      .rejects.toThrow('1 MB or smaller');
  });

  it('rejects collections whose decoded texture area exceeds the project budget', async () => {
    const asset = await validateCustomMarkerFile(pngFile(2048, 2048));
    const assets = Object.fromEntries([1, 2, 3, 4, 5].map((index) => [String(index), asset]));

    expect(() => validateCustomMarkerAssetCollection(assets))
      .toThrow('decoded pixel budget');
  });

  it('does not spend a 2048px texture on each vector coordinate system', async () => {
    const assets = await Promise.all(Array.from({ length: 64 }, (_, index) => validateCustomMarkerFile(svgFile(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><circle cx="${index}" r="100"/></svg>`,
    ))));
    expect(() => validateCustomMarkerAssetCollection(Object.fromEntries(assets.map((asset) => [asset.id, asset])))).not.toThrow();
  });

  it('bounds aggregate embedded data after base64 expansion for portable project files', () => {
    const encodedBody = 'A'.repeat(1024 * 1024);
    const assets = Object.fromEntries(Array.from({ length: 9 }, (_, index) => {
      const id = `sha256-${String(index).padStart(64, '0')}`;
      return [id, {
        id,
        mimeType: 'image/png' as const,
        width: 100,
        height: 100,
        dataUri: `data:image/png;base64,${encodedBody}`,
      }];
    }));

    expect(() => validateCustomMarkerAssetCollection(assets)).toThrow('8 MiB encoded project budget');
  });
});
