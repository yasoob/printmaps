import { useCallback, useRef, useState } from 'react';
import type { ContentLayer, ProjectDocument } from '../../domain/project';
import { combinedLayerBounds, type MapBounds } from '../../map/MapLayerBounds';
import type { ProjectState } from '../store';

export type ImportFitRequest = {
  bounds?: MapBounds;
  request: number;
};

export function useAppMapDataImport(
  importLayers: ProjectState['importLayers'],
  isCommitBlocked: boolean,
  onImported: () => void,
) {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImportWorkActive, setIsImportWorkActive] = useState(false);
  const [importFitRequest, setImportFitRequest] = useState<ImportFitRequest>({ request: 0 });
  const activeWorkRef = useRef<number | null>(null);
  const nextWorkIdRef = useRef(0);
  const startImportWork = useCallback(() => {
    if (activeWorkRef.current !== null) return null;
    nextWorkIdRef.current += 1;
    activeWorkRef.current = nextWorkIdRef.current;
    setIsImportWorkActive(true);
    return activeWorkRef.current;
  }, []);
  const finishImportWork = useCallback((workId: number) => {
    if (activeWorkRef.current !== workId) return;
    activeWorkRef.current = null;
    setIsImportWorkActive(false);
  }, []);
  const handleImportedLayers = useCallback((
    layers: readonly ContentLayer[],
    documentEpoch: number,
    sourceDocument: ProjectDocument,
    shouldFitView: boolean,
  ) => {
    if (isCommitBlocked) return false;
    const wasImported = importLayers(layers, documentEpoch, sourceDocument);
    if (!wasImported) return false;
    onImported();
    const bounds = shouldFitView ? combinedLayerBounds(layers) : undefined;
    if (bounds) {
      setImportFitRequest((current) => ({ bounds, request: current.request + 1 }));
    }
    return true;
  }, [importLayers, isCommitBlocked, onImported]);

  return {
    handleImportedLayers,
    importFitRequest,
    isImportOpen,
    isImportWorkActive,
    finishImportWork,
    setIsImportOpen,
    startImportWork,
  };
}
