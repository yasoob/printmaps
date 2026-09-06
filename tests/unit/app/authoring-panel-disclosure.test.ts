import { act, renderHook } from '@testing-library/react';
import { useAuthoringPanelDisclosure } from '../../../src/app/hooks/useAuthoringPanelDisclosure';

it('starts compact on constrained screens and supports reversible settings', () => {
  const { result } = renderHook(() => useAuthoringPanelDisclosure(0, true));
  expect(result.current.settingsOpen).toBe(false);
  act(() => result.current.openSettings());
  expect(result.current.settingsOpen).toBe(true);
  act(() => result.current.closeSettings());
  expect(result.current.settingsOpen).toBe(false);
});

it('collapses when drawing resumes or the viewport becomes constrained', () => {
  const { result, rerender } = renderHook(
    ({ points, compact }) => useAuthoringPanelDisclosure(points, compact),
    { initialProps: { points: 0, compact: false } },
  );
  expect(result.current.settingsOpen).toBe(true);
  rerender({ points: 1, compact: false });
  expect(result.current.settingsOpen).toBe(false);
  act(() => result.current.openSettings());
  rerender({ points: 1, compact: true });
  expect(result.current.settingsOpen).toBe(false);
});

it('preserves expanded desktop area settings while points are added', () => {
  const { result, rerender } = renderHook(
    ({ points }) => useAuthoringPanelDisclosure(points, false, false),
    { initialProps: { points: 0 } },
  );
  rerender({ points: 1 });
  expect(result.current.settingsOpen).toBe(true);
});

it('uses point-addition intent without collapsing coordinate-entry sessions', () => {
  const { result, rerender } = renderHook(
    ({ points, mapInput }) => useAuthoringPanelDisclosure(points, true, mapInput),
    { initialProps: { points: 0, mapInput: false } },
  );
  act(() => result.current.openSettings());
  rerender({ points: 1, mapInput: false });
  rerender({ points: 2, mapInput: false });
  expect(result.current.settingsOpen).toBe(true);
  rerender({ points: 3, mapInput: true });
  expect(result.current.settingsOpen).toBe(false);
});
