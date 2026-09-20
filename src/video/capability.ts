export const MP4_MIME_TYPES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
] as const;

export type VideoCapability = { supported: true; mimeType: string } | { supported: false; reason: string };

type VideoEnvironment = {
  captureStream: boolean;
  isTypeSupported: ((type: string) => boolean) | undefined;
};

function browserVideoEnvironment(): VideoEnvironment {
  return {
    captureStream: typeof HTMLCanvasElement !== 'undefined'
      && typeof HTMLCanvasElement.prototype.captureStream === 'function',
    isTypeSupported: typeof MediaRecorder === 'undefined'
      ? undefined : (type) => MediaRecorder.isTypeSupported(type),
  };
}

export function getVideoCapability(environment = browserVideoEnvironment()): VideoCapability {
  if (!environment.captureStream || !environment.isTypeSupported) {
    return { supported: false, reason: 'This browser cannot record a canvas. Use a current browser with canvas recording and MP4 MediaRecorder support.' };
  }
  const mimeType = MP4_MIME_TYPES.find((type) => environment.isTypeSupported?.(type));
  return mimeType
    ? { supported: true, mimeType }
    : { supported: false, reason: 'MP4 recording is unavailable in this browser. Try a current Chrome, Edge, or Safari version with MP4 MediaRecorder support. WebM is not substituted or renamed to MP4.' };
}

function boxSize(view: DataView, offset: number): number {
  const size = view.getUint32(offset);
  if (size === 0) return view.byteLength - offset;
  if (size !== 1) return size;
  if (offset + 16 > view.byteLength) throw new Error('The MP4 recording is truncated.');
  const largeSize = view.getBigUint64(offset + 8);
  if (largeSize > BigInt(Number.MAX_SAFE_INTEGER) || largeSize < 16n) throw new Error('The MP4 recording has an invalid box size.');
  return Number(largeSize);
}

export async function verifyMp4Blob(blob: Blob): Promise<void> {
  if (blob.type.split(';', 1)[0].toLowerCase() !== 'video/mp4') {
    throw new Error('The browser produced a non-MP4 recording. No file was downloaded.');
  }
  // Check ISO BMFF top-level boxes, not just the browser's claimed MIME type.
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  let offset = 0;
  const boxes = new Set<string>();
  while (offset + 8 <= bytes.length) {
    const size = boxSize(view, offset);
    const type = String.fromCodePoint(...bytes.subarray(offset + 4, offset + 8));
    if (size < 8 || offset + size > bytes.length) throw new Error('The MP4 recording is truncated.');
    boxes.add(type);
    offset += size;
  }
  if (offset !== bytes.length || !boxes.has('ftyp') || !boxes.has('moov') || !boxes.has('mdat')) {
    throw new Error('The browser did not produce a complete MP4 video. No file was downloaded.');
  }
}
