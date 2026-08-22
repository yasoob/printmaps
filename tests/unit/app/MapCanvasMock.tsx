import { useEffect } from 'react';
import type { ContentLayer } from '../../../src/domain/project';
import { exportMocks } from './exportMocks';

type MapCanvasMockProps = {
  layers?: ContentLayer[];
  selectedId?: string | null;
  previewedId?: string | null;
  onLayerSelect?: (id: string) => void;
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
    </div>
  );
}
