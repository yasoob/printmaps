import { createElevationProfilePng } from '../../src/export/elevationProfile';
import { printProfile } from '../fixtures/elevationProfile';
import { profilePngChunks, profilePngCrc, validProfilePng } from '../fixtures/profilePng';

describe('UX045 elevation PNG physical size', () => {
  it.each([50, 220, 300])('encodes exact %imm dimensions without changing compressed image data', async (printWidthMm) => {
    const original = await validProfilePng(printWidthMm * 12, printWidthMm * 6, printWidthMm === 220);
    const rasterize = vi.fn(async () => original);
    const png = await createElevationProfilePng(printProfile, 'Print profile', { printWidthMm, rasterize });
    expect(rasterize).toHaveBeenCalledWith(expect.stringContaining(`width="${printWidthMm}mm"`), printWidthMm * 12, printWidthMm * 6);
    const bytes = new Uint8Array(await png.arrayBuffer());
    const chunks = profilePngChunks(bytes);
    expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(chunks.slice(0, 2).map((chunk) => chunk.type)).toEqual(['IHDR', 'pHYs']);
    expect(chunks.filter((chunk) => chunk.type === 'pHYs')).toHaveLength(1);
    const header = new DataView(chunks[0].data.buffer, chunks[0].data.byteOffset);
    const density = new DataView(chunks[1].data.buffer, chunks[1].data.byteOffset);
    expect(header.getUint32(0)).toBe(printWidthMm * 12);
    expect(header.getUint32(4)).toBe(printWidthMm * 6);
    expect(density.getUint32(0)).toBe(12_000);
    expect(density.getUint32(4)).toBe(12_000);
    expect(density.getUint8(8)).toBe(1);
    expect(header.getUint32(0) / density.getUint32(0) * 1000).toBe(printWidthMm);
    expect(header.getUint32(4) / density.getUint32(4) * 1000).toBe(printWidthMm / 2);
    for (const chunk of chunks) expect(profilePngCrc(chunk.raw.subarray(4, -4))).toBe(chunk.crc);
    const originals = profilePngChunks(new Uint8Array(await original.arrayBuffer()));
    expect(chunks.filter((chunk) => chunk.type === 'IDAT')).toEqual(originals.filter((chunk) => chunk.type === 'IDAT'));
  });

  it('fails rather than claiming successful metadata for an invalid raster result', async () => {
    await expect(createElevationProfilePng(printProfile, 'Invalid raster', { rasterize: async () => new Blob(['png'], { type: 'image/png' }) })).rejects.toThrow('invalid PNG');
  });
});
