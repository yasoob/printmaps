import { useEffect } from 'react';
import type { ContentLayer } from '../../../src/domain/project';
import { exportMocks } from './exportMocks';

type MapCanvasMockProps = {
  layers?: ContentLayer[];
  selectedId?: string | null;
  previewedId?: string | null;
  onLayerSelect?: (id: string) => void;
  onMapClick?: (coordinate: [number, number]) => void;
  onBackgroundClick: () => void;
  onExporterChange?: (exporter: typeof exportMocks.exporter) => void;
  fitRequest?: number;
  orientation?: 'landscape' | 'portrait';
  page?: { preset?: string; widthMm: number; heightMm: number };
};

export function MapCanvas({
  layers = [],
  selectedId,
  previewedId,
  onLayerSelect,
  onMapClick,
  onBackgroundClick,
  onExporterChange,
  fitRequest,
  orientation,
  page,
}: MapCanvasMockProps) {
  useEffect(() => {
    onExporterChange?.(exportMocks.exporter);
    return () => onExporterChange?.(null);
  }, [onExporterChange]);

  return (
    <div
      data-testid="map-canvas"
      data-fit-request={fitRequest}
      data-orientation={orientation}
      data-page-preset={page?.preset}
      data-page-size={page ? `${page.widthMm}x${page.heightMm}` : ''}
      data-layer-state={layers.map(({ id, visible }) => `${id}:${visible}`).join(',')}
      data-selected-layer={selectedId ?? ''}
      data-previewed-layer={previewedId ?? ''}
    >
      <button type="button" onClick={onBackgroundClick}>Map background</button>
      <button type="button" onClick={() => onLayerSelect?.('poi-cafe')}>Map Coffee stop</button>
      <button type="button" onClick={() => onMapClick?.([16.31, 48.19])}>Map route point 1</button>
      <button type="button" onClick={() => onMapClick?.([16.4, 48.24])}>Map route point 2</button>
      <button type="button" onClick={() => onMapClick?.([16.37, 48.21])}>Map POI point</button>
      <button type="button" onClick={() => onMapClick?.([16.36, 48.25])}>Map shape point 3</button>
    </div>
  );
}
