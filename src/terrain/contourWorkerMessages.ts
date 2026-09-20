export type ContourWorkerRequest =
  | { kind: 'tile'; id: number; url: string }
  | { kind: 'cancel'; id: number };

export type ContourWorkerResponse =
  | { id: number; data: ArrayBuffer }
  | { id: number; error: string };

export const CONTOUR_PROTOCOL = 'pms-contours';
export function contourTileUrl(intervalMeters: number): string {
  if (!Number.isFinite(intervalMeters) || intervalMeters < 1 || intervalMeters > 10_000) {
    throw new Error('Contour interval must be between 1 and 10,000 meters.');
  }
  return CONTOUR_PROTOCOL + '://{z}/{x}/{y}?interval=' + intervalMeters;
}
