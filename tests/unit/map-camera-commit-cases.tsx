import { act, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { Mock } from 'vitest';
import { MapCanvas } from '../../src/map/MapCanvas';
import { createProjectStore } from '../../src/app/store';
import type { CameraSettings } from '../../src/domain/project';
import { byteBudgetProject } from '../fixtures/portableBudget';

type Harness = {
  adapterSync: Mock; mapJumpTo: Mock;
  mapBearing: number; mapCenter: { lng: number; lat: number }; mapPitch: number; mapZoom: number;
};

export function registerCameraCommitCases(baseProps: Omit<ComponentProps<typeof MapCanvas>, 'selectedId'>, mocks: Harness, emit: (event: string) => void) {
  it('publishes the complete canonical camera when map movement finishes', async () => {
    const onCameraViewportChange = vi.fn(() => ({ ok: true as const }));
    render(<MapCanvas {...baseProps} selectedId={null} onCameraViewportChange={onCameraViewportChange} />);
    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(1));
    mocks.mapBearing = 35; mocks.mapCenter = { lng: 16.41, lat: 48.23 }; mocks.mapPitch = 20; mocks.mapZoom = 13.5;
    act(() => emit('moveend'));
    expect(onCameraViewportChange).toHaveBeenCalledOnce();
    expect(onCameraViewportChange).toHaveBeenCalledWith([16.41, 48.23], 13.5, 'history', { bearing: 35, pitch: 20 });
  });

  it('normalizes a wrapped world longitude before publishing the viewport', async () => {
    const onCameraViewportChange = vi.fn(() => ({ ok: true as const }));
    render(<MapCanvas {...baseProps} selectedId={null} onCameraViewportChange={onCameraViewportChange} />);
    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(1));
    mocks.mapCenter = { lng: 190, lat: 48.23 };
    act(() => emit('moveend'));
    expect(onCameraViewportChange).toHaveBeenCalledWith([-170, 48.23], 11.2, 'history', { bearing: 0, pitch: 0 });
  });

  it('rolls rejected native movement and diagnostics back to the latest canonical camera without recursion or lost redo', async () => {
    const store = createProjectStore(byteBudgetProject());
    const staleCamera = store.getState().document.camera;
    store.getState().setCameraBearing(1);
    store.getState().setProjectTitle(store.getState().document.title.replace('X', 'Y'));
    store.getState().undo();
    const before = store.getState();
    const changed = vi.fn();
    const unsubscribe = store.subscribe(changed);
    const commit = vi.fn(store.getState().setCameraViewport);
    render(<MapCanvas {...baseProps} selectedId={null} camera={staleCamera} getCanonicalCamera={() => store.getState().document.camera} onCameraViewportChange={commit} />);
    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(1));
    mocks.mapJumpTo.mockImplementation((camera: CameraSettings) => {
      mocks.mapCenter = { lng: camera.center[0], lat: camera.center[1] };
      mocks.mapZoom = camera.zoom; mocks.mapBearing = camera.bearing; mocks.mapPitch = camera.pitch;
      emit('moveend');
    });
    mocks.mapCenter = { lng: 16.123456, lat: 48.123456 }; mocks.mapZoom = 11.123456;
    act(() => emit('moveend'));
    expect(commit).toHaveBeenCalledOnce();
    expect(store.getState()).toBe(before);
    expect(changed).not.toHaveBeenCalled();
    expect(before.canRedo).toBe(true);
    expect(mocks.mapJumpTo).toHaveBeenLastCalledWith({
      center: before.document.camera.center, zoom: before.document.camera.zoom,
      bearing: 1, pitch: before.document.camera.pitch,
    });
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-map-bearing', '1');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-map-zoom', String(before.document.camera.zoom));
    expect(screen.getByRole('alert', { name: 'Camera change not saved' })).toHaveTextContent('Previous map view restored');
    unsubscribe();
  }, 30_000);
}
