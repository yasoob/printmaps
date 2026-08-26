import { describe, expect, it } from 'vitest';
import { embedPngPhysicalResolution } from '../../src/export/pngPhysicalResolution';

const ONE_PIXEL_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
  (character) => character.codePointAt(0) ?? 0,
);

function crc32(parts: readonly Uint8Array[]): number {
  let crc = 0xFF_FF_FF_FF;
  for (const bytes of parts) {
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xED_B8_83_20 & -(crc & 1));
    }
  }
  return (crc ^ 0xFF_FF_FF_FF) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const output = new Uint8Array(data.length + 12);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.length);
  output.set(typeBytes, 4);
  output.set(data, 8);
  view.setUint32(data.length + 8, crc32([typeBytes, data]));
  return output;
}

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function chunks(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const result: { type: string; typeBytes: Uint8Array; data: Uint8Array; crc: number; raw: Uint8Array }[] = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    result.push({
      type: decoder.decode(typeBytes),
      typeBytes,
      data: bytes.subarray(offset + 8, offset + 8 + length),
      crc: view.getUint32(offset + 8 + length),
      raw: bytes.subarray(offset, offset + length + 12),
    });
    offset += length + 12;
  }
  return result;
}

describe('PNG physical resolution', () => {
  it('embeds a valid 300-DPI pHYs chunk immediately after IHDR', async () => {
    const stale = await embedPngPhysicalResolution(new Blob([ONE_PIXEL_PNG], { type: 'image/png' }), 150);
    const stalePhysical = chunks(new Uint8Array(await stale.arrayBuffer())).find(({ type }) => type === 'pHYs');
    const replaced = await embedPngPhysicalResolution(stale, 300);
    const repeated = await embedPngPhysicalResolution(replaced, 300);
    const bytes = new Uint8Array(await replaced.arrayBuffer());
    const repeatedBytes = new Uint8Array(await repeated.arrayBuffer());
    const parsed = chunks(bytes);
    const physical = parsed.filter(({ type }) => type === 'pHYs');

    expect(new DataView(stalePhysical!.data.buffer, stalePhysical!.data.byteOffset).getUint32(0)).toBe(5906);
    expect(repeatedBytes).toEqual(bytes);
    expect(parsed.slice(0, 2).map(({ type }) => type)).toEqual(['IHDR', 'pHYs']);
    expect(physical).toHaveLength(1);
    const [{ data, typeBytes, crc }] = physical;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    expect(view.getUint32(0)).toBe(11_811);
    expect(view.getUint32(4)).toBe(11_811);
    expect(view.getUint8(8)).toBe(1);
    expect(crc).toBe(crc32([typeBytes, data]));
    expect(replaced.type).toBe('image/png');
  });

  it('rejects corrupt or structurally incomplete PNG input', async () => {
    const parsed = chunks(ONE_PIXEL_PNG);
    const [ihdr, idat, iend] = parsed;
    const signature = ONE_PIXEL_PNG.subarray(0, 8);
    const corruptCrc = Uint8Array.from(ONE_PIXEL_PNG);
    corruptCrc[29] ^= 1;
    const invalidInputs = [
      corruptCrc,
      ONE_PIXEL_PNG.slice(0, -12),
      concatenate([signature, pngChunk('IHDR', ihdr.data.slice(0, 12)), idat.raw, iend.raw]),
      concatenate([ONE_PIXEL_PNG, pngChunk('tEXt', new Uint8Array())]),
      concatenate([signature, ihdr.raw, idat.raw, pngChunk('PLTE', Uint8Array.of(0, 0, 0)), iend.raw]),
      concatenate([
        signature, ihdr.raw, idat.raw, pngChunk('tEXt', new Uint8Array()), pngChunk('IDAT', new Uint8Array()), iend.raw,
      ]),
    ];

    for (const input of invalidInputs) {
      const buffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
      await expect(embedPngPhysicalResolution(new Blob([buffer]), 300)).rejects.toThrow(/invalid PNG/i);
    }
  });
});
