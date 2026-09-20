import { Map } from 'maplibre-gl';
import { createInitialProjectDocument } from '../../src/domain/project';
import { captureMapRenderSnapshot } from '../../src/map/MapRenderSnapshot';
import { createMapVideoSnapshot } from '../../src/video/mapCapture';
import { planVideoExport } from '../../src/video/plan';
import { videoCameraAt } from '../../src/video/camera';

export async function pitchedVideoProjectionEvidence(pitch: number, isOffset: boolean) {
  const project = createInitialProjectDocument();
  project.layers = [];
  project.camera = { ...project.camera, center: [16.4, 48.2], zoom: 10, bearing: 25, pitch };
  const container = document.createElement('div');
  Object.assign(container.style, { position: 'relative', width: '1000px', height: '800px' });
  document.body.append(container);
  const frame = document.createElement('div');
  const frameRect = { x: isOffset ? 35 : 150, y: isOffset ? 240 : 152.5, width: 700, height: 495 };
  Object.assign(frame.style, {
    position: 'absolute', left: `${frameRect.x}px`, top: `${frameRect.y}px`,
    width: `${frameRect.width}px`, height: `${frameRect.height}px`, pointerEvents: 'none',
  });
  const source = new Map({
    container, style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#123456' } }] },
    ...project.camera, center: [...project.camera.center],
    interactive: false, attributionControl: false, fadeDuration: 0,
    canvasContextAttributes: { preserveDrawingBuffer: true },
  });
  container.append(frame);
  let renderer: Awaited<ReturnType<ReturnType<typeof createMapVideoSnapshot>['createRenderer']>> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      source.once('idle', () => resolve());
      source.once('error', (event) => reject(new Error(event.error.message)));
    });
    const content = { layers: project.layers, assets: project.assets };
    const original = { center: source.getCenter().toArray(), bearing: source.getBearing(), pitch: source.getPitch(), zoom: source.getZoom() };
    let sourceMoves = 0;
    source.on('move', () => { sourceMoves++; });
    const snapshot = captureMapRenderSnapshot(source, {
      isSourceReady: () => true, resolveStyle: () => source.getStyle(),
      resolvePrintFrame: () => frame, resolveContent: () => content,
    });
    const plan = planVideoExport({ motion: 'orbit', durationSeconds: 5, fps: 30, aspect: 'page', quality: 'standard' }, project.page);
    const capture = createMapVideoSnapshot(snapshot, project, plan);
    const signal = new AbortController().signal;
    renderer = await capture.createRenderer(signal);
    const initial = await renderer.render(videoCameraAt(capture.camera, 'orbit', 0), signal);
    const fractions = [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]];
    const errors = fractions.map(([x, y]) => {
      const point = source.unproject([frameRect.x + x * frameRect.width, frameRect.y + y * frameRect.height]);
      const actual = initial.project([point.lng, point.lat]);
      return Math.hypot(actual.x - x * plan.poster.width, actual.y - y * plan.poster.height);
    });
    const color = initial.canvas.getContext('2d')!.getImageData(plan.poster.width - 2, plan.poster.height - 2, 1, 1).data;
    const output = { width: initial.canvas.width, height: initial.canvas.height };
    const moved = await renderer.render(videoCameraAt(capture.camera, 'orbit', 0.25), signal);
    const isUnchanged = JSON.stringify(original) === JSON.stringify({
      center: source.getCenter().toArray(), bearing: source.getBearing(), pitch: source.getPitch(), zoom: source.getZoom(),
    });
    return { errors, output, expected: plan.poster, color: [...color], pitch: moved.camera.pitch, bearing: moved.camera.bearing, unchanged: isUnchanged, sourceMoves };
  } finally {
    renderer?.dispose();
    source.remove();
    container.remove();
  }
}
