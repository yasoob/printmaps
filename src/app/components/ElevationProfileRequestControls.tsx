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
        <button className="quiet-button" type="button" disabled={isReadingRoute} onClick={onGenerate}>Generate elevation profile</button>
      )}
      {state.status === 'loading' && (
        <button className="quiet-button" type="button" aria-label="Cancel elevation profile request" onClick={onCancel}>Cancel terrain request</button>
      )}
      {state.status === 'loading' && <span role="status">Sampling up to 100 route points from the terrain model.</span>}
      {state.status === 'error' && <p role="alert">{state.message}</p>}
    </>
  );
}
