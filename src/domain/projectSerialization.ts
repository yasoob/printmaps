import { ProjectFileError } from './projectFileError';

export const MAX_PROJECT_FILE_BYTES = 10 * 1024 * 1024;
const encoder = new TextEncoder();
export const utf8Bytes = (text: string) => encoder.encode(text).byteLength;

function jsonStringBytes(value: string) {
  let bytes = 2;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.codePointAt(index)!;
    if (code === 34 || code === 92) bytes += 2;
    else if (code < 32) bytes += [8, 9, 10, 12, 13].includes(code) ? 2 : 6;
    else if (code < 128) bytes += 1;
    else if (code < 2048) bytes += 2;
    else if (code <= 0xFF_FF) bytes += code >= 0xD8_00 && code <= 0xDF_FF ? 6 : 3;
    else { bytes += 4; index += 1; }
  }
  return bytes;
}

function primitiveBytes(value: unknown) {
  if (value === null) return 4;
  switch (typeof value) {
    case 'string': { return jsonStringBytes(value); }
    case 'number': { return Number.isFinite(value) ? String(value).length : 4; }
    case 'boolean': { return value ? 4 : 5; }
    case 'bigint': { throw new ProjectFileError('Project data must not contain BigInt values.'); }
    default: { return; }
  }
}

export class ProjectSizeError extends ProjectFileError {
  constructor(readonly bytes: number) {
    super(`The project exceeds the 10 MB portable limit (${MAX_PROJECT_FILE_BYTES.toLocaleString()} bytes) by ${(bytes - MAX_PROJECT_FILE_BYTES).toLocaleString()} bytes. Remove layers or choose smaller custom markers, then try again.`);
  }
}

// Per-store immutable JSON fragments only. File parsing always uses a fresh cache.
export class CompactJsonByteCache {
  private readonly sizes = new WeakMap<object, number>();
  private readonly visiting = new WeakSet<object>();

  private arraySize(value: unknown[]) {
    let bytes = 2 + Math.max(0, value.length - 1);
    for (let index = 0; index < value.length; index += 1) bytes += this.size(value[index]) ?? 4;
    return bytes;
  }

  private objectSize(value: object) {
    let bytes = 2, properties = 0;
    for (const [key, entry] of Object.entries(value)) {
      const size = this.size(entry);
      if (size === undefined) continue;
      bytes += jsonStringBytes(key) + 1 + size;
      properties += 1;
    }
    return bytes + Math.max(0, properties - 1);
  }

  size(value: unknown): number | undefined {
    if (typeof value !== 'object' || value === null) {
      return primitiveBytes(value);
    }
    const cached = this.sizes.get(value);
    if (cached !== undefined) return cached;
    if (this.visiting.has(value)) throw new ProjectFileError('Project data must not contain circular references.');
    if (('toJSON' in value && typeof value.toJSON === 'function')
      || (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))) {
      throw new ProjectFileError('Project data must contain plain JSON objects.');
    }
    this.visiting.add(value);
    try {
      const bytes = Array.isArray(value) ? this.arraySize(value) : this.objectSize(value);
      this.sizes.set(value, bytes);
      return bytes;
    } finally {
      this.visiting.delete(value);
    }
  }

}

export function assertProjectByteBudget(value: unknown, cache = new CompactJsonByteCache()) {
  const bytes = cache.size(value);
  if (bytes === undefined) throw new ProjectFileError('Project data must be JSON.');
  if (bytes > MAX_PROJECT_FILE_BYTES) throw new ProjectSizeError(bytes);
  return bytes;
}

export function portableProjectText(value: unknown) {
  assertProjectByteBudget(value);
  const readable = `${JSON.stringify(value, null, 2)}\n`;
  // The compact representation intentionally has no extra newline at the cap.
  return utf8Bytes(readable) <= MAX_PROJECT_FILE_BYTES ? readable : JSON.stringify(value);
}
