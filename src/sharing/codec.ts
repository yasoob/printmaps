import { deflateSync, inflateSync } from 'fflate';
import type { ProjectDocument } from '../domain/project';
import { parseProjectDocument } from '../domain/projectFile';
import { MAX_PROJECT_FILE_BYTES, portableProjectText } from '../domain/projectSerialization';
import { sha256Hex } from '../domain/sha256';

export const MAX_SHARE_URL_LENGTH = 64 * 1024;
export const SHARE_VERSION = 'v1';

export class ShareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShareError';
  }
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCodePoint(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(text: string) {
  if (!/^[\w-]+$/.test(text) || text.length % 4 === 1) {
    throw new ShareError('The shared map contains invalid encoded data.');
  }
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  const bytes = Uint8Array.from(binary, (character) => character.codePointAt(0)!);
  if (base64Url(bytes) !== text) throw new ShareError('The shared map encoding is not canonical.');
  return bytes;
}

function isSameData(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const entries = Object.entries(left);
  return entries.length === Object.keys(right).length && entries.every(([key, value]) =>
    Object.hasOwn(right, key) && isSameData(value, Reflect.get(right, key)));
}

export function encodeSharedProject(document: ProjectDocument): string {
  const source: unknown = JSON.parse(portableProjectText(document));
  const canonical = parseProjectDocument(source);
  if (!isSameData(source, canonical)) {
    throw new ShareError('This project contains unsupported data. Nothing was omitted; download the project instead.');
  }
  const bytes = new TextEncoder().encode(JSON.stringify(canonical));
  const payload = `${SHARE_VERSION}.${bytes.length}.${sha256Hex(bytes)}.${base64Url(deflateSync(bytes))}`;
  if (payload.length > MAX_SHARE_URL_LENGTH) throw new ShareError(
    'This design is too large for a share link (64 KB URL limit). No photos, routes or assets were omitted. Download the project file instead.',
  );
  return payload;
}

function inflateBounded(compressed: Uint8Array, length: number) {
  try {
    // fflate's synchronous `out` never grows. The extra byte detects even a
    // forged length/zip bomb instead of accepting silently truncated output.
    const output = inflateSync(compressed, { out: new Uint8Array(length + 1) });
    if (output.length !== length) throw new ShareError('The shared map has an invalid expanded size.');
    return output;
  } catch (error) {
    if (error instanceof ShareError) throw error;
    throw new ShareError('The shared map compression is damaged or exceeds its declared size.');
  }
}

export function decodeSharedProject(payload: string): ProjectDocument {
  if (payload.length > MAX_SHARE_URL_LENGTH) throw new ShareError('The shared map exceeds the 64 KB URL limit.');
  const [version, size, digest, encoded, extra] = payload.split('.', 5);
  if (version !== SHARE_VERSION) throw new ShareError('This share link version is not supported.');
  if (extra !== undefined || !size || !digest || !encoded
    || !/^[1-9]\d{0,7}$/.test(size) || !/^[\da-f]{64}$/.test(digest)) {
    throw new ShareError('The shared map link is malformed or incomplete.');
  }
  const length = Number(size);
  if (length > MAX_PROJECT_FILE_BYTES) throw new ShareError('The shared map exceeds the 10 MB portable project limit.');
  const bytes = inflateBounded(fromBase64Url(encoded), length);
  if (sha256Hex(bytes) !== digest) throw new ShareError('The shared map is damaged or incomplete.');
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new ShareError('The shared map does not contain a valid UTF-8 project.');
  }
  return parseProjectDocument(value);
}
