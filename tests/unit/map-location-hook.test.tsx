import { createRef } from 'react';
import { renderHook } from '@testing-library/react';
import { useMapLocationRequest } from '../../src/map/useMapLocationRequest';

it('consumes a location request once instead of replaying it after a style change', () => {
  const easeTo = vi.fn();
  const map = { easeTo, getZoom: () => 11.2 };
  const mapReference = createRef<typeof map>();
  mapReference.current = map;
  const container = createRef<HTMLDivElement>();
  const request = { coordinate: [16.4, 48.2] as const, onApplied: vi.fn(), request: 1 };
  const view = renderHook(({ stylePreset }) => useMapLocationRequest({
    container,
    locationRequest: request,
    map: mapReference as never,
    stylePreset,
  }), { initialProps: { stylePreset: 'paper' } });

  expect(easeTo).toHaveBeenCalledOnce();
  view.rerender({ stylePreset: 'night-ink' });
  expect(easeTo).toHaveBeenCalledOnce();
  expect(request.onApplied).toHaveBeenCalledOnce();
});

it('accepts request one again after the project scope changes', () => {
  const easeTo = vi.fn();
  const mapReference = createRef<{ easeTo: typeof easeTo; getZoom: () => number }>();
  mapReference.current = { easeTo, getZoom: () => 11.2 };
  const container = createRef<HTMLDivElement>();
  const view = renderHook(({ scope }) => useMapLocationRequest({
    container,
    locationRequest: { coordinate: [16.4, 48.2], request: 1, scope },
    map: mapReference as never,
    stylePreset: 'paper',
  }), { initialProps: { scope: 1 } });

  expect(easeTo).toHaveBeenCalledOnce();
  view.rerender({ scope: 2 });
  expect(easeTo).toHaveBeenCalledTimes(2);
});

it('does not acknowledge a non-Mercator location request', () => {
  const easeTo = vi.fn(); const onApplied = vi.fn();
  const mapReference = createRef<{ easeTo: typeof easeTo; getZoom: () => number }>();
  mapReference.current = { easeTo, getZoom: () => 11.2 };
  renderHook(() => useMapLocationRequest({
    container: createRef<HTMLDivElement>(),
    locationRequest: { coordinate: [16.4, 86], onApplied, request: 1 },
    map: mapReference as never,
    stylePreset: 'paper',
  }));

  expect(easeTo).not.toHaveBeenCalled(); expect(onApplied).not.toHaveBeenCalled();
});
