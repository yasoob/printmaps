import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { MapRenderSnapshot } from '../../src/map/MapRenderSnapshot';

test('isolated map recording downloads a genuine decodable MP4 with requested dimensions and duration', async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  await page.route('**/video-harness', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Video export evidence</title>' }));
  await page.goto('/video-harness');
  const capability = await page.evaluate(async () => {
    const path = '/src/video/capability.ts';
    const { getVideoCapability } = await import(path) as typeof import('../../src/video/capability');
    return getVideoCapability();
  });
  if (!capability.supported) {
    expect(capability.reason).toMatch(/MP4|canvas/);
    testInfo.annotations.push({ type: 'unsupported-mp4', description: capability.reason });
    return;
  }
  const downloadPromise = page.waitForEvent('download');
  const evidence = await page.evaluate(async () => {
    const paths = {
      record: '/src/video/record.ts', plan: '/src/video/plan.ts', map: '/src/video/mapCapture.ts',
      project: '/src/domain/project.ts', download: '/src/lib/downloadBlob.ts',
    };
    const { recordMapVideo } = await import(paths.record) as typeof import('../../src/video/record');
    const { planVideoExport } = await import(paths.plan) as typeof import('../../src/video/plan');
    const { createMapVideoSnapshot } = await import(paths.map) as typeof import('../../src/video/mapCapture');
    const { createInitialProjectDocument } = await import(paths.project) as typeof import('../../src/domain/project');
    const { downloadBlob } = await import(paths.download) as typeof import('../../src/lib/downloadBlob');
    const doc = createInitialProjectDocument();
    doc.layers = [];
    const before = JSON.stringify(doc);
    const plan = planVideoExport({ motion: 'sway', durationSeconds: 5, fps: 30, aspect: '16:9', quality: 'standard' }, doc.page);
    const renderSnapshot: MapRenderSnapshot = {
      style: {
        version: 8, sources: {
          shape: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[16.3, 48.15], [16.45, 48.15], [16.38, 48.3], [16.3, 48.15]]] } } },
        },
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#d9ebf4' } },
          { id: 'shape', source: 'shape', type: 'fill', paint: { 'fill-color': '#07686f' } },
        ],
      },
      layers: [], assets: {}, camera: { center: [16.37, 48.21], zoom: 10, bearing: 0, pitch: 0, roll: 0 },
      printCamera: { center: [16.37, 48.21], zoom: 10, bearing: 0, pitch: 0 },
      viewport: { width: 600, height: 424 }, frame: { x: 0, y: 0, width: 600, height: 424 },
      footprint: { corners: [[16, 48], [17, 48], [17, 47], [16, 47]], widthPx: 600, heightPx: 424, bearing: 0, pitch: 0 },
      referenceLongitude: 16.37,
    };
    const snapshotBefore = JSON.stringify(renderSnapshot);
    const snapshot = createMapVideoSnapshot(renderSnapshot, doc, plan);
    let compositionCalls = 0;
    let isCompositionDisposed = false;
    const controller = new AbortController();
    const result = await recordMapVideo({
      ...snapshot, plan, signal: controller.signal,
      createComposition: async () => ({
        draw: async (canvas: HTMLCanvasElement) => {
          const context = canvas.getContext('2d');
          if (!context) throw new Error('No composition canvas');
          compositionCalls++;
          context.fillStyle = '#ffffff';
          context.fillRect(0, canvas.height - 50, canvas.width, 50);
          context.fillStyle = '#111111';
          context.font = '18px sans-serif';
          context.fillText('Immutable poster + attribution test', 15, canvas.height - 18);
        },
        dispose: () => { isCompositionDisposed = true; },
      }),
    });
    const video = document.createElement('video');
    const url = URL.createObjectURL(result.blob);
    let metadata: { width: number; height: number; duration: number };
    try {
      video.src = url;
      await new Promise<void>((resolve, reject) => {
        video.addEventListener('loadedmetadata', () => resolve(), { once: true });
        video.addEventListener('error', () => reject(new Error('Downloaded MP4 cannot be decoded.')), { once: true });
      });
      metadata = { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
    } finally {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    }
    const header = [...new Uint8Array(await result.blob.slice(0, 12).arrayBuffer())];
    downloadBlob(result.blob, 'video-evidence.mp4');
    return {
      metadata, header, mimeType: result.blob.type, size: result.blob.size,
      output: { width: plan.width, height: plan.height },
      compositionCalls, compositionDisposed: isCompositionDisposed,
      documentUnchanged: before === JSON.stringify(doc),
      snapshotUnchanged: snapshotBefore === JSON.stringify(renderSnapshot),
      leftoverRenderers: document.querySelectorAll('[data-video-export-renderer]').length,
      presentedFrames: result.presentedFrames, missedFrameSlots: result.missedFrameSlots,
      measuredPresentationFps: result.measuredPresentationFps,
    };
  });
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const file = await readFile(path!);
  expect(download.suggestedFilename()).toBe('video-evidence.mp4');
  expect(file.subarray(4, 8).toString()).toBe('ftyp');
  expect(file.subarray(0, 4).toString('hex')).not.toBe('1a45dfa3');
  expect(evidence.mimeType.split(';', 1)[0]).toBe('video/mp4');
  expect(evidence.metadata.width).toBe(evidence.output.width);
  expect(evidence.metadata.height).toBe(evidence.output.height);
  expect(evidence.metadata.duration).toBeGreaterThan(4.5);
  expect(evidence.metadata.duration).toBeLessThan(5.6);
  expect(evidence.presentedFrames).toBeGreaterThan(1);
  expect(evidence.compositionCalls).toBeGreaterThan(1);
  expect(evidence.compositionDisposed).toBe(true);
  expect(evidence.documentUnchanged).toBe(true);
  expect(evidence.snapshotUnchanged).toBe(true);
  expect(evidence.leftoverRenderers).toBe(0);
  await testInfo.attach('video-metadata', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  await testInfo.attach('actual-mp4', { path: path!, contentType: 'video/mp4' });
});
