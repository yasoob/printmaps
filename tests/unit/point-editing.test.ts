import { createInitialProjectDocument, type ContentLayer } from '../../src/domain/project';
import { installPointEditing, type PointEditingMarker } from '../../src/map/PointEditing';

function harness() {
  const setData = vi.fn();
  const map = {
    getSource: vi.fn(() => ({ setData })),
    project: vi.fn(([lng, lat]: readonly [number, number]) => ({ x: lng * 10, y: lat * 10 })),
    unproject: vi.fn(({ x, y }: { x: number; y: number }) => ({ lng: x / 10, lat: y / 10 })),
  };
  const handlers = new Map<string, () => void>();
  let coordinate = { lng: 16.3725, lat: 48.2084 };
  let element: HTMLElement | null = null;
  const marker: PointEditingMarker = {
    addTo: vi.fn(() => marker),
    getElement: () => element!,
    getLngLat: () => coordinate,
    on: vi.fn((event, handler) => { handlers.set(event, handler); return marker; }),
    remove: vi.fn(),
    setLngLat: vi.fn((next) => {
      coordinate = { lng: next[0], lat: next[1] };
      return marker;
    }),
  };
  return {
    createMarker: (nextElement: HTMLElement) => { element = nextElement; return marker; },
    map,
    marker,
    setCoordinate: (next: { lng: number; lat: number }) => { coordinate = next; },
    setData,
    trigger: (event: 'drag' | 'dragend') => handlers.get(event)?.(),
    get element() { return element!; },
  };
}

function coffee(): ContentLayer {
  return structuredClone(createInitialProjectDocument().layers.find(({ id }) => id === 'poi-cafe')!);
}

describe('Place marker direct editing', () => {
  it('previews drag movement and commits the final coordinate once', () => {
    const session = harness();
    const commit = vi.fn();
    const cleanup = installPointEditing(session.map as never, coffee(), commit, session.createMarker);

    expect(session.element).toHaveAccessibleName('Move Coffee stop');
    session.setCoordinate({ lng: 16.4, lat: 48.25 });
    session.trigger('drag');
    expect(session.setData).toHaveBeenLastCalledWith(expect.objectContaining({
      geometry: { type: 'Point', coordinates: [16.4, 48.25] },
    }));
    expect(commit).not.toHaveBeenCalled();

    session.trigger('dragend');
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith([16.4, 48.25]);
    cleanup();
    expect(session.marker.remove).toHaveBeenCalledOnce();
  });

  it('supports keyboard nudging and excludes locked Place layers', () => {
    const session = harness();
    const commit = vi.fn();
    installPointEditing(session.map as never, coffee(), commit, session.createMarker);
    session.element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));
    expect(commit).toHaveBeenCalledWith([17.1725, 48.2084]);

    const lockedSession = harness();
    const layer = coffee();
    layer.locked = true;
    installPointEditing(lockedSession.map as never, layer, commit, lockedSession.createMarker);
    expect(lockedSession.marker.addTo).not.toHaveBeenCalled();
  });
});
