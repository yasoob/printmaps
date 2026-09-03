import { expect, test, type Locator, type Page } from "@playwright/test";
import type {
  ReactScanProbeController,
} from "../../src/dev/reactScanProbe";

type ProbeGlobal = typeof globalThis & {
  __PRINT_MAP_REACT_SCAN__?: ReactScanProbeController;
};

function componentsWithoutHostCommits(
  result: ReturnType<ReactScanProbeController["finish"]>,
) {
  return [...new Set(
    result.events
      .filter(({ didCommit }) => !didCommit)
      .map(({ component }) => component),
  )];
}

const EXPECTED_HOVER_RENDERS = new Set([
  "LayerPreviewProvider",
  "MapCanvasWithLayerPreview",
  "MapCanvas",
]);

test.skip(
  process.env.VITE_REACT_SCAN !== "true",
  "Run with npm run audit:renders so React Scan is enabled.",
);

async function openInstrumentedEditor(page: Page) {
  await page.goto("./");
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({
    timeout: 20_000,
  });
  await page.waitForFunction(
    () => Boolean((globalThis as ProbeGlobal).__PRINT_MAP_REACT_SCAN__),
  );
  await page.waitForTimeout(250);
}

async function captureMarkerDrag(
  page: Page,
  marker: Locator,
  label: string,
  shouldRetainMarker: boolean,
) {
  await expect(marker).toBeVisible();
  await expect(marker).toHaveCSS("z-index", "3");
  const markerBounds = await marker.boundingBox();
  expect(markerBounds).not.toBeNull();
  const start = {
    x: markerBounds!.x + markerBounds!.width / 2,
    y: markerBounds!.y + markerBounds!.height / 2,
  };
  const map = page.getByTestId("map-canvas");
  const originalGeometry = await map.getAttribute("data-map-layer-geometry");
  expect(originalGeometry).toBeTruthy();
  if (shouldRetainMarker) {
    await marker.evaluate((element, markerLabel) => {
      (element as HTMLElement).dataset.renderProbeMarker = markerLabel;
    }, label);
  }

  await page.mouse.move(start.x, start.y);
  await page.evaluate((probeLabel) => {
    (globalThis as ProbeGlobal).__PRINT_MAP_REACT_SCAN__?.start(probeLabel);
  }, `Preview ${label} drag`);
  await page.mouse.down();
  await page.mouse.move(start.x + 24, start.y + 16, { steps: 5 });
  await page.waitForTimeout(100);
  const previewResult = await page.evaluate(() => {
    const probe = (globalThis as ProbeGlobal).__PRINT_MAP_REACT_SCAN__;
    if (!probe) throw new Error("React Scan probe was not installed.");
    return probe.finish();
  });

  await page.evaluate((probeLabel) => {
    (globalThis as ProbeGlobal).__PRINT_MAP_REACT_SCAN__?.start(probeLabel);
  }, `Commit ${label} drag`);
  await page.mouse.up();
  await expect(map).not.toHaveAttribute(
    "data-map-layer-geometry",
    originalGeometry!,
  );
  await page.waitForTimeout(150);
  const commitResult = await page.evaluate(() => {
    const probe = (globalThis as ProbeGlobal).__PRINT_MAP_REACT_SCAN__;
    if (!probe) throw new Error("React Scan probe was not installed.");
    return probe.finish();
  });
  await expect(marker).toHaveCSS("z-index", "3");
  if (shouldRetainMarker) {
    await expect(marker).toHaveAttribute("data-render-probe-marker", label);
  }
  return { commitResult, previewResult };
}

