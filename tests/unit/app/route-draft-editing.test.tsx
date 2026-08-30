import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../../src/app/App";
import type { DirectionsProvider } from "../../../src/services/mapbox/contracts";

vi.mock("../../../src/map/MapCanvas", async () => import("./MapCanvasMock"));

function roadResponse(
  geometry: [number, number][] = [[16.31, 48.19], [16.4, 48.24]],
) {
  return {
    routes: [{ geometry, distanceMeters: 1000, durationSeconds: 120 }],
    useBoundary: "provider-response-use-requires-terms-review" as const,
  };
}

async function openAdvanced(user: ReturnType<typeof userEvent.setup>) {
  const advanced = screen.getByRole("button", { name: "Advanced" });
  if (advanced.getAttribute("aria-expanded") !== "true") {
    await user.click(advanced);
  }
}

describe("editable route drafts", () => {
  it("reorders, removes, focuses, and fully undoes semantic list edits", async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole("button", { name: "Route (R)" }));
    await user.click(screen.getByRole("button", { name: "Map route point 1" }));
    await user.click(screen.getByRole("button", { name: "Map route point 2" }));
    await user.click(screen.getByRole("button", { name: "Map route point 3" }));
    const disclosure = screen.getByText("Draft points (3)").closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    await user.click(screen.getByText("Draft points (3)"));
    const list = screen.getByRole("list", { name: "Draft route points" });

    const moveUp = within(list).getByRole("button", {
      name: "Move draft point 3 up",
    });
    await user.click(moveUp);
    expect(moveUp).toHaveFocus();
    expect(within(list).getAllByRole("listitem")[1]).toHaveTextContent(
      "16.46, 48.2",
    );

    await user.click(within(list).getByRole("button", {
      name: "Remove draft point 2",
    }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByRole("button", {
      name: "Focus draft point 2 on map",
    })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Undo last route point" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Undo last route point" }));
    expect(within(list).getAllByRole("listitem")[2]).toHaveTextContent(
      "16.46, 48.2",
    );
  });

  it("materializes an extension's full point set and preserves the route until Finish", async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    const map = screen.getByTestId("map-canvas");
    const original = map.dataset.layerGeometry;
    await user.click(screen.getByRole("button", { name: "Select Route 01" }));
    await user.click(screen.getByRole("button", { name: "Extend end" }));

    await user.click(await screen.findByText("Draft points (4)"));
    expect(screen.getByRole("list", { name: "Draft route points" }).children)
      .toHaveLength(4);
    await user.click(screen.getByRole("button", { name: "Move draft point 4 up" }));
    expect(map.dataset.layerGeometry).not.toBe(original);
    expect(map.dataset.layerGeometry).toContain(`route-01:`);
    await user.click(screen.getByRole("button", { name: "Finish route" }));
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(map.dataset.layerGeometry).toBe(original);
  });

  it("omits a closed loop's duplicate endpoint and preserves its return leg", async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole("button", { name: "Select Route 01" }));
    await openAdvanced(user);
    await user.click(screen.getByRole("button", { name: "Close loop" }));
    await user.click(screen.getByRole("button", { name: "Extend end" }));
    await user.click(await screen.findByText("Draft points (4)"));

    expect(screen.getByText(
      "The return leg closes back to point 1 automatically.",
    )).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Map route point 3" }));
    await user.click(screen.getByRole("button", { name: "Finish route" }));
    const routeGeometry = screen.getByTestId("map-canvas").dataset.layerGeometry;
    expect(routeGeometry).toContain(
      "[16.326,48.194],[16.353,48.205],[16.391,48.215],[16.429,48.226],[16.46,48.2],[16.326,48.194]",
    );
  });
});

