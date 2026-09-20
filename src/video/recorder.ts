import { requireVideoActive } from './abort';
import type { VideoPlan } from './types';

export type Mp4Recording = Readonly<{
  finished: Promise<{ blob: Blob; seconds: number }>;
  startedAt: number;
  stop: () => void;
  dispose: () => void;
}>;

export function startMp4Recording(
  canvas: HTMLCanvasElement,
  plan: VideoPlan,
  mimeType: string,
  signal: AbortSignal,
): Mp4Recording {
  requireVideoActive(signal);
  const stream = canvas.captureStream(plan.options.fps);
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: plan.bitrate });
  } catch (error) {
    for (const track of stream.getTracks()) track.stop();
    throw new Error('The browser could not start its MP4 encoder at this resolution and frame rate. Try Standard quality or 30 fps.', { cause: error });
  }
  const chunks: Blob[] = [];
  let bytes = 0;
  let stoppedAt = 0;
  let finalizationTimeout: ReturnType<typeof setTimeout> | undefined;
  const startedAt = performance.now();
  let rejectRecording: (error: unknown) => void;
  const stop = () => {
    if (recorder.state === 'inactive') return;
    stoppedAt = performance.now();
    recorder.stop();
    finalizationTimeout = setTimeout(() => {
      rejectRecording(new Error('The browser timed out while finalizing the MP4 recording.'));
    }, 5000);
  };
  const abort = () => {
    rejectRecording(signal.reason);
    stop();
  };
  const failed = () => {
    rejectRecording(new Error('The browser MP4 encoder failed. Try Standard quality or 30 fps.'));
    stop();
  };
  const finished = new Promise<{ blob: Blob; seconds: number }>((resolve, reject) => {
    rejectRecording = reject;
    recorder.ondataavailable = (event) => {
      bytes += event.data.size;
      if (bytes > plan.maxBytes) {
        reject(new Error('The MP4 recording exceeded its memory budget. Try Standard quality or a shorter duration.'));
        stop();
      } else if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.addEventListener('error', failed);
    recorder.onstop = () => {
      clearTimeout(finalizationTimeout);
      const type = recorder.mimeType || mimeType;
      resolve({
        blob: new Blob(chunks, { type }),
        seconds: ((stoppedAt || performance.now()) - startedAt) / 1000,
      });
    };
    signal.addEventListener('abort', abort, { once: true });
    recorder.start(250);
  });
  return {
    startedAt,
    finished,
    stop,
    dispose: () => {
      signal.removeEventListener('abort', abort);
      clearTimeout(finalizationTimeout);
      recorder.ondataavailable = null;
      recorder.removeEventListener('error', failed);
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
      for (const track of stream.getTracks()) track.stop();
      chunks.length = 0;
    },
  };
}
