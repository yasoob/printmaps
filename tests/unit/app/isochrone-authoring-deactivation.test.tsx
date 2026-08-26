import { act, renderHook } from '@testing-library/react';
import type { IsochroneProvider, IsochroneResponse } from '../../../src/services/mapbox/contracts';
import { useIsochroneAuthoring } from '../../../src/app/hooks/useIsochroneAuthoring';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useEffect: vi.fn() };
});

const response: IsochroneResponse = {
  geometry: {
    type: 'Polygon',
    coordinates: [[[16.35, 48.2], [16.4, 48.2], [16.4, 48.24], [16.35, 48.2]]],
  },
  useBoundary: 'provider-response-use-requires-terms-review',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}

describe('isochrone authoring deactivation race', () => {
  it('suppresses a successful response synchronously when authoring deactivates', async () => {
    const pending = deferred<IsochroneResponse>();
    const provider: IsochroneProvider = { isochrone: vi.fn(() => pending.promise) };
    const onCreate = vi.fn(() => 'isochrone-01');
    const { result, rerender } = renderHook(({ active }) => useIsochroneAuthoring({
      active, documentEpoch: 1, onCreate, provider,
    }), { initialProps: { active: true } });
    act(() => result.current.setCenter({ coordinate: [16, 48], label: 'Center' }));
    let request!: Promise<void>;
    await act(async () => { request = result.current.generate(); });

    rerender({ active: false });
    pending.resolve(response);
    await act(async () => request);

    expect(onCreate).not.toHaveBeenCalled();
  });
});
