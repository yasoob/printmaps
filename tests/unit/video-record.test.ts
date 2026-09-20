import { Blob as NodeBlob } from 'node:buffer';
import { recordMapVideo, type RecordVideoRequest } from '../../src/video/record';
import { planVideoExport } from '../../src/video/plan';
import type { VideoCamera } from '../../src/video/camera';

const mp4Bytes = new Uint8Array([
  0, 0, 0, 8, 102, 116, 121, 112,
  0, 0, 0, 8, 109, 111, 111, 118,
  0, 0, 0, 8, 109, 100, 97, 116,
]);

class TestRecorder extends EventTarget {
  static isTypeSupported = () => true;
  static instances: TestRecorder[] = [];
  state = 'inactive';
  mimeType = 'video/mp4';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor() {
    super();
    TestRecorder.instances.push(this);
  }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob([mp4Bytes], { type: this.mimeType }) });
      this.onstop?.();
    });
  }
}

function setup() {
  const controller = new AbortController();
  const canvas = document.createElement('canvas');
  const render = vi.fn(async (camera: VideoCamera) => ({ canvas, camera, project: () => ({ x: 0, y: 0 }) }));
  const disposeRenderer = vi.fn();
  const disposeComposition = vi.fn();
  const draw = vi.fn(async () => {});
  const createRenderer = vi.fn(async () => ({ render, dispose: disposeRenderer }));
  const createComposition = vi.fn(async () => ({ draw, dispose: disposeComposition }));
  const onProgress = vi.fn();
  const request: RecordVideoRequest = {
    plan: planVideoExport({ motion: 'orbit', durationSeconds: 5, fps: 30, aspect: '16:9', quality: 'standard' }, { widthMm: 297, heightMm: 210 }),
    camera: { center: [0, 0], zoom: 10, bearing: 0, pitch: 30 },
    createRenderer, createComposition, onProgress, signal: controller.signal,
  };
  return { request, controller, render, draw, createRenderer, createComposition, disposeRenderer, disposeComposition, onProgress };
}

const stopTrack = vi.fn();
const captureStream = vi.fn(() => ({ getTracks: () => [{ stop: stopTrack }] }));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal('MediaRecorder', TestRecorder);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(), fillRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  stopTrack.mockClear();
  captureStream.mockClear();
  Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', { configurable: true, value: captureStream });
  TestRecorder.instances = [];
});

afterEach(() => {
  delete (HTMLCanvasElement.prototype as Partial<HTMLCanvasElement>).captureStream;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('video recording lifecycle', () => {
  it('composes every frame, records MP4, reports presentation metrics and disposes all resources', async () => {
    const test = setup();
    const before = structuredClone(test.request.camera);
    const resultPromise = recordMapVideo(test.request);
    await vi.advanceTimersByTimeAsync(5100);
    const result = await resultPromise;
    expect(result.blob.type).toBe('video/mp4');
    expect(result.recordingSeconds).toBeCloseTo(5);
    expect(result.targetFps).toBe(30);
    expect(result.presentedFrames).toBeGreaterThan(140);
    expect(result.presentedFrames).toBeLessThanOrEqual(150);
    expect(test.draw).toHaveBeenCalledTimes(test.render.mock.calls.length);
    expect(test.request.camera).toEqual(before);
    expect(test.disposeRenderer).toHaveBeenCalledOnce();
    expect(test.disposeComposition).toHaveBeenCalledOnce();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(test.onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'finalizing', fraction: 1 }));
    expect(captureStream.mock.instances[0]).toMatchObject({ width: 0, height: 0 });
  });

  it('reports missed presentation slots rather than promising fixed encoded FPS', async () => {
    const test = setup();
    test.draw.mockImplementation(async () => { await new Promise((resolve) => setTimeout(resolve, 90)); });
    const resultPromise = recordMapVideo(test.request);
    await vi.advanceTimersByTimeAsync(5500);
    const result = await resultPromise;
    expect(result.measuredPresentationFps).toBeLessThan(12);
    expect(result.missedFrameSlots).toBeGreaterThan(80);
    expect(result.recordingSeconds).toBeCloseTo(5);
  });

  it('cancels an active recording without leaving tracks, canvases, or renderers', async () => {
    const test = setup();
    const result = expect(recordMapVideo(test.request)).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(200);
    test.controller.abort();
    await result;
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(test.disposeRenderer).toHaveBeenCalledOnce();
    expect(test.disposeComposition).toHaveBeenCalledOnce();
    expect(captureStream.mock.instances[0]).toMatchObject({ width: 0, height: 0 });
  });

  it('cleans up when the required composition fails and does not produce partial output', async () => {
    const test = setup();
    test.draw.mockRejectedValue(new Error('Photo decoding failed'));
    await expect(recordMapVideo(test.request)).rejects.toThrow('Photo decoding failed');
    expect(captureStream).not.toHaveBeenCalled();
    expect(test.disposeRenderer).toHaveBeenCalledOnce();
    expect(test.disposeComposition).toHaveBeenCalledOnce();
  });

  it('rejects unsupported MP4 and pre-cancelled runs before renderer allocation', async () => {
    const test = setup();
    vi.spyOn(TestRecorder, 'isTypeSupported').mockReturnValue(false);
    await expect(recordMapVideo(test.request)).rejects.toThrow('MP4 recording is unavailable');
    expect(test.createRenderer).not.toHaveBeenCalled();
    vi.mocked(TestRecorder.isTypeSupported).mockReturnValue(true);
    test.controller.abort();
    await expect(recordMapVideo(test.request)).rejects.toMatchObject({ name: 'AbortError' });
    expect(test.createRenderer).not.toHaveBeenCalled();
  });

  it('stops with an honest error if the tab becomes hidden', async () => {
    const test = setup();
    const result = expect(recordMapVideo(test.request)).rejects.toThrow('tab became hidden');
    await vi.advanceTimersByTimeAsync(200);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    await result;
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(test.disposeRenderer).toHaveBeenCalledOnce();
  });

  it('surfaces a failed encoder and rejects mislabeled output', async () => {
    const test = setup();
    const failed = expect(recordMapVideo(test.request)).rejects.toThrow('encoder failed');
    await vi.advanceTimersByTimeAsync(200);
    TestRecorder.instances[0].dispatchEvent(new Event('error'));
    await failed;
    expect(stopTrack).toHaveBeenCalledOnce();
    const mismatch = expect(recordMapVideo(setup().request)).rejects.toThrow('non-MP4');
    await vi.advanceTimersByTimeAsync(200);
    TestRecorder.instances.at(-1)!.mimeType = 'video/webm';
    await vi.advanceTimersByTimeAsync(5000);
    await mismatch;
  });
});
