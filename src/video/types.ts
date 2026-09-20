import type { VideoCamera } from './camera';

export type VideoOptions = Readonly<{
  motion: 'orbit' | 'sway';
  durationSeconds: 5 | 10 | 15;
  fps: 30 | 60;
  aspect: 'poster' | '16:9' | '9:16' | '1:1' | '4:5';
  quality: 'standard' | 'high';
}>;

export type VideoPlan = Readonly<{
  options: VideoOptions;
  width: number;
  height: number;
  poster: Readonly<{ x: number; y: number; width: number; height: number }>;
  bitrate: number;
  expectedFrames: number;
  maxBytes: number;
}>;

export type VideoFrame = Readonly<{
  canvas: HTMLCanvasElement;
  camera: VideoCamera;
  project: (coordinate: readonly [number, number]) => { x: number; y: number };
}>;

export type VideoRenderer = Readonly<{
  render: (camera: VideoCamera, signal: AbortSignal) => Promise<VideoFrame>;
  dispose: () => void;
}>;

export type VideoComposition = Readonly<{
  draw: (canvas: HTMLCanvasElement, frame: VideoFrame, signal: AbortSignal) => Promise<void>;
  dispose: () => void;
}>;

export type VideoProgress = Readonly<{
  phase: 'preparing' | 'recording' | 'finalizing';
  fraction: number;
  presentedFrames: number;
  missedFrameSlots: number;
}>;

export type VideoResult = Readonly<{
  blob: Blob;
  width: number;
  height: number;
  requestedDurationSeconds: number;
  recordingSeconds: number;
  targetFps: number;
  presentedFrames: number;
  measuredPresentationFps: number;
  missedFrameSlots: number;
}>;