test("reports editor boundaries affected by a layer preview", async ({
  page,
}, testInfo) => {
  await openInstrumentedEditor(page);

  const inventory = await page.evaluate(
    () => (globalThis as ProbeGlobal).__PRINT_MAP_REACT_SCAN__?.inventory,
  );
  expect(inventory?.map(({ name }) => name)).toEqual(
    expect.arrayContaining([
      "LayerRow",
      "ProjectPropertiesPanel",
      "StudioHeader",
      "LayersSidebar",
      "PropertiesSidebar",
      "CanvasWorkspace",
      "MapCanvas",
    ]),
  );
  expect(inventory?.length).toBeGreaterThan(12);

  await page.evaluate(() => {
    (globalThis as ProbeGlobal).__PRINT_MAP_REACT_SCAN__?.start(
      "Hover Route 01 in the layers sidebar",
    );
  });
  await page.getByRole("button", { name: "Select Route 01" }).hover();
  await expect(page.getByTestId("map-canvas")).toHaveAttribute(
    "data-previewed-layer",
    "route-01",
  );
  await page.waitForTimeout(250);
  const result = await page.evaluate(() => {
    const probe = (globalThis as ProbeGlobal).__PRINT_MAP_REACT_SCAN__;
    if (!probe) throw new Error("React Scan probe was not installed.");
    return probe.finish();
  });

  const unexpected = Object.entries(result.components)
    .filter(([name]) => !EXPECTED_HOVER_RENDERS.has(name))
    .map(([name, summary]) => ({ name, ...summary }));
  const report = { ...result, inventory, unexpected };
  await testInfo.attach("react-scan-render-probe", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
  console.log(JSON.stringify(report, null, 2));

  expect(result.components.MapCanvas?.callbacks).toBeGreaterThan(0);
  expect(result.components.StudioAppView).toBeUndefined();
  expect(result.components.CanvasWorkspace).toBeUndefined();
  expect(result.components.PropertiesSidebar).toBeUndefined();
  expect(unexpected).toEqual([]);
});

test("captures editor boundaries affected by layer selection", async ({
  page,
}, testInfo) => {
  await openInstrumentedEditor(page);
  const routeButton = page.getByRole("button", { name: "Select Route 01" });
  await routeButton.hover();
  await expect(page.getByTestId("map-canvas")).toHaveAttribute(
    "data-previewed-layer",
    "route-01",
  );
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    (globalThis as ProbeGlobal).__PRINT_MAP_REACT_SCAN__?.start(
      "Select Route 01 in the layers sidebar",
    );
  });
  await routeButton.click();
  await expect(page.getByRole("heading", { name: "Route 01" })).toBeVisible();
  await page.waitForTimeout(250);
  const result = await page.evaluate(() => {
    const probe = (globalThis as ProbeGlobal).__PRINT_MAP_REACT_SCAN__;
    if (!probe) throw new Error("React Scan probe was not installed.");
    return probe.finish();
  });
  await testInfo.attach("react-scan-selection-probe", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  console.log(JSON.stringify(result, null, 2));

  expect(result.components.LayersSidebar?.callbacks).toBeGreaterThan(0);
  expect(result.components.PropertiesSidebar?.callbacks).toBeGreaterThan(0);
  expect(result.components.MapCanvas?.callbacks).toBeGreaterThan(0);
  expect(result.components.PropertiesSidebar?.changes).toEqual([
    "props:selectedLayerId",
  ]);
  expect(result.components.CanvasWorkspace?.changes).toEqual([
    "props:selectedId",
  ]);
  expect(result.components.ProjectAutosaveStatus).toBeUndefined();
  expect(result.components.ProjectAutosaveErrorNotice).toBeUndefined();
  expect(result.components.ProjectAutosaveDialogs).toBeUndefined();
});

