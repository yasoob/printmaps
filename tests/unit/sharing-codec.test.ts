import { deflateSync } from 'fflate';
import { createInitialProjectDocument } from '../../src/domain/project';
import { validateCustomMarkerFile } from '../../src/domain/customMarkerAssets';
import { sha256Hex } from '../../src/domain/sha256';
import { MAX_PROJECT_FILE_BYTES } from '../../src/domain/projectSerialization';
import { createDefaultRouteAppearance } from '../../src/domain/routeAppearance';
import { decodeSharedProject, encodeSharedProject, MAX_SHARE_URL_LENGTH } from '../../src/sharing/codec';
import { createEmbedHtml, createShareUrl, isSharedProjectHash, parseSharedHash } from '../../src/sharing/urls';

function rawPayload(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return compressedPayload(bytes, bytes.length);
}

function compressedPayload(bytes: Uint8Array, declaredLength: number) {
  const compressed = deflateSync(bytes);
  return `v1.${declaredLength}.${sha256Hex(bytes)}.${Buffer.from(compressed).toString('base64url')}`;
}

describe('shared project codec', () => {
  it('round-trips every canonical field, styled annotations, routes and a referenced embedded image', async () => {
    const document = createInitialProjectDocument();
    document.title = 'Vienna · 旅 & "friends"';
    document.camera = { ...document.camera, bearing: 45, pitch: 30, locked: true };
    document.style.customization.colors = { water: '#123456', label: '#abcdef' };
    const asset = await validateCustomMarkerFile(new File([
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#aabbcc"/></svg>',
    ], 'marker.svg', { type: 'image/svg+xml' }));
    document.assets[asset.id] = asset;
    const poi = document.layers.find((layer) => layer.appearance?.kind === 'poi')!;
    if (poi.appearance?.kind !== 'poi') throw new Error('Missing test POI.');
    poi.name = 'Meeting point';
    poi.appearance.customAssetId = asset.id;
    const payload = encodeSharedProject(document);
    const decoded = decodeSharedProject(payload);
    expect(decoded).toEqual(document);
    expect(decoded).not.toBe(document);
    expect(decoded.assets[asset.id]).not.toBe(asset);
  });

  it('refuses unsupported data rather than silently omitting fields or credentials', () => {
    const project = { ...createInitialProjectDocument(), providerToken: 'private-provider-credential' };
    expect(() => encodeSharedProject(project)).toThrow('Nothing was omitted');
  });

  it.each([
    '', 'v9.1.deadbeef.a', 'v1', 'v1.-1.a.a', 'v1.01.a.a',
    `v1.1.${'0'.repeat(64)}.a.extra`, `v1.1.${'0'.repeat(64)}.💥`,
    `v1.1.${'0'.repeat(64)}.AB`,
  ])('rejects malformed or unsupported payload %s', (payload) => {
    expect(() => decodeSharedProject(payload)).toThrow();
  });

  it('rejects oversized compressed input and forged expanded headers before decompression', () => {
    expect(() => decodeSharedProject('a'.repeat(MAX_SHARE_URL_LENGTH + 1))).toThrow('64 KB');
    expect(() => decodeSharedProject(`v1.${MAX_PROJECT_FILE_BYTES + 1}.${'0'.repeat(64)}.AA`)).toThrow('10 MB');
  });

  it('bounds allocation to the declared size plus one even for compression bombs', () => {
    const bomb = compressedPayload(new Uint8Array(MAX_PROJECT_FILE_BYTES * 2).fill(65), 100);
    expect(bomb.length).toBeLessThan(MAX_SHARE_URL_LENGTH);
    expect(() => decodeSharedProject(bomb)).toThrow(/expanded size|compression/);
  });

  it('rejects truncated compressed data, wrong checksums and invalid project shapes', () => {
    const payload = encodeSharedProject(createInitialProjectDocument());
    expect(() => decodeSharedProject(payload.slice(0, -10))).toThrow();
    const parts = payload.split('.');
    parts[2] = '0'.repeat(64);
    expect(() => decodeSharedProject(parts.join('.'))).toThrow('damaged');
    expect(() => decodeSharedProject(rawPayload({ schemaVersion: 99 }))).toThrow('not supported');
    expect(() => decodeSharedProject(compressedPayload(new Uint8Array([255, 254]), 2))).toThrow(/UTF-8/);
  });

  it('fails explicitly when a valid route cannot fit a URL without dropping geometry', () => {
    const document = createInitialProjectDocument();
    const route = document.layers[0];
    route.appearance = createDefaultRouteAppearance(7999);
    let seed = 42;
    const random = () => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed / 2 ** 32;
    };
    route.geometry = { type: 'LineString', coordinates: Array.from({ length: 8000 }, () => [random() * 180, random() * 80]) };
    expect(() => encodeSharedProject(document)).toThrow('No photos, routes or assets were omitted');
    expect(route.geometry.coordinates).toHaveLength(8000);
  });
});

describe('share and embed addresses', () => {
  it('uses the same origin editor path under an Astro base without query parameters', () => {
    const payload = encodeSharedProject(createInitialProjectDocument());
    const link = createShareUrl(payload, { embedded: false, navigation: true }, { origin: 'https://maps.example', baseUrl: '/studio/' });
    expect(link).toBe(`https://maps.example/studio/editor/#share=${payload}`);
    expect(parseSharedHash(new URL(link).hash)).toEqual({ payload, options: { embedded: false, navigation: true } });
    expect(() => createShareUrl(payload, { embedded: true, navigation: false }, { origin: 'https://maps.example', baseUrl: '//evil.example/' })).toThrow('origin');
  });

  it('enforces the size of the complete URL, not only its compressed fragment', () => {
    expect(() => createShareUrl('a'.repeat(MAX_SHARE_URL_LENGTH - 10), { embedded: false, navigation: true }, { origin: 'https://maps.example' })).toThrow('64 KB');
  });

  it.each(['#share', '#share=bad', '#SHARE=bad', '#embed=', '#embed=v1&bad=1'])('reserves malformed shared links so they cannot open writable autosave: %s', (hash) => {
    expect(isSharedProjectHash(hash)).toBe(true);
  });

  it('escapes iframe attributes, preserves responsive sizing and constrains protocols and dimensions', () => {
    const url = createShareUrl('v1.fake', { embedded: true, navigation: false }, { origin: 'https://maps.example' });
    const html = createEmbedHtml(url, '"><script>alert("bad")</script>&', 480);
    expect(html).toContain('width="100%" height="480"');
    expect(html).toContain('&amp;navigation=0');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('referrerpolicy="no-referrer"');
    for (const bad of ['javascript:alert(1)', 'data:text/html,evil', 'https://user:secret@example.com/#embed=x']) {
      expect(() => createEmbedHtml(bad, 'Map', 480)).toThrow();
    }
    for (const height of [0, 239, 2001, NaN, 480.5]) {
      expect(() => createEmbedHtml(url, 'Map', height)).toThrow('height');
    }
    expect(() => createEmbedHtml('https://maps.example/#share=x', 'Map', 480)).toThrow('embedded');
  });
});
