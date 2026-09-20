import { nextVideoFrame, requireVideoActive, videoAbortError } from './abort';
import { getVideoCapability, verifyMp4Blob } from './capability';
import { videoCameraAt, type VideoCamera } from './camera';
import { startMp4Recording, type Mp4Recording } from './recorder';
import type { VideoComposition, VideoPlan, VideoProgress, VideoRenderer, VideoResult } from './types';

export type RecordVideoRequest = Readonly<{
  plan: VideoPlan;
  camera: VideoCamera;
  createRenderer: (signal: AbortSignal) => Promise<VideoRenderer>;
  createComposition: (signal: AbortSignal) => Promise<VideoComposition>;
  signal: AbortSignal;
  onProgress?: (progress: VideoProgress) => void;
}>;

function createSurface(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    canvas.width = canvas.height = 0;
    throw new Error('A 2D canvas is required to compose video frames.');
  }
  return { canvas, context };
}

function scopedVideoAbort(signal: AbortSignal, durationSeconds: number) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason ?? videoAbortError());
  const visibility = () => {
    if (document.hidden) controller.abort(new Error('Video export stopped because this tab became hidden. Keep the editor tab visible while recording.'));
  };
  const deadline = setTimeout(() => controller.abort(new Error('Video export exceeded its rendering deadline. Check map resources or lower the quality.')), (durationSeconds + 45) * 1000);
  signal.addEventListener('abort', abort, { once: true });
  document.addEventListener('visibilitychange', visibility);
  if (signal.aborted) abort();
  visibility();
  return {
    controller,
    dispose: () => {
      clearTimeout(deadline);
      signal.removeEventListener('abort', abort);
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}

async function animateRecording(
  request: RecordVideoRequest,
  recording: Mp4Recording,
  render: (progress: number, signal: AbortSignal) => Promise<void>,
  scope: ReturnType<typeof scopedVideoAbort>,
): Promise<{ blob: Blob; seconds: number; presentedFrames: number }> {
  const { plan, onProgress } = request;
  const frames = new AbortController();
  const abort = () => frames.abort(scope.controller.signal.reason);
  scope.controller.signal.addEventListener('abort', abort, { once: true });
  let isEnded = false;
  let presentedFrames = 1;
  let lastSlot = 0;
  const timer = setTimeout(() => {
    isEnded = true;
    recording.stop();
    frames.abort(videoAbortError());
    onProgress?.({ phase: 'finalizing', fraction: 1, presentedFrames, missedFrameSlots: Math.max(0, plan.expectedFrames - presentedFrames) });
  }, Math.max(0, plan.options.durationSeconds * 1000 - (performance.now() - recording.startedAt)));
  // Observe encoder failures immediately, including while a tile/composition awaits loading.
  const finished = (async () => {
    try {
      const result = await recording.finished;
      if (!isEnded) scope.controller.abort(new Error('The browser stopped recording before the requested duration.'));
      return result;
    } catch (error) {
      scope.controller.abort(error);
      throw error;
    }
  })();
  const animate = async () => {
    try {
      while (!isEnded) {
        const now = await nextVideoFrame(frames.signal);
        const progress = Math.min(1, (now - recording.startedAt) / (plan.options.durationSeconds * 1000));
        const slot = Math.floor(progress * plan.expectedFrames);
        if (slot <= lastSlot || progress >= 1) continue;
        lastSlot = slot;
        await render(progress, frames.signal);
        presentedFrames++;
        onProgress?.({ phase: 'recording', fraction: progress, presentedFrames, missedFrameSlots: Math.max(0, slot + 1 - presentedFrames) });
      }
    } catch (error) {
      if (!isEnded) throw error;
    }
  };
  try {
    const [, result] = await Promise.all([animate(), finished]);
    requireVideoActive(scope.controller.signal);
    return { ...result, presentedFrames };
  } finally {
    clearTimeout(timer);
    scope.controller.signal.removeEventListener('abort', abort);
    frames.abort(videoAbortError());
    recording.stop();
  }
}

function releaseSurfaces(surfaces: (ReturnType<typeof createSurface> | undefined)[]): void {
  for (const surface of surfaces) {
    if (surface) surface.canvas.width = surface.canvas.height = 0;
  }
}

function disposeRenderResources(renderer: VideoRenderer | undefined, composition: VideoComposition | undefined) {
  try {
    composition?.dispose();
  } finally {
    renderer?.dispose();
  }
}

export async function recordMapVideo(request: RecordVideoRequest): Promise<VideoResult> {
  const capability = getVideoCapability();
  if (!capability.supported) throw new Error(capability.reason);
  requireVideoActive(request.signal);
  const { plan, camera, onProgress } = request;
  const scope = scopedVideoAbort(request.signal, plan.options.durationSeconds);
  const signal = scope.controller.signal;
  let renderer: VideoRenderer | undefined;
  let composition: VideoComposition | undefined;
  let output: ReturnType<typeof createSurface> | undefined;
  let poster: ReturnType<typeof createSurface> | undefined;
  let recording: Mp4Recording | undefined;
  try {
    requireVideoActive(signal);
    onProgress?.({ phase: 'preparing', fraction: 0, presentedFrames: 0, missedFrameSlots: 0 });
    renderer = await request.createRenderer(signal);
    requireVideoActive(signal);
    composition = await request.createComposition(signal);
    requireVideoActive(signal);
    output = createSurface(plan.width, plan.height);
    poster = createSurface(plan.poster.width, plan.poster.height);
    const activeRenderer = renderer;
    const activeComposition = composition;
    const target = output;
    const page = poster;
    const render = async (progress: number, frameSignal: AbortSignal) => {
      const frame = await activeRenderer.render(videoCameraAt(camera, plan.options.motion, progress), frameSignal);
      requireVideoActive(frameSignal);
      page.context.drawImage(frame.canvas, 0, 0, page.canvas.width, page.canvas.height);
      await activeComposition.draw(page.canvas, frame, frameSignal);
      requireVideoActive(frameSignal);
      target.context.fillStyle = '#ffffff';
      target.context.fillRect(0, 0, target.canvas.width, target.canvas.height);
      target.context.drawImage(page.canvas, plan.poster.x, plan.poster.y);
    };
    await render(0, signal);
    requireVideoActive(signal);
    recording = startMp4Recording(output.canvas, plan, capability.mimeType, signal);
    const result = await animateRecording(request, recording, render, scope);
    await verifyMp4Blob(result.blob);
    requireVideoActive(signal);
    return {
      blob: result.blob,
      width: plan.width,
      height: plan.height,
      requestedDurationSeconds: plan.options.durationSeconds,
      recordingSeconds: result.seconds,
      targetFps: plan.options.fps,
      presentedFrames: result.presentedFrames,
      measuredPresentationFps: result.presentedFrames / result.seconds,
      missedFrameSlots: Math.max(0, plan.expectedFrames - result.presentedFrames),
    };
  } finally {
    scope.controller.abort(videoAbortError());
    recording?.dispose();
    try {
      disposeRenderResources(renderer, composition);
    } finally {
      releaseSurfaces([output, poster]);
      scope.dispose();
    }
  }
}
