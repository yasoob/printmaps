export type StreamingZipSink = Readonly<{
  write: (chunk: Uint8Array) => void | PromiseLike<void>;
  close: () => void | PromiseLike<void>;
  abort: (reason?: unknown) => void | PromiseLike<void>;
}>;

type CentralEntry = Readonly<{
  name: Uint8Array;
  crc: number;
  size: number;
  offset: number;
}>;

const encoder = new TextEncoder();
const MAX_ZIP32_VALUE = 0xFF_FF_FF_FF;
const DOS_1980_DATE = 0x21;

function crc32(bytes: Uint8Array): number {
  let crc = 0xFF_FF_FF_FF;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xED_B8_83_20 & -(crc & 1));
    }
  }
  return (crc ^ 0xFF_FF_FF_FF) >>> 0;
}

function record(size: number): { bytes: Uint8Array; view: DataView } {
  const bytes = new Uint8Array(size);
  return { bytes, view: new DataView(bytes.buffer) };
}

function localHeader(entry: CentralEntry): Uint8Array {
  const { bytes, view } = record(30 + entry.name.length);
  view.setUint32(0, 0x04_03_4B_50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x08_00, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, DOS_1980_DATE, true);
  view.setUint32(14, entry.crc, true);
  view.setUint32(18, entry.size, true);
  view.setUint32(22, entry.size, true);
  view.setUint16(26, entry.name.length, true);
  bytes.set(entry.name, 30);
  return bytes;
}

function centralHeader(entry: CentralEntry): Uint8Array {
  const { bytes, view } = record(46 + entry.name.length);
  view.setUint32(0, 0x02_01_4B_50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x08_00, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, DOS_1980_DATE, true);
  view.setUint32(16, entry.crc, true);
  view.setUint32(20, entry.size, true);
  view.setUint32(24, entry.size, true);
  view.setUint16(28, entry.name.length, true);
  view.setUint32(42, entry.offset, true);
  bytes.set(entry.name, 46);
  return bytes;
}

export class StreamingZipWriter {
  readonly #entries: CentralEntry[] = [];
  readonly #names = new Set<string>();
  readonly #sink: StreamingZipSink;
  #offset = 0;
  #finished = false;

  constructor(sink: StreamingZipSink) {
    this.#sink = sink;
  }

  async #write(bytes: Uint8Array): Promise<void> {
    if (this.#offset + bytes.length > MAX_ZIP32_VALUE) {
      throw new Error('The tile package exceeded the 4 GiB ZIP compatibility limit. Reduce its dimensions.');
    }
    await this.#sink.write(bytes);
    this.#offset += bytes.length;
  }

  get bytesWritten(): number {
    return this.#offset;
  }

  async add(name: string, bytes: Uint8Array): Promise<void> {
    if (this.#finished) throw new Error('The tile package is already finalized.');
    if (this.#names.has(name)) throw new Error(`Duplicate tile package entry: ${name}`);
    const encodedName = encoder.encode(name);
    if (encodedName.length === 0 || encodedName.length > 0xFF_FF || bytes.length > MAX_ZIP32_VALUE) {
      throw new Error('A tile package entry cannot be represented in a compatible ZIP file.');
    }
    const entry = { name: encodedName, crc: crc32(bytes), size: bytes.length, offset: this.#offset };
    this.#names.add(name);
    this.#entries.push(entry);
    await this.#write(localHeader(entry));
    await this.#write(bytes);
  }

  async close(): Promise<void> {
    if (this.#finished) throw new Error('The tile package is already finalized.');
    if (this.#entries.length > 0xFF_FF) throw new Error('The tile package contains too many ZIP entries.');
    const centralOffset = this.#offset;
    for (const entry of this.#entries) await this.#write(centralHeader(entry));
    const centralSize = this.#offset - centralOffset;
    const { bytes, view } = record(22);
    view.setUint32(0, 0x06_05_4B_50, true);
    view.setUint16(8, this.#entries.length, true);
    view.setUint16(10, this.#entries.length, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, centralOffset, true);
    await this.#write(bytes);
    await this.#sink.close();
    this.#finished = true;
  }

  async abort(reason?: unknown): Promise<void> {
    if (this.#finished) return;
    this.#finished = true;
    await this.#sink.abort(reason);
  }
}
