import { useEffect, useRef } from 'react';
import type { ProjectDocument } from '../domain/project';

export function useRemixRequest(
  document: ProjectDocument | undefined,
  isBlocked: boolean,
  open: (document: ProjectDocument) => void,
) {
  const consumed = useRef(false);
  useEffect(() => {
    if (!document || isBlocked || consumed.current) return;
    consumed.current = true;
    open(document);
  }, [isBlocked, document, open]);
}
