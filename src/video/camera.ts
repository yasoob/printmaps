export type VideoCamera = Readonly<{
  center: readonly [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}>;

export function videoCameraAt(
  initial: VideoCamera,
  motion: 'orbit' | 'sway',
  progress: number,
): VideoCamera {
  if (
    !Number.isFinite(progress) || progress < 0 || progress > 1
    || [...initial.center, initial.zoom, initial.bearing, initial.pitch].some((value) => !Number.isFinite(value))
  ) throw new Error('Video camera coordinates and progress must be finite; progress must be between 0 and 1.');
  if (motion !== 'orbit' && motion !== 'sway') throw new Error('Choose orbit or sway for video motion.');
  return {
    center: [initial.center[0], initial.center[1]],
    zoom: initial.zoom,
    pitch: initial.pitch,
    bearing: initial.bearing + (motion === 'orbit' ? 360 * progress : 18 * Math.sin(2 * Math.PI * progress)),
  };
}
