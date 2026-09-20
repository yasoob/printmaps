import { expect, test } from '@playwright/test';

test('production video pipeline includes shared poster, photo, decorations and attribution without store or live camera mutation', async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  await page.route('**/video-composition-harness', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Composed video</title>' }));
  await page.goto('/video-composition-harness');
  const evidence = await page.evaluate(async () => {
    const paths = { fixture: '/tests/e2e/video-browser-fixture.ts', video: '/src/video/exportVideoDocument.ts', capability: '/src/video/capability.ts' };
    const { getVideoCapability } = await import(paths.capability) as typeof import('../../src/video/capability');
    const capability = getVideoCapability();
    if (!capability.supported) return { unsupported: capability.reason };
    const { createVideoBrowserFixture, countVideoCompositionPixels } = await import(paths.fixture) as typeof import('./video-browser-fixture');
    const { exportVideoDocument } = await import(paths.video) as typeof import('../../src/video/exportVideoDocument');
    const fixture = await createVideoBrowserFixture();
    const originalState = fixture.store.getState();
    const doc = originalState.document;
    const originalCamera = fixture.map.getCenter().toArray();
    const originalStyle = JSON.stringify(fixture.map.getStyle());
    let liveMoves = 0;
    fixture.map.on('move', () => { liveMoves++; });
    const snapshot = fixture.capture();
    const originalCapture = HTMLCanvasElement.prototype.captureStream;
    let firstFrame: ImageData | undefined;
    let png = '';
    HTMLCanvasElement.prototype.captureStream = new Proxy(originalCapture, {
      apply: (target, canvas: HTMLCanvasElement, [fps]: [number?]) => {
        firstFrame = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
        png = canvas.toDataURL('image/png');
        return target.call(canvas, fps);
      },
    });
    try {
      const result = await exportVideoDocument({
        document: doc, renderSnapshot: snapshot, settings: doc.studio.video, signal: new AbortController().signal,
      });
      if (!firstFrame) throw new Error('No composed frame was presented to the recorder.');
      return {
        unsupported: null, ...countVideoCompositionPixels(firstFrame, doc.page.heightMm), png,
        stateIdentity: fixture.store.getState() === originalState,
        documentIdentity: fixture.store.getState().document === doc,
        cameraUnchanged: JSON.stringify(fixture.map.getCenter().toArray()) === JSON.stringify(originalCamera),
        styleUnchanged: JSON.stringify(fixture.map.getStyle()) === originalStyle,
        liveMoves, isolatedRenderers: document.querySelectorAll('[data-video-export-renderer]').length,
        bytes: result.blob.size, type: result.blob.type, frames: result.presentedFrames,
        measuredFps: result.measuredPresentationFps, missedSlots: result.missedFrameSlots,
      };
    } finally {
      HTMLCanvasElement.prototype.captureStream = originalCapture;
      fixture.dispose();
    }
  });
  if (evidence.unsupported !== null) {
    testInfo.annotations.push({ type: 'unsupported-mp4', description: evidence.unsupported });
    return;
  }
  expect(evidence.red).toBeGreaterThan(1000);
  expect(evidence.green).toBeGreaterThan(20);
  expect(evidence.basemap).toBeGreaterThan(10_000);
  expect(evidence.attribution).toBeGreaterThan(50);
  expect(evidence.stateIdentity).toBe(true);
  expect(evidence.documentIdentity).toBe(true);
  expect(evidence.cameraUnchanged).toBe(true);
  expect(evidence.styleUnchanged).toBe(true);
  expect(evidence.liveMoves).toBe(0);
  expect(evidence.isolatedRenderers).toBe(0);
  expect(evidence.frames).toBeGreaterThan(1);
  expect(evidence.type?.split(';', 1)[0]).toBe('video/mp4');
  const { png, ...details } = evidence;
  await testInfo.attach('composed-video-first-frame', { body: Buffer.from(png!.split(',', 2)[1], 'base64'), contentType: 'image/png' });
  await testInfo.attach('composed-video-evidence', { body: JSON.stringify(details, null, 2), contentType: 'application/json' });
});
