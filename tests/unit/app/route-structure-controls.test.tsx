import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouteLayerProperties } from "../../../src/app/components/RouteLayerProperties";
import type { ContentLayer } from "../../../src/domain/project";
import type { DirectionsProvider } from "../../../src/services/mapbox/contracts";

function route(points = [[0, 0], [1, 1], [2, 0]] as [number, number][]): ContentLayer {
  return {
    id: "route",
    name: "Route",
    type: "route",
    route: { kind: "straight", closed: false },
    visible: true,
    locked: false,
    opacity: 100,
    appearance: {
      kind: "route",
      color: "#d9363e",
      width: 4,
      strokeStyle: "solid",
      marker: null,
      segmentStyles: Array.from({ length: points.length - 1 }, () => null),
    },
    geometry: { type: "LineString", coordinates: points },
  };
}

const baseProps = {
  onAppearanceChange: vi.fn(),
  onRouteVertexChange: vi.fn(),
  onRouteVertexInsert: vi.fn(),
  onRouteVertexRemove: vi.fn(),
};

describe("Advanced route structure controls", () => {
  beforeEach(() => {
    window.localStorage.removeItem("print-map-studio:inspector:layer:route-advanced");
  });

  it("progressively reveals Road profile and explains unavailable loop closure", async () => {
    const user = userEvent.setup();
    render(
      <RouteLayerProperties
        {...baseProps}
        layer={route([[0, 0], [1, 1]])}
        onTransformRoute={vi.fn(() => ({ ok: true as const, routeId: "route" }))}
      />,
    );

    expect(screen.queryByRole("combobox", { name: "Convert route to" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Advanced/ }));
    const close = screen.getByRole("button", { name: "Close loop" });
    expect(close).toBeDisabled();
    expect(close).toHaveAccessibleDescription(
      "Add at least three distinct points to close this route.",
    );
    expect(screen.queryByRole("combobox", { name: "Road conversion travel mode" }))
      .not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Convert route to" }),
      "road",
    );
    expect(screen.getByRole("combobox", { name: "Road conversion travel mode" }))
      .toBeVisible();
  });

  it("keeps provider choices retryable through confirmation, pending, and alert states", async () => {
    const user = userEvent.setup();
    const directions = vi.fn<DirectionsProvider["directions"]>()
      .mockRejectedValueOnce(new Error("Road service unavailable."))
      .mockResolvedValue({
        routes: [{
          geometry: [[0, 0], [1, 1], [2, 0]],
          distanceMeters: 100,
          durationSeconds: 50,
        }],
        useBoundary: "provider-response-use-requires-terms-review",
      });
    const onTransformRoute = vi.fn()
      .mockReturnValueOnce({
        ok: false as const,
        error: "This route changed before the operation finished.",
      })
      .mockReturnValue({ ok: true as const, routeId: "route" });
    render(
      <RouteLayerProperties
        {...baseProps}
        documentEpoch={4}
        directionsProvider={{ directions }}
        layer={route()}
        onTransformRoute={onTransformRoute}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Advanced/ }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Convert route to" }),
      "road",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Road conversion travel mode" }),
      "walk",
    );
    await user.click(screen.getByRole("button", { name: "Convert" }));
    expect(screen.getByRole("group", { name: "Confirm road routing" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Route and apply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Road service unavailable.");

    expect(screen.getByRole("combobox", { name: "Convert route to" })).toHaveValue("road");
    expect(screen.getByRole("combobox", { name: "Road conversion travel mode" }))
      .toHaveValue("walk");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("route changed");
    expect(onTransformRoute).toHaveBeenCalledWith(expect.objectContaining({
      expectedDocumentEpoch: 4,
      operation: { type: "convert", targetKind: "road" },
      road: expect.objectContaining({ profile: "walking" }),
    }));
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(onTransformRoute).toHaveBeenCalledTimes(2);
  });

  it("disables closing an open Road route with 25 distinct waypoints", async () => {
    const user = userEvent.setup();
    const points = Array.from({ length: 25 }, (_unused, index) => [index, 0] as [number, number]);
    const layer = route(points);
    layer.route = { kind: "road", closed: false };
    layer.provenance = {
      provider: "mapbox",
      service: "directions-v5",
      waypoints: points,
      profile: "driving",
      distanceMeters: 25,
      durationSeconds: 25,
    };
    render(
      <RouteLayerProperties
        {...baseProps}
        layer={layer}
        onTransformRoute={vi.fn(() => ({ ok: true as const, routeId: "route" }))}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Advanced/ }));
    const close = screen.getByRole("button", { name: "Close loop" });
    expect(close).toBeDisabled();
    expect(close).toHaveAccessibleDescription(
      "Closed Road routes support at most 24 distinct waypoints.",
    );
  });
});
