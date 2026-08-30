import { describe, expect, it, vi } from "vitest";
import {
  installDraftRouteEditing,
  type DraftRouteMarker,
} from "../../src/map/DraftRouteEditing";

class FakeMarker implements DraftRouteMarker {
  coordinate = { lng: 0, lat: 0 };
  handlers = new Map<string, () => void>();
  removed = false;
  constructor(readonly element: HTMLElement) {}
  addTo() {
    document.body.append(this.element);
    return this;
  }
  getElement() { return this.element; }
  getLngLat() { return this.coordinate; }
  on(event: "dragstart" | "drag" | "dragend", handler: () => void) {
    this.handlers.set(event, handler);
    return this;
  }
  remove() {
    this.removed = true;
    this.element.remove();
  }
  setLngLat([lng, lat]: readonly [number, number]) {
    this.coordinate = { lng, lat };
    return this;
  }
  emit(event: "dragstart" | "drag" | "dragend") {
    this.handlers.get(event)?.();
  }
}

describe("draft route map handles", () => {
  it("provides 44px-classed accessible pointer and keyboard handles", () => {
    const markers: FakeMarker[] = [];
    const begin = vi.fn();
    const commit = vi.fn();
    const preview = vi.fn(() => true);
    const map = {
      project: ([lng, lat]: readonly [number, number]) => ({ x: lng, y: lat }),
      unproject: ({ x, y }: { x: number; y: number }) => ({ lng: x, lat: y }),
    };
    const session = installDraftRouteEditing(
      map as never,
      {
        active: true,
        focusRequest: { index: -1, request: 0 },
        onMoveBegin: begin,
        onMoveCommit: commit,
        onMovePreview: preview,
        points: [[0, 0], [1, 1]],
      },
      (element) => {
        const marker = new FakeMarker(element);
        markers.push(marker);
        return marker;
      },
    );

    expect(markers[0].element).toHaveClass("draft-route-point-marker");
    expect(markers[0].element).toHaveAttribute(
      "aria-label",
      "Move draft route point 1",
    );
    markers[1].coordinate = { lng: 2, lat: 3 };
    markers[1].emit("dragstart");
    markers[1].emit("drag");
    markers[1].emit("dragend");
    expect(begin).toHaveBeenCalledOnce();
    expect(preview).toHaveBeenLastCalledWith(1, [2, 3]);
    expect(commit).toHaveBeenCalledOnce();

    markers[0].element.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }),
    );
    expect(preview).toHaveBeenLastCalledWith(0, [8, 0]);
    expect(commit).toHaveBeenCalledTimes(2);

    session.focusPoint(1);
    expect(markers[1].element).toHaveFocus();
    session.update([[4, 4], [5, 5]]);
    expect(markers[1].element).toHaveFocus();
    expect(markers[1].coordinate).toEqual({ lng: 5, lat: 5 });
    session.destroy();
    expect(markers.every((marker) => marker.removed)).toBe(true);
  });

  it("rejects invalid previews without committing them", () => {
    const markers: FakeMarker[] = [];
    const commit = vi.fn();
    installDraftRouteEditing(
      {
        project: ([x, y]: readonly [number, number]) => ({ x, y }),
        unproject: ({ x, y }: { x: number; y: number }) => ({ lng: x, lat: y }),
      } as never,
      {
        active: true,
        focusRequest: { index: -1, request: 0 },
        onMoveBegin: vi.fn(),
        onMoveCommit: commit,
        onMovePreview: () => false,
        points: [[0, 0]],
      },
      (element) => {
        const marker = new FakeMarker(element);
        markers.push(marker);
        return marker;
      },
    );
    markers[0].coordinate = { lng: 2, lat: 2 };
    markers[0].emit("dragend");
    expect(markers[0].coordinate).toEqual({ lng: 0, lat: 0 });
    expect(commit).not.toHaveBeenCalled();
  });
});
