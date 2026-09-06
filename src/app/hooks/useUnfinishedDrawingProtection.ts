import { useLayoutEffect } from 'react';
import { useBeforeUnloadWarning } from './useBeforeUnloadWarning';

export function useUnfinishedDrawingProtection(
  documentEpoch: number,
  hasUnfinishedDrawing: boolean,
  onChange?: (documentEpoch: number, hasUnfinishedDrawing: boolean) => void,
) {
  useLayoutEffect(() => {
    onChange?.(documentEpoch, hasUnfinishedDrawing);
  }, [documentEpoch, hasUnfinishedDrawing, onChange]);
  useLayoutEffect(() => () => onChange?.(documentEpoch, false), [documentEpoch, onChange]);
  useBeforeUnloadWarning(hasUnfinishedDrawing);
}
