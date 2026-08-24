export type LargeRasterWritable = Readonly<{
  write: (chunk: Uint8Array) => void | PromiseLike<void>;
  close: () => void | PromiseLike<void>;
  abort: (reason?: unknown) => void | PromiseLike<void>;
}>;

const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const PNG_TYPE = new TextEncoder();

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

function pngChunk(type: string, data: Uint8Array<ArrayBufferLike> = new Uint8Array()): Uint8Array {
  const typeBytes = PNG_TYPE.encode(type);
  const output = new Uint8Array(data.length + 12);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.length);
  output.set(typeBytes, 4);
  output.set(data, 8);
  view.setUint32(data.length + 8, crc32([typeBytes, data]));
  return output;
}

function headerData(width: number, height: number): Uint8Array {
  const data = new Uint8Array(13);
  const view = new DataView(data.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  data.set([8, 6, 0, 0, 0], 8);
  return data;
}

function pumpCompressed(
  readable: ReadableStream<Uint8Array>,
  write: (bytes: Uint8Array<ArrayBufferLike>) => Promise<void>,
): Promise<void> {
  return readable.pipeTo(new WritableStream({ write }));
}

function cancellationError(): DOMException {
  return new DOMException('Large PNG export was cancelled.', 'AbortError');
}

function raceWithAbort<T>(operation: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return operation;
  if (signal.aborted) return Promise.reject(cancellationError());
  return new Promise<T>((resolve, reject) => {
    const cancel = () => { reject(cancellationError()); };
    signal.addEventListener('abort', cancel, { once: true });
    void operation.then(resolve).catch(reject).finally(() => signal.removeEventListener('abort', cancel));
  });
}

export class StreamingPngWriter {
  readonly #compressor = new CompressionStream('deflate');
  readonly #compressionWriter = this.#compressor.writable.getWriter();
  readonly #sink: LargeRasterWritable;
  readonly #pump: Promise<void>;
  #bytesWritten = 0;
  #finished = false;

  constructor(sink: LargeRasterWritable) {
    this.#sink = sink;
    this.#pump = pumpCompressed(
      this.#compressor.readable,
      (bytes) => this.#write(pngChunk('IDAT', bytes)),
    );
  }

  async #write(bytes: Uint8Array): Promise<void> {
    await this.#sink.write(bytes);
    this.#bytesWritten += bytes.length;
  }

  get bytesWritten(): number {
    return this.#bytesWritten;
  }

  async start(width: number, height: number): Promise<void> {
    await this.#write(PNG_SIGNATURE);
    await this.#write(pngChunk('IHDR', headerData(width, height)));
  }

  async row(bytes: Uint8Array): Promise<void> {
    await this.#compressionWriter.write(Uint8Array.from(bytes));
  }

  async close(signal?: AbortSignal): Promise<void> {
    await this.#compressionWriter.close();
    await this.#pump;
    await this.#write(pngChunk('IEND'));
    await raceWithAbort(Promise.resolve(this.#sink.close()), signal);
    this.#finished = true;
  }

  async abort(reason: unknown): Promise<void> {
    if (this.#finished) return;
    this.#finished = true;
    await Promise.allSettled([this.#compressionWriter.abort(reason), this.#pump]);
    await this.#sink.abort(reason);
  }
}
