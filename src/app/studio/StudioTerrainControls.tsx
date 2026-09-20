import { memo, useCallback } from 'react';
import type { TerrainSettings } from '../../domain/studio';
import { TerrainProperties } from '../components/TerrainProperties';
import { useProject, useProjectActions } from '../projectStoreContext';

export const StudioTerrainControls = memo(function StudioTerrainControls() {
  const terrain = useProject((state) => state.document.studio.terrain);
  const documentEpoch = useProject((state) => state.documentEpoch);
  const { setStudioSection } = useProjectActions();
  const onTerrainChange = useCallback(
    (value: TerrainSettings) => setStudioSection('terrain', value),
    [setStudioSection],
  );
  return <TerrainProperties terrain={terrain} documentEpoch={documentEpoch} onTerrainChange={onTerrainChange} />;
});
