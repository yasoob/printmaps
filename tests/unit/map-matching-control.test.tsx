import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LayerProperties } from '../../src/app/components/LayerProperties';
import type { ContentLayer } from '../../src/domain/project';
import { PROVIDER_RESPONSE_USE_REQUIRES_TERMS_REVIEW, type MapMatchingProvider } from '../../src/services/mapbox';

const route: ContentLayer = {
  id: 'route-01', name: 'Imported walk', type: 'route', visible: true, locked: false, opacity: 100,
  appearance: { kind: 'route', color: '#d9363e', width: 4, travelProfile: 'walk', showTravelModeIcon: false },
  geometry: { type: 'LineString', coordinates: [[16.35, 48.2], [16.36, 48.205], [16.37, 48.21]] },
};

const matched = [[16.3501, 48.2001], [16.36, 48.2052], [16.3702, 48.2101]] as const;

describe('selected route map matching', () => {
  beforeEach(() => {
    window.localStorage.removeItem('print-map-studio:inspector:layer:route-advanced');
  });

  it('matches the selected route to roads as one canonical edit', async () => {
    const user = userEvent.setup();
    const match = vi.fn<MapMatchingProvider['match']>(async () => ({
      matches: [{ geometry: matched, confidence: 0.93 }],
      useBoundary: PROVIDER_RESPONSE_USE_REQUIRES_TERMS_REVIEW,
    }));
    const onApplyMapMatching = vi.fn(() => true);
    render(<LayerProperties
      layer={route}
      assets={{}}
      documentEpoch={7}
      mapMatchingProvider={{ match }}
      onApplyMapMatching={onApplyMapMatching}
      onAppearanceChange={vi.fn()} onDelete={vi.fn()} onDuplicate={vi.fn()} onOpacityChange={vi.fn()}
      onPoiCoordinatesChange={vi.fn()} onPoiCustomMarkerChange={vi.fn()} onRename={vi.fn()} onReplace={vi.fn()}
      onRouteVertexChange={vi.fn()} onRouteVertexInsert={vi.fn()} onRouteVertexRemove={vi.fn()}
      onShapeVertexChange={vi.fn()} onToggleLock={vi.fn()} onToggleVisibility={vi.fn()}
    />);

    await user.click(screen.getByRole('button', { name: /Advanced/ }));
    await user.click(screen.getByRole('button', { name: 'Snap route to roads' }));

    expect(match).toHaveBeenCalledWith({
      profile: 'walking',
      signal: expect.any(AbortSignal),
      trace: route.geometry?.type === 'LineString' ? route.geometry.coordinates : [],
    });
    expect(onApplyMapMatching).toHaveBeenCalledWith({
      geometry: matched,
      profile: 'walking',
      confidence: 0.93,
      sourcePointCount: 3,
    }, 7);
    expect(await screen.findByRole('status', { name: 'Map matching status' })).toHaveTextContent('Route matched to roads');
  });

  it('cancels an in-flight match when the project document changes', async () => {
    const user = userEvent.setup();
    let resolveMatch!: (value: Awaited<ReturnType<MapMatchingProvider['match']>>) => void;
    let requestSignal: AbortSignal | undefined;
    const match = vi.fn<MapMatchingProvider['match']>((request) => {
      requestSignal = request.signal;
      return new Promise((resolve) => { resolveMatch = resolve; });
    });
    const onApplyMapMatching = vi.fn(() => true);
    const common = {
      layer: route, assets: {}, mapMatchingProvider: { match }, onApplyMapMatching,
      onAppearanceChange: vi.fn(), onDelete: vi.fn(), onDuplicate: vi.fn(), onOpacityChange: vi.fn(),
      onPoiCoordinatesChange: vi.fn(), onPoiCustomMarkerChange: vi.fn(), onRename: vi.fn(), onReplace: vi.fn(),
      onRouteVertexChange: vi.fn(), onRouteVertexInsert: vi.fn(), onRouteVertexRemove: vi.fn(),
      onShapeVertexChange: vi.fn(), onToggleLock: vi.fn(), onToggleVisibility: vi.fn(),
    };
    const view = render(<LayerProperties {...common} documentEpoch={7} />);
    await user.click(screen.getByRole('button', { name: /Advanced/ }));
    await user.click(screen.getByRole('button', { name: 'Snap route to roads' }));

    view.rerender(<LayerProperties {...common} documentEpoch={8} />);

    expect(requestSignal?.aborted).toBe(true);
    expect(screen.getByRole('button', { name: 'Snap route to roads' })).toBeEnabled();
    expect(screen.queryByRole('status', { name: 'Map matching status' })).not.toBeInTheDocument();
    resolveMatch({ matches: [{ geometry: matched, confidence: 0.93 }], useBoundary: PROVIDER_RESPONSE_USE_REQUIRES_TERMS_REVIEW });
    await Promise.resolve();
    expect(onApplyMapMatching).not.toHaveBeenCalled();
  });

  it('clears a stale success message when the selected route changes', async () => {
    const user = userEvent.setup();
    const match = vi.fn<MapMatchingProvider['match']>(async () => ({
      matches: [{ geometry: matched, confidence: 0.93 }],
      useBoundary: PROVIDER_RESPONSE_USE_REQUIRES_TERMS_REVIEW,
    }));
    const common = {
      assets: {}, documentEpoch: 7, mapMatchingProvider: { match }, onApplyMapMatching: vi.fn(() => true),
      onAppearanceChange: vi.fn(), onDelete: vi.fn(), onDuplicate: vi.fn(), onOpacityChange: vi.fn(),
      onPoiCoordinatesChange: vi.fn(), onPoiCustomMarkerChange: vi.fn(), onRename: vi.fn(), onReplace: vi.fn(),
      onRouteVertexChange: vi.fn(), onRouteVertexInsert: vi.fn(), onRouteVertexRemove: vi.fn(),
      onShapeVertexChange: vi.fn(), onToggleLock: vi.fn(), onToggleVisibility: vi.fn(),
    };
    const view = render(<LayerProperties {...common} layer={route} />);
    await user.click(screen.getByRole('button', { name: /Advanced/ }));
    await user.click(screen.getByRole('button', { name: 'Snap route to roads' }));
    expect(await screen.findByRole('status', { name: 'Map matching status' })).toBeVisible();

    const replacementRoute: ContentLayer = {
      ...route,
      id: 'route-02',
      name: 'Replacement route',
      geometry: { type: 'LineString', coordinates: [[16.4, 48.2], [16.41, 48.21]] },
    };
    view.rerender(<LayerProperties {...common} layer={replacementRoute} />);

    expect(screen.queryByRole('status', { name: 'Map matching status' })).not.toBeInTheDocument();
  });
});
