import { useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { PoiSpreadsheetEntry } from '../../domain/poiSpreadsheet';
import { MAX_POI_LABEL_CHARACTERS } from '../../domain/poiMarkers';
import type { SearchPoiInput } from '../../domain/project';
import type { LayerMutationResult, ProjectMutationResult } from '../../domain/projectMutation';
import { usePoiSpreadsheetRegistration } from './usePoiSpreadsheetRegistration';

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
  onCreatePoi: (coordinates: readonly [number, number]) => ProjectMutationResult;
  onCreatePoiBatch: (entries: readonly PoiSpreadsheetEntry[], expectedDocumentEpoch?: number) => ProjectMutationResult;
  onCreateSearchPoi: (input: SearchPoiInput, expectedDocumentEpoch: number) => LayerMutationResult;
};

export function usePoiAuthoring(options: UsePoiAuthoringOptions) {
  const spreadsheet = usePoiSpreadsheetRegistration(options.documentEpoch);
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
    spreadsheet.retire();
    selectToolRef.current?.focus();
    setPlacementError(null);
    setSpreadsheetOpen(false);
    setActiveTool('select');
    onAuthoringChange(documentEpoch, false);
  };

  return {
    placementError,
    spreadsheetOpen,
    spreadsheetRegistration: spreadsheet.registration,
    hasUnfinishedWork: active && spreadsheetOpen && spreadsheet.hasWork,
    requestToolChange: spreadsheet.requestToolChange,
    completeSpreadsheet: finish,
    spreadsheetTriggerRef,
    openSpreadsheet: () => { setPlacementError(null); setSpreadsheetOpen(true); },
    resetSpreadsheet: () => {
      spreadsheet.retire();
      setPlacementError(null);
      restoreSpreadsheetTriggerRef.current = false;
      setSpreadsheetOpen(false);
    },
    cancelSpreadsheet: () => {
      spreadsheet.retire();
      restoreSpreadsheetTriggerRef.current = true;
      setSpreadsheetOpen(false);
    },
    cancel: finish,
    place: (coordinates: readonly [number, number]) => {
      const result = onCreatePoi(coordinates);
      if (result.ok) finish();
      else setPlacementError(result.error);
    },
    placeSearchResult: (coordinates: readonly [number, number], label: string, providerFeatureId: string) => {
      const result = onCreateSearchPoi({
        coordinate: [...coordinates] as [number, number],
        label: boundedSearchLabel(label),
        providerFeatureId,
      }, documentEpoch);
      if (!result.ok) {
        setPlacementError(result.error);
        return null;
      }
      finish();
      return result.layerId;
    },
    submitSpreadsheet: (entries: readonly PoiSpreadsheetEntry[]) => {
      return onCreatePoiBatch(entries, documentEpoch);
    },
  };
}
