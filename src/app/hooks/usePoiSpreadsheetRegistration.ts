import { useCallback, useMemo, useRef, useState } from 'react';
import type { PoiSpreadsheetController, PoiSpreadsheetRegistration } from './poiSpreadsheetController';
import type { ProjectMutationResult } from '../../domain/projectMutation';

export function usePoiSpreadsheetRegistration(documentEpoch: number) {
  const ownerRef = useRef<PoiSpreadsheetController | null>(null);
  const [work, setWork] = useState<{ owner: PoiSpreadsheetController; hasWork: boolean } | null>(null);
  const register = useCallback((owner: PoiSpreadsheetController) => {
    ownerRef.current = owner;
    return () => {
      if (ownerRef.current !== owner) return;
      ownerRef.current = null;
      setWork(null);
    };
  }, []);
  const reportWork = useCallback((owner: PoiSpreadsheetController, hasWork: boolean) => {
    if (ownerRef.current !== owner) return;
    setWork((current) => current?.owner === owner && current.hasWork === hasWork ? current : { owner, hasWork });
  }, []);
  const registration = useMemo<PoiSpreadsheetRegistration>(() => ({ register, reportWork }), [register, reportWork]);
  return {
    registration,
    hasWork: work?.owner.documentEpoch === documentEpoch && work.hasWork,
    requestToolChange: useCallback((tool: string, onApproved?: () => ProjectMutationResult) => ownerRef.current?.requestToolChange(tool, onApproved) ?? true, []),
    retire: useCallback(() => ownerRef.current?.retire(), []),
  };
}
