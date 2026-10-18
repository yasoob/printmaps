import { Notice } from '../../components/ui/notice';
import { Button } from '../../components/ui/button';
type RequestState = Readonly<{
  message?: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
}>;

export function ElevationProfileRequestControls({
  isReadingRoute,
  onCancel,
  onGenerate,
  state,
}: {
  isReadingRoute: boolean;
  onCancel: () => void;
  onGenerate: () => void;
  state: RequestState;
}) {
  return (
    <>
      {(state.status === 'idle' || state.status === 'error') && (
        <Button variant="secondary" disabled={isReadingRoute} onClick={onGenerate}>Generate elevation profile</Button>
      )}
      {state.status === 'ready' && <Button variant="secondary" disabled={isReadingRoute} onClick={onGenerate}>Refresh elevation profile</Button>}
      {state.status === 'loading' && (
        <Button variant="secondary" aria-label="Cancel elevation profile request" onClick={onCancel}>Cancel terrain request</Button>
      )}
      {state.status === 'loading' && <span role="status">Sampling up to 100 route points from the terrain model.</span>}
      {state.status === 'error' && <Notice tone="error">{state.message}</Notice>}
    </>
  );
}
