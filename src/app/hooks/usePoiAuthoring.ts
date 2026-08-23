import { useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { PoiSpreadsheetEntry } from '../../domain/poiSpreadsheet';

type UsePoiAuthoringOptions = {
  active: boolean;
  documentEpoch: number;
  selectToolRef: RefObject<HTMLButtonElement | null>;
  setActiveTool: Dispatch<SetStateAction<string>>;
  onAuthoringChange: (documentEpoch: number, isActive: boolean) => void;
  onCreatePoi: (coordinates: readonly [number, number]) => void;
  onCreatePoiBatch: (entries: readonly PoiSpreadsheetEntry[]) => void;
};

export function usePoiAuthoring(options: UsePoiAuthoringOptions) {
  const [spreadsheetOpen, setSpreadsheetOpen] = useState(false);
  const spreadsheetTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreSpreadsheetTriggerRef = useRef(false);
  const { active, documentEpoch, onAuthoringChange, onCreatePoi, onCreatePoiBatch, selectToolRef, setActiveTool } = options;

  useLayoutEffect(() => {
    if (!active || spreadsheetOpen || !restoreSpreadsheetTriggerRef.current) return;
    restoreSpreadsheetTriggerRef.current = false;
    spreadsheetTriggerRef.current?.focus();
  }, [active, spreadsheetOpen]);

  const finish = () => {
    selectToolRef.current?.focus();
    setSpreadsheetOpen(false);
    setActiveTool('select');
    onAuthoringChange(documentEpoch, false);
  };

  return {
    spreadsheetOpen,
    spreadsheetTriggerRef,
    openSpreadsheet: () => setSpreadsheetOpen(true),
    resetSpreadsheet: () => {
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
    submitSpreadsheet: (entries: readonly PoiSpreadsheetEntry[]) => {
      onCreatePoiBatch(entries);
      finish();
    },
  };
}
