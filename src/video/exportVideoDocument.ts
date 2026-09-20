import type { ProjectDocument } from '../domain/project';
import { prepareStudioComposition } from '../export/studioComposition';
import type { MapRenderSnapshot } from '../map/MapRenderSnapshot';
import { retainTerrainStyleResources } from '../terrain/contourProtocol';
import { requireVideoActive } from './abort';
import { createMapVideoSnapshot } from './mapCapture';
import { planVideoExport } from './plan';
import { recordMapVideo } from './record';
import type { VideoOptions, VideoProgress, VideoResult } from './types';

export async function exportVideoDocument(request: Readonly<{
  document: ProjectDocument;
  renderSnapshot: MapRenderSnapshot;
  settings: VideoOptions;
  signal: AbortSignal;
  onProgress?: (progress: VideoProgress) => void;
}>): Promise<VideoResult> {
  requireVideoActive(request.signal);
  const plan = planVideoExport(request.settings, request.document.page);
  const snapshot = createMapVideoSnapshot(request.renderSnapshot, request.document, plan, { retainStyleResources: retainTerrainStyleResources });
  return recordMapVideo({
    ...snapshot, plan, signal: request.signal, onProgress: request.onProgress,
    createComposition: async (signal) => {
      requireVideoActive(signal);
      const composition = prepareStudioComposition(snapshot.document);
      return {
        draw: (canvas, frame, frameSignal) => composition.draw(canvas, (coordinate) => {
          const point = frame.project(coordinate);
          return { x: point.x / canvas.width, y: point.y / canvas.height };
        }, { signal: frameSignal, camera: frame.camera, includeAttribution: true }),
        dispose: () => composition.dispose(),
      };
    },
  });
}
