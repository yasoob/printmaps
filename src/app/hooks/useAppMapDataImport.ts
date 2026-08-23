import { useCallback, useRef, useState } from 'react';
import type { ContentLayer, ProjectDocument } from '../../domain/project';
import { combinedLayerBounds, type MapBounds } from '../../map/MapLayerBounds';
import type { ProjectState } from '../store';

export type ImportFitRequest = {
  bounds?: MapBounds;
  request: number;
};

export type LayerReplacementRequest = Readonly<{
  request: number;
  target: ContentLayer;
  trigger: HTMLElement | null;
}>;

export type MapDataImportCommit = Readonly<{
  documentEpoch: number;
  layers: readonly ContentLayer[];
  replacementTarget: ContentLayer | null;
  shouldFitView: boolean;
  sourceDocument: ProjectDocument;
}>;

export function useAppMapDataImport(
  importLayers: ProjectState['importLayers'],
  replaceLayerFromImport: ProjectState['replaceLayerFromImport'],
  isCommitBlocked: boolean,
  onImported: () => void,
) {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImportWorkActive, setIsImportWorkActive] = useState(false);
  const [importFitRequest, setImportFitRequest] = useState<ImportFitRequest>({ request: 0 });
  const [replacementRequest, setReplacementRequest] = useState<LayerReplacementRequest | null>(null);
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
  const handleImportedLayers = useCallback((commit: MapDataImportCommit) => {
    const { documentEpoch, layers, replacementTarget, shouldFitView, sourceDocument } = commit;
    if (isCommitBlocked) return false;
    const [replacement] = layers;
    const wasImported = replacementTarget
      ? Boolean(replacement) && replaceLayerFromImport(
        replacementTarget.id,
        replacement,
        documentEpoch,
        sourceDocument,
      )
      : importLayers(layers, documentEpoch, sourceDocument);
    if (!wasImported) return false;
    onImported();
    const fittedLayers = replacementTarget && replacement?.geometry
      ? [{ ...replacementTarget, geometry: replacement.geometry }]
      : layers;
    const bounds = shouldFitView ? combinedLayerBounds(fittedLayers) : undefined;
    if (bounds) {
      setImportFitRequest((current) => ({ bounds, request: current.request + 1 }));
    }
    return true;
  }, [importLayers, isCommitBlocked, onImported, replaceLayerFromImport]);
  const requestLayerReplacement = useCallback((target: ContentLayer, trigger: HTMLElement | null) => {
    setReplacementRequest((current) => ({
      request: (current?.request ?? 0) + 1,
      target,
      trigger,
    }));
  }, []);

  return {
    handleImportedLayers,
    importFitRequest,
    isImportOpen,
    isImportWorkActive,
    replacementRequest,
    requestLayerReplacement,
    finishImportWork,
    setIsImportOpen,
    startImportWork,
  };
}
