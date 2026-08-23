import { useCallback, useState } from 'react';
import type { MapLocationRequest } from '../../map/MapLocationRequest';

const EMPTY_REQUEST: MapLocationRequest = { request: 0 };

export function useMapLocationCommand(documentEpoch: number) {
  const [state, setState] = useState({ documentEpoch, request: EMPTY_REQUEST });
  const locate = useCallback((coordinate: [number, number], onApplied: () => void) => {
    setState((current) => ({
      documentEpoch,
      request: {
        coordinate,
        onApplied,
        request: current.documentEpoch === documentEpoch ? current.request.request + 1 : 1,
        scope: documentEpoch,
      },
    }));
  }, [documentEpoch]);
  return { locate, request: state.documentEpoch === documentEpoch ? state.request : EMPTY_REQUEST };
}