describe("Road draft previews", () => {
  it("reuses an unchanged successful preview on Finish", async () => {
    const user = userEvent.setup();
    const directions = vi.fn<DirectionsProvider["directions"]>()
      .mockResolvedValue(roadResponse());
    render(<App autosaveRepository={null} directionsProvider={{ directions }} />);
    await user.click(screen.getByRole("button", { name: "Route (R)" }));
    await user.click(screen.getByRole("radio", { name: "Road" }));
    await user.click(screen.getByRole("button", { name: "Map route point 1" }));
    await user.click(screen.getByRole("button", { name: "Map route point 2" }));
    await user.click(screen.getByRole("button", { name: "Road Preview" }));
    expect(await screen.findByText("Road preview updated.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish route" }));

    expect(directions).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "Select Route 02" }))
      .toBeInTheDocument();
  });

  it("invalidates a preview after a semantic edit and routes again on Finish", async () => {
    const user = userEvent.setup();
    const directions = vi.fn<DirectionsProvider["directions"]>()
      .mockResolvedValue(roadResponse());
    render(<App autosaveRepository={null} directionsProvider={{ directions }} />);
    await user.click(screen.getByRole("button", { name: "Route (R)" }));
    await user.click(screen.getByRole("radio", { name: "Road" }));
    await user.click(screen.getByRole("button", { name: "Map route point 1" }));
    await user.click(screen.getByRole("button", { name: "Map route point 2" }));
    await user.click(screen.getByRole("button", { name: "Road Preview" }));
    await screen.findByText("Road preview updated.");
    await user.click(screen.getByRole("button", { name: "Map route point 3" }));
    await user.click(screen.getByRole("button", { name: "Finish route" }));

    expect(directions).toHaveBeenCalledTimes(2);
  });

  it("never commits a pending Finish response after a drag preview mutates the draft", async () => {
    const user = userEvent.setup();
    let resolve!: (value: ReturnType<typeof roadResponse>) => void;
    const pending = new Promise<ReturnType<typeof roadResponse>>((done) => {
      resolve = done;
    });
    const directions = vi.fn<DirectionsProvider["directions"]>()
      .mockReturnValue(pending);
    render(<App autosaveRepository={null} directionsProvider={{ directions }} />);
    await user.click(screen.getByRole("button", { name: "Route (R)" }));
    await user.click(screen.getByRole("radio", { name: "Road" }));
    await user.click(screen.getByRole("button", { name: "Map route point 1" }));
    await user.click(screen.getByRole("button", { name: "Map route point 2" }));
    await user.click(screen.getByRole("button", { name: "Finish route" }));

    await user.click(screen.getByRole("button", {
      name: "Preview drag route point 1",
    }));
    expect(directions.mock.calls[0]?.[0].signal?.aborted).toBe(true);
    resolve(roadResponse());
    await pending;

    expect(screen.queryByRole("button", { name: "Select Route 02" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Route drawing status" }))
      .toHaveTextContent("2 points");
  });

  it("reuses an unchanged extension preview and commits only on Finish", async () => {
    const user = userEvent.setup();
    const directions = vi.fn<DirectionsProvider["directions"]>()
      .mockImplementation(async ({ waypoints }) =>
        roadResponse(waypoints.map(([longitude, latitude]) => [
          longitude,
          latitude,
        ]))
      );
    render(<App autosaveRepository={null} directionsProvider={{ directions }} />);
    await user.click(screen.getByRole("button", { name: "Select Route 01" }));
    await openAdvanced(user);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Convert route to" }),
      "road",
    );
    await user.click(screen.getByRole("button", { name: "Convert" }));
    await user.click(screen.getByRole("button", { name: "Route and apply" }));
    await screen.findByText("Mapbox Directions");
    expect(directions).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Extend end" }));
    const map = screen.getByTestId("map-canvas");
    expect(map.dataset.layerGeometry).toContain("route-01:");
    expect(map.dataset.layerGeometry).not.toContain("route-draft:");
    await user.click(screen.getByRole("button", { name: "Map route point 3" }));
    expect(map.dataset.layerGeometry).toContain("route-01:");
    expect(map.dataset.layerGeometry).not.toContain("route-draft:");
    await user.click(screen.getByRole("button", { name: "Road Preview" }));
    await screen.findByText("Road preview updated.");
    expect(map.dataset.layerGeometry).not.toContain("route-01:");
    expect(map.dataset.layerGeometry).toContain("route-draft:");
    expect(directions).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "Finish route" }));

    expect(directions).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/5 waypoints/)).toBeInTheDocument();
  });

  it("ignores a stale preview and keeps failures as editable drafts", async () => {
    const user = userEvent.setup();
    let resolve!: (value: ReturnType<typeof roadResponse>) => void;
    const pending = new Promise<ReturnType<typeof roadResponse>>((done) => {
      resolve = done;
    });
    const directions = vi.fn<DirectionsProvider["directions"]>()
      .mockReturnValueOnce(pending)
      .mockRejectedValueOnce(new Error("Road service unavailable."));
    render(<App autosaveRepository={null} directionsProvider={{ directions }} />);
    await user.click(screen.getByRole("button", { name: "Route (R)" }));
    await user.click(screen.getByRole("radio", { name: "Road" }));
    await user.click(screen.getByRole("button", { name: "Map route point 1" }));
    await user.click(screen.getByRole("button", { name: "Map route point 2" }));
    await user.click(screen.getByRole("button", { name: "Road Preview" }));
    await user.click(screen.getByRole("button", { name: "Map route point 3" }));
    resolve(roadResponse());
    await pending;
    expect(screen.queryByText("Road preview updated.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select Route 02" }))
      .not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Road Preview" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Road service unavailable.",
    );
    expect(screen.getByRole("status", { name: "Route drawing status" }))
      .toHaveTextContent("3 points");
  });
});

it.each([320, 390])(
  "keeps the compact draft controls structurally responsive at %ipx",
  async (width) => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole("button", { name: "Route (R)" }));
    await user.click(screen.getByRole("button", { name: "Map route point 1" }));
    await user.click(screen.getByText("Draft points (1)"));
    const list = screen.getByRole("list", { name: "Draft route points" });
    expect(list)
      .toHaveClass("route-point-list");
    expect(within(list).getByRole("listitem")).toHaveClass("route-point-row");
    expect(screen.getByRole("button", { name: "Focus draft point 1 on map" }))
      .toBeVisible();
  },
);
