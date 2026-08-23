import {
  MAX_CUSTOM_MARKER_BYTES,
  sha256Hex,
  validateCustomMarkerAssetCollection,
  validateCustomMarkerFile,
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

  it.each([
    ['script content', '<svg viewBox="0 0 100 100"><script>alert(1)</script></svg>', 'active content'],
    ['event handlers', '<svg viewBox="0 0 100 100"><path onload="alert(1)" d="M0 0"/></svg>', 'event handlers'],
    ['external links', '<svg viewBox="0 0 100 100"><image href="https://example.com/a.png"/></svg>', 'external references'],
    ['foreign objects', '<svg viewBox="0 0 100 100"><foreignObject width="100" height="100"/></svg>', 'active content'],
    ['processing instructions', '<?xml-stylesheet href="https://example.com/a.css"?><svg viewBox="0 0 100 100"><path d="M0 0"/></svg>', 'processing instructions'],
    ['SMIL animation', '<svg viewBox="0 0 100 100"><set attributeName="href" to="https://example.com"/></svg>', 'element is not supported'],
    ['CSS-escaped external paint', String.raw`<svg viewBox="0 0 100 100"><path fill="u\72l(\68ttps\3a\2f\2fevil.test/a)" d="M0 0"/></svg>`, 'attribute value is not supported'],
  ])('rejects SVG %s', async (_label, source, message) => {
    await expect(validateCustomMarkerFile(svgFile(source))).rejects.toThrow(message);
  });

  it.each([
    ['fractional width', '<svg width="99.5" height="100"><path d="M0 0H99V100H0Z"/></svg>'],
    ['fractional viewBox extent', '<svg viewBox="0 0 2048.4 100"><path d="M0 0H2048V100H0Z"/></svg>'],
  ])('rejects SVG %s instead of rounding across the pixel bounds', async (_label, source) => {
    await expect(validateCustomMarkerFile(svgFile(source))).rejects.toThrow('whole-pixel dimensions');
  });

  it('rejects raster markers below 100 × 100 pixels', async () => {
    await expect(validateCustomMarkerFile(pngFile(99, 100))).rejects.toThrow('at least 100 × 100 pixels');
  });

  it('rejects unsupported types and files above the byte limit before parsing', async () => {
    const oversized = new Uint8Array(MAX_CUSTOM_MARKER_BYTES + 1);
    await expect(validateCustomMarkerFile(new File(['gif'], 'marker.gif', { type: 'image/gif' })))
      .rejects.toThrow('PNG, JPEG, or SVG');
    await expect(validateCustomMarkerFile(new File([oversized], 'large.png', { type: 'image/png' })))
      .rejects.toThrow('1 MB or smaller');
  });

  it('rejects collections whose decoded texture area exceeds the project budget', async () => {
    const assets = await Promise.all([1, 2, 3, 4, 5].map((index) => validateCustomMarkerFile(svgFile(
      `<svg viewBox="0 0 2048 2048"><path d="M0 0H${2000 + index}V2048H0Z"/></svg>`,
      `marker-${index}.svg`,
    ))));

    expect(() => validateCustomMarkerAssetCollection(Object.fromEntries(assets.map((asset) => [asset.id, asset]))))
      .toThrow('decoded pixel budget');
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
