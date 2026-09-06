import { useCallback, useRef, useState, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { CameraSettings } from '../domain/project';
import {
  hasSameMapCameraViewport, publishCameraViewport, readMapCameraViewport,
  type CameraViewportPublication, type MapCameraViewport,
} from './MapCameraViewport';

function captureViewport(map: MapLibreMap | null) {
  if (!map) return null;
  try {
    return readMapCameraViewport(map);
  } catch {
    // A destroyed renderer may no longer expose a viewport.
    return null;
  }
}

export function useMapRendererRecovery(
  map: RefObject<MapLibreMap | null>,
  camera: RefObject<CameraSettings>,
  publication?: CameraViewportPublication,
  { onCameraError, canonicalCamera }: {
    onCameraError?: (message: string | null) => void;
    canonicalCamera?: RefObject<(() => CameraSettings) | undefined>;
  } = {},
) {
  const [generation, setGeneration] = useState(0);
  const recoveryCamera = useRef<{ viewport: MapCameraViewport; source: MapCameraViewport } | null>(null);
  const getInitialCamera = useCallback(() => {
    const recovered = recoveryCamera.current;
    const current = canonicalCamera?.current?.() ?? camera.current;
    // Undo, inspector edits, or a new document supersede an older captured view.
    return recovered && hasSameMapCameraViewport(current, recovered.source)
      ? { ...recovered.viewport, locked: current.locked }
      : current;
  }, [camera, canonicalCamera]);
  const onMapCreated = useCallback(() => { recoveryCamera.current = null; }, []);
  const cameraViewportChange = publication?.cameraViewportChange;
  const cameraViewportChangeMode = publication?.cameraViewportChangeMode;
  const retryMap = useCallback(() => {
    const viewport = captureViewport(map.current);
    if (viewport) {
      recoveryCamera.current = { viewport, source: cameraViewportChange?.current ? viewport : camera.current };
      if (cameraViewportChangeMode && cameraViewportChange?.current) {
        // Context loss can interrupt movement before its normal moveend publication.
        const result = publishCameraViewport(viewport, { cameraViewportChange, cameraViewportChangeMode });
        if (!result.ok) recoveryCamera.current = null;
        onCameraError?.(result.ok ? null : result.error);
      }
    }
    setGeneration((value) => value + 1);
  }, [camera, cameraViewportChange, cameraViewportChangeMode, map, onCameraError]);
  return { generation, getInitialCamera, onMapCreated, retryMap };
}
