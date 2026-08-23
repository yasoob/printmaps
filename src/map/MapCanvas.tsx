import type { CSSProperties } from 'react';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';
import type { CameraSettings, ContentLayer, MapFeatureVisibility, MapLanguage, MapStylePreset, PageSettings } from '../domain/project';
import type { PreviewPngExporter } from '../export/previewPng';
import { useMapCanvasController } from './useMapCanvasController';

type MapCanvasProps = {
  camera?: CameraSettings;
  stylePreset?: MapStylePreset;
  language?: MapLanguage;
  textScalePercent?: number;
  featureVisibility?: MapFeatureVisibility;
  layers: ContentLayer[];
  assets: Record<string, CustomMarkerAsset>;
  selectedId: string | null;
  previewedId: string | null;
  onLayerSelect: (id: string) => void;
  onMapClick?: (coordinate: [number, number]) => void;
  onBackgroundClick: () => void;
  onExporterChange?: (exporter: PreviewPngExporter | null) => void;
  fitRequest?: number;
  fitLayerId?: string | null;
  fitLayerRequest?: number;
  orientation?: 'landscape' | 'portrait';
  page?: PageSettings;
  contentRevision?: object;
};

const DEFAULT_FEATURE_VISIBILITY: MapFeatureVisibility = {
  roads: true,
  buildings: true,
  labels: true,
  water: true,
  parks: true,
  landuse: true,
  transit: true,
};
const resolveFeatureVisibility = (visibility?: MapFeatureVisibility) => visibility ?? DEFAULT_FEATURE_VISIBILITY;
const resolveMapLanguage = (language?: MapLanguage) => language ?? 'local';

export function MapCanvas({
  camera = { bearing: 0, pitch: 0 },
  stylePreset = 'liberty',
  language,
  textScalePercent = 100,
  featureVisibility,
  layers,
  assets,
  selectedId,
  previewedId,
  onLayerSelect,
  onMapClick,
  onBackgroundClick,
  onExporterChange,
  fitRequest = 0,
  fitLayerId,
  fitLayerRequest,
  orientation = 'landscape',
  page,
  contentRevision,
}: MapCanvasProps) {
  const { container, visibleError } = useMapCanvasController({
    camera,
    stylePreset,
    language: resolveMapLanguage(language),
    textScalePercent,
    featureVisibility: resolveFeatureVisibility(featureVisibility),
    fitRequest,
    fitLayerId,
    fitLayerRequest,
    layers,
    assets,
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
      <div ref={container} className="map-root" data-testid="map-canvas" data-fit-request={fitRequest} data-fit-layer-id={fitLayerId} />
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