test("captures editor boundaries affected by a title commit", async ({
  page,
}, testInfo) => {
  await openInstrumentedEditor(page);
  await page.getByRole("button", { name: "Vienna field guide" }).click();
  const title = page.getByRole("textbox", { name: "Project title" });
  await title.fill("Vienna title probe");
  await page.evaluate(() => {
    (globalThis as ProbeGlobal).__PRINT_MAP_REACT_SCAN__?.start(
      "Commit a project title edit",
    );
  });
  await title.press("Enter");
  await expect(
    page.getByRole("button", { name: "Vienna title probe" }),
  ).toBeVisible();
  await page.waitForTimeout(750);
  const result = await page.evaluate(() => {
    const probe = (globalThis as ProbeGlobal).__PRINT_MAP_REACT_SCAN__;
    if (!probe) throw new Error("React Scan probe was not installed.");
    return probe.finish();
  });
  await testInfo.attach("react-scan-title-probe", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  console.log(JSON.stringify(result, null, 2));

  expect(result.components.StudioProjectIdentity?.callbacks).toBeGreaterThan(0);
  expect(result.components.StudioHeader).toBeUndefined();
});

test("captures the complete wheel-zoom render wave", async ({
  page,
}, testInfo) => {
  await openInstrumentedEditor(page);
  const map = page.getByTestId("map-canvas");
  const canvas = page.locator(".maplibregl-canvas");
  const canvasBounds = await canvas.boundingBox();
  expect(canvasBounds).not.toBeNull();
  const initialZoom = await map.getAttribute("data-map-zoom");
  await page.mouse.move(
    canvasBounds!.x + canvasBounds!.width / 2,
    canvasBounds!.y + canvasBounds!.height / 2,
  );
  await page.evaluate(() => {
    (globalThis as ProbeGlobal).__PRINT_MAP_REACT_SCAN__?.start(
      "Wheel zoom the map",
    );
  });
  await page.mouse.wheel(0, -500);
  await expect(map).not.toHaveAttribute("data-map-zoom", initialZoom!);
  await page.waitForTimeout(750);
  const result = await page.evaluate(() => {
    const probe = (globalThis as ProbeGlobal).__PRINT_MAP_REACT_SCAN__;
    if (!probe) throw new Error("React Scan probe was not installed.");
    return probe.finish();
  });
  await testInfo.attach("react-scan-wheel-zoom-probe", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  console.log(JSON.stringify(result, null, 2));

  expect(result.components.MapCanvas?.callbacks).toBeGreaterThan(0);
  for (const unrelatedComponent of [
    "CanvasWorkspaceChrome",
    "DragDropProvider",
    "LayersSidebar",
    "LocationSearch",
    "MobilePanelActions",
    "PoiAuthoringControls",
    "ProjectAutosaveDialogs",
    "ProjectAutosaveErrorNotice",
    "ProjectFileActions",
    "PropertiesSidebar",
    "StudioApp",
    "StudioAppView",
    "StudioHeader",
    "StudioProperties",
  ]) {
    expect(result.components[unrelatedComponent]).toBeUndefined();
  }
});

for (const markerCase of [
  {
    label: "route point",
    markerName: "Drag route anchor 2",
    selectionName: "Select Route 01",
    shouldRetainMarker: true,
  },
  {
    label: "POI point",
    markerName: "Move Coffee stop",
    selectionName: "Select Coffee stop",
    shouldRetainMarker: false,
  },
  {
    label: "shape point",
    markerName: "Drag area point 1",
    selectionName: "Select City center",
    shouldRetainMarker: false,
  },
]) {
  test(`separates live ${markerCase.label} preview from its committed React update`, async ({
    page,
  }, testInfo) => {
    await openInstrumentedEditor(page);
    await page.getByRole("button", { name: markerCase.selectionName }).click();
    const results = await captureMarkerDrag(
      page,
      page.getByRole("button", { name: markerCase.markerName }),
      markerCase.label,
      markerCase.shouldRetainMarker,
    );
    await testInfo.attach(`react-scan-${markerCase.label}-drag-probe`, {
      body: JSON.stringify(results, null, 2),
      contentType: "application/json",
    });
    console.log(JSON.stringify(results, null, 2));
    console.log(JSON.stringify({
      label: markerCase.label,
      withoutHostCommits: componentsWithoutHostCommits(
        results.commitResult,
      ),
    }));

    expect(results.previewResult.components).toEqual({});
    expect(results.previewResult.domMutations).toEqual([]);
    expect(results.previewResult.mapMutations.length).toBeGreaterThan(0);
    expect(
      results.previewResult.mapMutations.every(
        ({ operation }) => operation === "setData",
      ),
    ).toBe(true);
    expect(
      results.commitResult.components.MapCanvas?.callbacks,
    ).toBeGreaterThan(0);
    expect(results.commitResult.components.CanvasWorkspace?.changes).toEqual([
      "props:layers",
    ]);
    if (markerCase.shouldRetainMarker) {
      expect(results.commitResult.domMutations).toEqual([]);
      expect(results.commitResult.mapMutations).toEqual([]);
      expect(componentsWithoutHostCommits(results.commitResult)).toEqual([]);
      for (const unrelatedRouteInspectorComponent of [
        "DirectionsEditStatus",
        "DirectionsProvenanceSummary",
        "LayerIdentityProperties",
        "ProjectAutosaveSurfaces",
        "PropertiesSidebar",
        "RouteAppearanceControls",
        "RouteExtensionControls",
        "RouteMarkerControls",
        "RouteMarkerSection",
        "RouteSegmentControls",
        "RouteSegmentSection",
      ]) {
        expect(
          results.commitResult.components[unrelatedRouteInspectorComponent],
        ).toBeUndefined();
      }
      expect(
        results.commitResult.components.RouteAdvancedProperties?.callbacks,
      ).toBeGreaterThan(0);
    }
  });
}
