import { memo, useCallback } from 'react';
import type { ReliefSettings, TerrainSettings } from '../../domain/studio';
import type { PreviewPngExporter } from '../../export/previewPng';
import { TerrainProperties } from '../components/TerrainProperties';
import { useProject, useProjectActions } from '../projectStoreContext';

export const StudioTerrainControls = memo(function StudioTerrainControls({ exporter, blockedReason }: {
  exporter: PreviewPngExporter | null;
  blockedReason?: string;
}) {
  const terrain = useProject((state) => state.document.studio.terrain);
  const relief = useProject((state) => state.document.studio.relief);
  const layers = useProject((state) => state.document.layers);
  const documentEpoch = useProject((state) => state.documentEpoch);
  const { setStudioSection } = useProjectActions();
  const onTerrainChange = useCallback(
    (value: TerrainSettings) => setStudioSection('terrain', value),
    [setStudioSection],
  );
  const onReliefChange = useCallback(
    (value: ReliefSettings) => setStudioSection('relief', value),
    [setStudioSection],
  );
  return <TerrainProperties terrain={terrain} relief={relief} layers={layers}
    documentEpoch={documentEpoch} exporter={exporter} blockedReason={blockedReason}
    onTerrainChange={onTerrainChange} onReliefChange={onReliefChange} />;
});
