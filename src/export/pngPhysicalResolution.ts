const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const PNG_TYPE = new TextEncoder();
const PNG_SIGNATURE_LENGTH = PNG_SIGNATURE.length;
const PNG_CHUNK_OVERHEAD = 12;

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
  const typeBytes = PNG_TYPE.encode(type);
  const output = new Uint8Array(data.length + PNG_CHUNK_OVERHEAD);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.length);
  output.set(typeBytes, 4);
  output.set(data, 8);
  view.setUint32(data.length + 8, crc32([typeBytes, data]));
  return output;
}

function pixelsPerMetre(dpi: number): number {
  const value = Math.round(dpi / 0.0254);
  if (!Number.isFinite(dpi) || dpi <= 0 || value <= 0 || value > 0xFF_FF_FF_FF) {
    throw new Error('PNG physical resolution must be a finite positive DPI value.');
  }
  return value;
}

export function pngPhysicalResolutionChunk(dpi: number): Uint8Array {
  const density = pixelsPerMetre(dpi);
  const data = new Uint8Array(9);
  const view = new DataView(data.buffer);
  view.setUint32(0, density);
  view.setUint32(4, density);
  view.setUint8(8, 1);
  return pngChunk('pHYs', data);
}

function isPngSignature(bytes: Uint8Array): boolean {
  return bytes.length >= PNG_SIGNATURE_LENGTH
    && PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function chunkType(bytes: Uint8Array, offset: number): string {
  return new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8));
}

function invalidPng(message: string): never {
  throw new Error(`The browser returned an invalid PNG file: ${message}`);
}

function validateChunkCrc(chunk: Uint8Array): void {
  const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  const expected = view.getUint32(chunk.length - 4);
  const actual = crc32([chunk.subarray(4, 8), chunk.subarray(8, -4)]);
  if (actual !== expected) invalidPng('a chunk checksum did not match');
}

type PngParseState = {
  hasIdat: boolean;
  hasIdatSequenceEnded: boolean;
  hasIend: boolean;
  hasPlte: boolean;
};

function validateChunkStructure(options: Readonly<{
  chunk: Uint8Array;
  end: number;
  index: number;
  length: number;
  totalLength: number;
  type: string;
}>): void {
  const { chunk, end, index, length, totalLength, type } = options;
  if (!/^[A-Za-z]{4}$/.test(type)) invalidPng('a chunk type was malformed');
  validateChunkCrc(chunk);
  if (index === 0 && (type !== 'IHDR' || length !== 13)) invalidPng('the header was malformed');
  if (type === 'IHDR' && index > 0) invalidPng('the header was duplicated');
  if ((chunk[4] & 0x20) === 0 && !['IHDR', 'PLTE', 'IDAT', 'IEND'].includes(type)) {
    invalidPng('an unknown critical chunk was present');
  }
  if (type === 'IEND' && (length !== 0 || end !== totalLength)) invalidPng('the end marker was malformed');
}

function updateChunkOrder(state: PngParseState, type: string): void {
  if (type === 'PLTE') {
    if (state.hasPlte || state.hasIdat) invalidPng('the palette was out of order');
    state.hasPlte = true;
  }
  if (type === 'IDAT') {
    if (state.hasIdatSequenceEnded) invalidPng('image-data chunks were not consecutive');
    state.hasIdat = true;
  } else if (type !== 'IEND' && state.hasIdat) {
    state.hasIdatSequenceEnded = true;
  }
  if (type === 'pHYs' && state.hasIdat) invalidPng('physical metadata was out of order');
  if (type === 'IEND') state.hasIend = true;
}

function parseChunks(bytes: Uint8Array): readonly Uint8Array[] {
  if (!isPngSignature(bytes)) invalidPng('the file signature was missing');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Uint8Array[] = [];
  const state: PngParseState = {
    hasIdat: false,
    hasIdatSequenceEnded: false,
    hasIend: false,
    hasPlte: false,
  };
  let offset = PNG_SIGNATURE_LENGTH;
  while (offset < bytes.length) {
    if (offset + PNG_CHUNK_OVERHEAD > bytes.length) invalidPng('a chunk was truncated');
    const length = view.getUint32(offset);
    const end = offset + length + PNG_CHUNK_OVERHEAD;
    if (!Number.isSafeInteger(end) || end > bytes.length) invalidPng('a chunk was truncated');
    const chunk = bytes.subarray(offset, end);
    const type = chunkType(chunk, 0);
    validateChunkStructure({ chunk, end, index: chunks.length, length, totalLength: bytes.length, type });
    updateChunkOrder(state, type);
    chunks.push(chunk);
    offset = end;
  }
  if (!state.hasIdat || !state.hasIend) invalidPng('required image-data or end chunks were missing');
  return chunks;
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

export async function embedPngPhysicalResolution(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunks = parseChunks(bytes);
  const outputChunks = [
    PNG_SIGNATURE,
    chunks[0],
    pngPhysicalResolutionChunk(dpi),
    ...chunks.slice(1).filter((chunk) => chunkType(chunk, 0) !== 'pHYs'),
  ];
  const output = concatenate(outputChunks);
  const buffer = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: 'image/png' });
}
