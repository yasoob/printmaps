import { act, renderHook } from '@testing-library/react';
import type { IsochroneProvider, IsochroneResponse } from '../../../src/services/mapbox/contracts';
import { useIsochroneAuthoring } from '../../../src/app/hooks/useIsochroneAuthoring';

const geometry: IsochroneResponse['geometry'] = {
  type: 'Polygon' as const,
  coordinates: [[[16.35, 48.2], [16.4, 48.2], [16.4, 48.24], [16.35, 48.2]]],
};
const response: IsochroneResponse = {
  geometry,
  useBoundary: 'provider-response-use-requires-terms-review',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}

describe('isochrone authoring lifecycle', () => {
  it('generates one durable Area from the selected center and settings', async () => {
    const provider: IsochroneProvider = { isochrone: vi.fn(async () => response) };
    const onCreate = vi.fn(() => 'isochrone-01');
    const onCreated = vi.fn();
    const { result } = renderHook(() => useIsochroneAuthoring({
      active: true, documentEpoch: 4, onCreate, onCreated, provider,
    }));

    act(() => result.current.setCenter({ coordinate: [16.3725, 48.2084], label: 'Vienna' }));
    act(() => result.current.setMinutes(20));
    act(() => result.current.setProfile('cycling'));
    await act(async () => result.current.generate());

    expect(provider.isochrone).toHaveBeenCalledWith(expect.objectContaining({
      center: [16.3725, 48.2084], minutes: 20, profile: 'cycling', signal: expect.any(AbortSignal),
    }));
    expect(onCreate).toHaveBeenCalledWith({
      center: [16.3725, 48.2084], geometry, label: '20 min cycling area', minutes: 20, profile: 'cycling',
    }, 4);
    expect(onCreated).toHaveBeenCalledWith('isochrone-01');
    expect(result.current.error).toBeNull();
  });

  it('cancels an in-flight generation when the center changes', async () => {
    const pending = deferred<IsochroneResponse>();
    const provider: IsochroneProvider = { isochrone: vi.fn(() => pending.promise) };
    const onCreate = vi.fn(() => 'isochrone-01');
    const { result } = renderHook(() => useIsochroneAuthoring({
      active: true, documentEpoch: 1, onCreate, provider,
    }));
    act(() => result.current.setCenter({ coordinate: [16, 48], label: 'First' }));
    let request!: Promise<void>;
    await act(async () => { request = result.current.generate(); });

    act(() => result.current.setCenter({ coordinate: [17, 49], label: 'Second' }));
    pending.resolve(response);
    await act(async () => request);

    expect((provider.isochrone as ReturnType<typeof vi.fn>).mock.calls[0][0].signal.aborted).toBe(true);
    expect(onCreate).not.toHaveBeenCalled();
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.center).toEqual({ coordinate: [17, 49], label: 'Second' });
  });

  it('cancels an in-flight generation when the travel mode changes', async () => {
    const pending = deferred<IsochroneResponse>();
    const provider: IsochroneProvider = { isochrone: vi.fn(() => pending.promise) };
    const onCreate = vi.fn(() => 'isochrone-01');
    const { result } = renderHook(() => useIsochroneAuthoring({
      active: true, documentEpoch: 1, onCreate, provider,
    }));
    act(() => result.current.setCenter({ coordinate: [16, 48], label: 'Center' }));
    let request!: Promise<void>;
    await act(async () => { request = result.current.generate(); });

    act(() => result.current.setProfile('cycling'));
    pending.resolve(response);
    await act(async () => request);

    expect((provider.isochrone as ReturnType<typeof vi.fn>).mock.calls[0][0].signal.aborted).toBe(true);
    expect(onCreate).not.toHaveBeenCalled();
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.profile).toBe('cycling');
  });

  it('cancels an in-flight generation when the duration changes', async () => {
    const pending = deferred<IsochroneResponse>();
    const provider: IsochroneProvider = { isochrone: vi.fn(() => pending.promise) };
    const onCreate = vi.fn(() => 'isochrone-01');
    const { result } = renderHook(() => useIsochroneAuthoring({
      active: true, documentEpoch: 1, onCreate, provider,
    }));
    act(() => result.current.setCenter({ coordinate: [16, 48], label: 'Center' }));
    let request!: Promise<void>;
    await act(async () => { request = result.current.generate(); });

    act(() => result.current.setMinutes(30));
    pending.resolve(response);
    await act(async () => request);

    expect((provider.isochrone as ReturnType<typeof vi.fn>).mock.calls[0][0].signal.aborted).toBe(true);
    expect(onCreate).not.toHaveBeenCalled();
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.minutes).toBe(30);
  });

  it('clears the pending state when area authoring is deactivated', async () => {
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
    rerender({ active: true });

    expect((provider.isochrone as ReturnType<typeof vi.fn>).mock.calls[0][0].signal.aborted).toBe(true);
    expect(result.current.isGenerating).toBe(false);
    pending.resolve(response);
    await act(async () => request);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('clears the selected center when the document changes', () => {
    const onCreate = vi.fn(() => 'isochrone-01');
    const { result, rerender } = renderHook(({ documentEpoch }) => useIsochroneAuthoring({
      active: true,
      documentEpoch,
      onCreate,
    }), { initialProps: { documentEpoch: 1 } });
    act(() => result.current.setCenter({ coordinate: [16, 48], label: 'Old document center' }));

    rerender({ documentEpoch: 2 });

    expect(result.current.center).toBeNull();
  });

  it('aborts a replaced request and suppresses a response from an old document epoch', async () => {
    const first = deferred<IsochroneResponse>();
    const second = deferred<IsochroneResponse>();
    const provider: IsochroneProvider = {
      isochrone: vi.fn()
        .mockImplementationOnce(({ signal }) => {
          signal?.addEventListener('abort', () => first.resolve(response));
          return first.promise;
        })
        .mockImplementationOnce(() => second.promise),
    };
    const onCreate = vi.fn(() => 'isochrone-01');
    const { result, rerender } = renderHook(({ documentEpoch }) => useIsochroneAuthoring({
      active: true, documentEpoch, onCreate, provider,
    }), { initialProps: { documentEpoch: 1 } });
    act(() => result.current.setCenter({ coordinate: [16, 48], label: 'First' }));
    let firstRequest!: Promise<void>;
    await act(async () => { firstRequest = result.current.generate(); });
    let secondRequest!: Promise<void>;
    await act(async () => { secondRequest = result.current.generate(); });
    rerender({ documentEpoch: 2 });
    second.resolve(response);
    await act(async () => Promise.all([firstRequest, secondRequest]));

    expect((provider.isochrone as ReturnType<typeof vi.fn>).mock.calls[0][0].signal.aborted).toBe(true);
    expect(onCreate).not.toHaveBeenCalled();
  });
});
