import type { CSSProperties } from 'react';
import type { CameraSettings, ContentLayer, MapStylePreset, PageSettings } from '../domain/project';
import type { PreviewPngExporter } from '../export/previewPng';
import { useMapCanvasController } from './useMapCanvasController';

type MapCanvasProps = {
  camera?: CameraSettings;
  stylePreset?: MapStylePreset;
  layers: ContentLayer[];
  selectedId: string | null;
  previewedId: string | null;
  onLayerSelect: (id: string) => void;
  onMapClick?: (coordinate: [number, number]) => void;
  onBackgroundClick: () => void;
  onExporterChange?: (exporter: PreviewPngExporter | null) => void;
  fitRequest?: number;
  orientation?: 'landscape' | 'portrait';
  page?: PageSettings;
  contentRevision?: object;
};

export function MapCanvas({
  camera = { bearing: 0, pitch: 0 },
  stylePreset = 'liberty',
  layers,
  selectedId,
  previewedId,
  onLayerSelect,
  onMapClick,
  onBackgroundClick,
  onExporterChange,
  fitRequest = 0,
  orientation = 'landscape',
  page,
  contentRevision,
}: MapCanvasProps) {
  const { container, visibleError } = useMapCanvasController({
    camera,
    stylePreset,
    fitRequest,
    layers,
    onBackgroundClick,
    onExporterChange,
    onLayerSelect,
    onMapClick,
    previewedId,
    selectedId,
    contentRevision,
  });

  return (
    <div className="canvas-surface" aria-label="Map canvas">
      <div ref={container} className="map-root" data-testid="map-canvas" data-fit-request={fitRequest} />
      {visibleError && (
        <div className="map-fallback" role="status">
          <div><strong>Map preview unavailable</strong><span>{visibleError.message}</span></div>
        </div>
      )}
      <div
        className={`print-frame is-${orientation}`}
        style={{
          aspectRatio: page ? `${page.widthMm} / ${page.heightMm}` : undefined,
          '--studio-page-ratio': page ? page.widthMm / page.heightMm : 297 / 210,
        } as CSSProperties}
        aria-hidden="true"
      >
        <span className="page-label">{page?.preset ?? 'A4'} · {orientation === 'landscape' ? 'Landscape' : 'Portrait'}</span>
      </div>
    </div>
  );
}
