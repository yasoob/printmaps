import { StreamingPngWriter } from '../../src/export/streamingPngWriter';

export function profilePngChunks(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: { type: string; data: Uint8Array; crc: number; raw: Uint8Array }[] = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = view.getUint32(offset);
    chunks.push({
      type: new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8)),
      data: bytes.subarray(offset + 8, offset + 8 + length),
      crc: view.getUint32(offset + 8 + length), raw: bytes.subarray(offset, offset + length + 12),
    });
    offset += length + 12;
  }
  return chunks;
}

export function profilePngCrc(bytes: Uint8Array): number {
  let crc = 0xFF_FF_FF_FF;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xED_B8_83_20 & -(crc & 1));
  }
  return (crc ^ 0xFF_FF_FF_FF) >>> 0;
}

export async function validProfilePng(width = 1, height = 1, shouldKeepDensity = false): Promise<Blob> {
  const parts: ArrayBuffer[] = [];
  const writer = new StreamingPngWriter({
    write: (chunk) => { parts.push(Uint8Array.from(chunk).buffer); },
    close: () => {}, abort: () => {},
  });
  await writer.start(width, height);
  const row = new Uint8Array(width * 4 + 1);
  for (let y = 0; y < height; y += 1) await writer.row(row);
  await writer.close();
  const png = new Blob(parts, { type: 'image/png' });
  if (shouldKeepDensity) return png;
  const bytes = new Uint8Array(await png.arrayBuffer());
  return new Blob([
    bytes.slice(0, 8),
    ...profilePngChunks(bytes).filter((chunk) => chunk.type !== 'pHYs').map((chunk) => Uint8Array.from(chunk.raw)),
  ], { type: 'image/png' });
}
