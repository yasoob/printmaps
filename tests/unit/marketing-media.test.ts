import { readFileSync } from 'node:fs';
import path from 'node:path';
import { media, type MarketingImage } from '../../src/marketing/media';

const publicDirectory = path.resolve(import.meta.dirname, '../../public');

function imageSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(path.join(publicDirectory, file));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCodePoint(...bytes.subarray(offset, offset + 4));
  if (tag(1) === 'PNG') return { width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    let offset = 2;
    while (offset < bytes.length) {
      const marker = bytes[offset + 1];
      if (marker >= 0xC0 && marker <= 0xC3) return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
      offset += 2 + view.getUint16(offset + 2);
    }
  }
  if (tag(0) !== 'RIFF' || tag(8) !== 'WEBP') throw new Error(`${file} is not PNG, JPEG or WebP.`);
  const chunk = tag(12);
  if (chunk === 'VP8X') {
    const read24 = (offset: number) => bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
    return { width: read24(24) + 1, height: read24(27) + 1 };
  }
  if (chunk === 'VP8L') {
    const bits = view.getUint32(21, true);
    return { width: (bits & 0x3F_FF) + 1, height: ((bits >> 14) & 0x3F_FF) + 1 };
  }
  return { width: view.getUint16(26, true) & 0x3F_FF, height: view.getUint16(28, true) & 0x3F_FF };
}

const entries = Object.entries(media) as [string, MarketingImage][];

describe('marketing media registry', () => {
  it.each(entries)('%s points at an existing image with matching dimensions', (_key, image) => {
    expect(imageSize(image.src)).toEqual({ width: image.width, height: image.height });
    if (image.mobileSrc) {
      expect(imageSize(image.mobileSrc)).toEqual({ width: image.mobileWidth, height: image.mobileHeight });
    }
    expect(image.alt.length).toBeGreaterThan(10);
    expect(image.alt.length).toBeLessThanOrEqual(160);
  });

  it('gives every page its own 1200×630 social card', () => {
    const cards = entries.filter(([key]) => key.startsWith('og.'));
    expect(cards.length).toBeGreaterThanOrEqual(21);
    for (const [, card] of cards) expect([card.width, card.height]).toEqual([1200, 630]);
    expect(new Set(cards.map(([, card]) => card.src)).size).toBe(cards.length);
  });
});
