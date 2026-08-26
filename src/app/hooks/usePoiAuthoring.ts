import { useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { PoiSpreadsheetEntry } from '../../domain/poiSpreadsheet';
import { MAX_POI_LABEL_CHARACTERS } from '../../domain/poiMarkers';
import type { SearchPoiInput } from '../../domain/project';

function boundedSearchLabel(label: string) {
  const printable = label.trim().replaceAll(/[\p{Cc}\p{Cf}]/gu, '');
  return [...printable].slice(0, MAX_POI_LABEL_CHARACTERS).join('').trim() || 'Searched location';
}

type UsePoiAuthoringOptions = {
  active: boolean;
  documentEpoch: number;
  selectToolRef: RefObject<HTMLButtonElement | null>;
  setActiveTool: Dispatch<SetStateAction<string>>;
  onAuthoringChange: (documentEpoch: number, isActive: boolean) => void;
  onCreatePoi: (coordinates: readonly [number, number]) => void;
  onCreatePoiBatch: (entries: readonly PoiSpreadsheetEntry[], expectedDocumentEpoch?: number) => void;
  onCreateSearchPoi: (input: SearchPoiInput, expectedDocumentEpoch: number) => string | null;
};

export function usePoiAuthoring(options: UsePoiAuthoringOptions) {
  const [spreadsheetOpen, setSpreadsheetOpen] = useState(false);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const spreadsheetTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreSpreadsheetTriggerRef = useRef(false);
  const { active, documentEpoch, onAuthoringChange, onCreatePoi, onCreatePoiBatch, onCreateSearchPoi, selectToolRef, setActiveTool } = options;

  useLayoutEffect(() => {
    if (!active || spreadsheetOpen || !restoreSpreadsheetTriggerRef.current) return;
    restoreSpreadsheetTriggerRef.current = false;
    spreadsheetTriggerRef.current?.focus();
  }, [active, spreadsheetOpen]);

  const finish = () => {
    selectToolRef.current?.focus();
    setPlacementError(null);
    setSpreadsheetOpen(false);
    setActiveTool('select');
    onAuthoringChange(documentEpoch, false);
  };

  return {
    placementError,
    spreadsheetOpen,
    spreadsheetTriggerRef,
    openSpreadsheet: () => { setPlacementError(null); setSpreadsheetOpen(true); },
    resetSpreadsheet: () => {
      setPlacementError(null);
      restoreSpreadsheetTriggerRef.current = false;
      setSpreadsheetOpen(false);
    },
    cancelSpreadsheet: () => {
      restoreSpreadsheetTriggerRef.current = true;
      setSpreadsheetOpen(false);
    },
    cancel: finish,
    place: (coordinates: readonly [number, number]) => {
      onCreatePoi(coordinates);
      finish();
    },
    placeSearchResult: (coordinates: readonly [number, number], label: string, providerFeatureId: string) => {
      const id = onCreateSearchPoi({
        coordinate: [...coordinates] as [number, number],
        label: boundedSearchLabel(label),
        providerFeatureId,
      }, documentEpoch);
      if (!id) {
        setPlacementError('That search result could not be added. Choose another result or place the POI on the map.');
        return;
      }
      finish();
    },
    submitSpreadsheet: (entries: readonly PoiSpreadsheetEntry[]) => {
      onCreatePoiBatch(entries, documentEpoch);
      finish();
    },
  };
}
