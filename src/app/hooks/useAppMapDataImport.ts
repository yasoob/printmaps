import { useCallback, useRef, useState } from 'react';
import type { ContentLayer, ProjectDocument } from '../../domain/project';
import { combinedLayerBounds, type MapBounds } from '../../map/MapLayerBounds';
import type { ProjectState } from '../store';
import { mutationRejected } from '../../domain/projectMutation';

export type ImportFitRequest = {
  bounds?: MapBounds;
  request: number;
};

export type LayerReplacementRequest = Readonly<{
  documentEpoch: number;
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

type AppMapDataImportOptions = {
  documentEpoch: number;
  importLayers: ProjectState['importLayers'],
  replaceLayerFromImport: ProjectState['replaceLayerFromImport'],
  isCommitBlocked: boolean,
  onImported: () => void,
};

export function useAppMapDataImport({
  documentEpoch, importLayers, replaceLayerFromImport, isCommitBlocked, onImported,
}: AppMapDataImportOptions) {
  const [importOpenEpoch, setImportOpenEpoch] = useState<number | null>(null);
  const isImportOpen = importOpenEpoch === documentEpoch;
  const setIsImportOpen = useCallback((isOpen: boolean) => {
    setImportOpenEpoch(isOpen ? documentEpoch : null);
  }, [documentEpoch]);
  const [isImportWorkActive, setIsImportWorkActive] = useState(false);
  const [importFitRequest, setImportFitRequest] = useState<ImportFitRequest>({ request: 0 });
  const [replacementRequest, setReplacementRequest] = useState<LayerReplacementRequest | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
    if (isCommitBlocked) return mutationRejected('Close the other dialog before applying this import.', 'unavailable');
    const [replacement] = layers;
    const result = replacementTarget
      ? (replacement ? replaceLayerFromImport(
        replacementTarget.id,
        replacement,
        documentEpoch,
        sourceDocument,
      ) : mutationRejected('Choose replacement data first.'))
      : importLayers(layers, documentEpoch, sourceDocument);
    if (!result.ok) return result;
    onImported();
    const fittedLayers = replacementTarget && replacement?.geometry
      ? [{ ...replacementTarget, geometry: replacement.geometry }]
      : layers;
    const bounds = shouldFitView ? combinedLayerBounds(fittedLayers) : undefined;
    if (bounds) {
      setImportFitRequest((current) => ({ bounds, request: current.request + 1 }));
    }
    return result;
  }, [importLayers, isCommitBlocked, onImported, replaceLayerFromImport]);
  const requestLayerReplacement = useCallback((target: ContentLayer, trigger: HTMLElement | null) => {
    setReplacementRequest((current) => ({
      documentEpoch,
      request: (current?.request ?? 0) + 1,
      target,
      trigger,
    }));
    inputRef.current?.click();
  }, [documentEpoch]);

  return {
    handleImportedLayers,
    importFitRequest,
    inputRef,
    isImportOpen,
    isImportWorkActive,
    replacementRequest,
    requestLayerReplacement,
    finishImportWork,
    setIsImportOpen,
    startImportWork,
  };
}
