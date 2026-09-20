import { createInitialProjectDocument, type ContentLayer } from '../../src/domain/project';
import { installPointEditing, type PointEditingMarker } from '../../src/map/PointEditing';

function harness() {
  const setData = vi.fn();
  const source = { setData };
  const map = {
    getSource: vi.fn(() => source),
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
  it('retains its handle and acknowledges accepted source previews across commits and undo', () => {
    const harness_ = harness();
    const commit = vi.fn(() => ({ ok: true as const }));
    const layer = coffee();
    const session = installPointEditing(harness_.map as never, layer, commit, harness_.createMarker);
    const node = harness_.element;
    harness_.setCoordinate({ lng: 16.4, lat: 48.25 });
    harness_.trigger('drag');
    harness_.trigger('dragend');
    expect(harness_.setData).toHaveBeenCalledOnce();
    const changed: ContentLayer = { ...layer, name: 'Moved coffee', geometry: { type: 'Point', coordinates: [16.4, 48.25] } };
    expect(session.synchronizeLayer(changed)).toBe(true);
    expect(harness_.element).toBe(node);
    expect(node).toHaveAccessibleName('Move Moved coffee');
    expect(harness_.marker.remove).not.toHaveBeenCalled();
    expect(session.synchronizeLayer(layer)).toBe(true);
    expect(harness_.marker.getLngLat()).toEqual({ lng: 16.3725, lat: 48.2084 });
    expect(harness_.setData).toHaveBeenCalledOnce();
    expect(session.synchronizeLayer({ ...layer, locked: true })).toBe(false);
    session();
    expect(harness_.marker.remove).toHaveBeenCalledOnce();
  });

  it('previews drag movement and commits the final coordinate once', () => {
    const session = harness();
    const commit = vi.fn(() => ({ ok: true as const }));
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
    const commit = vi.fn(() => ({ ok: true as const }));
    installPointEditing(session.map as never, coffee(), commit, session.createMarker);
    session.element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));
    expect(commit).toHaveBeenCalledWith([17.1725, 48.2084]);

    const lockedSession = harness();
    const layer = coffee();
    layer.locked = true;
    installPointEditing(lockedSession.map as never, layer, commit, lockedSession.createMarker);
    expect(lockedSession.marker.addTo).not.toHaveBeenCalled();
  });

  it('rolls back marker and source previews on rejected pointer and keyboard commits', () => {
    const session = harness();
    const layer = coffee();
    const commit = vi.fn(() => ({ ok: false as const, error: 'Portable byte limit' }));
    const parent = document.createElement('div');
    const bubbledKey = vi.fn();
    parent.append(session.element);
    parent.addEventListener('keydown', bubbledKey);
    installPointEditing(session.map as never, layer, commit, session.createMarker);
    const original = layer.geometry?.type === 'Point' ? layer.geometry.coordinates : [];
    session.setCoordinate({ lng: 16.4, lat: 48.25 });
    session.trigger('drag');
    session.trigger('dragend');
    expect(session.marker.setLngLat).toHaveBeenLastCalledWith(original);
    expect(session.setData).toHaveBeenLastCalledWith(expect.objectContaining({ geometry: { type: 'Point', coordinates: original } }));
    session.element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));
    expect(commit).toHaveBeenCalledTimes(2);
    expect(bubbledKey).not.toHaveBeenCalled();
    expect(session.marker.setLngLat).toHaveBeenLastCalledWith(original);
  });
});
