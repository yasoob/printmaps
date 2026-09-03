import { analyzeFiberRender } from "./reactScanProbeFiber";
import {
  installMapLibreMutationProbe,
  type MapLibreMutation,
} from "./reactScanProbeMapLibre";

type ReactScanRenderHandler = NonNullable<
  import("react-scan").Options["onRender"]
>;

export const REACT_SCAN_TARGETS = [
  { name: "App", area: "Editor root" },
  { name: "StudioAppView", area: "Editor shell" },
  { name: "StudioHeader", area: "Project and history actions" },
  { name: "LayersSidebar", area: "Layer list" },
  { name: "PropertiesSidebar", area: "Project and layer inspector" },
  { name: "LayerProperties", area: "Selected layer inspector" },
  { name: "ProjectProperties", area: "Project inspector" },
  { name: "CanvasWorkspace", area: "Editor interaction model" },
  { name: "CanvasWorkspaceView", area: "Canvas render boundary" },
  { name: "CanvasWorkspaceChrome", area: "Canvas controls" },
  { name: "MapCanvas", area: "Map renderer" },
  { name: "LocationSearch", area: "Map search" },
  { name: "LayerPreviewProvider", area: "Layer preview state" },
  { name: "MapCanvasWithLayerPreview", area: "Map preview boundary" },
] as const;

export type ReactScanTargetName = (typeof REACT_SCAN_TARGETS)[number]["name"];

export type ReactScanComponentInventory = {
  area: string;
  name: string;
  observed: boolean;
  source: string | null;
};

export type ComponentProbeSummary = {
  callbacks: number;
  changes: string[];
  committedRenders: number;
  renderCount: number;
  unnecessaryRenders: number | null;
};

export type ReactScanProbeResult = {
  domMutations: Array<{
    className: string;
    kind: "added" | "removed";
  }>;
  events: Array<{
    changes: string[];
    component: string;
    didCommit: boolean;
    instanceId: number;
    ownerPath: string[];
    phase: "mount" | "update" | "unmount" | "unknown";
    source: string | null;
  }>;
  label: string;
  mapMutations: MapLibreMutation[];
  components: Record<string, ComponentProbeSummary>;
};

export type ReactScanProbeController = {
  finish: () => ReactScanProbeResult;
  inventory: ReadonlyArray<ReactScanComponentInventory>;
  start: (label: string) => void;
};

declare global {
  interface Window {
    __PRINT_MAP_REACT_SCAN__?: ReactScanProbeController;
  }
}

const probeState: { active: ReactScanProbeResult | null } = { active: null };
const componentInventory = new Map<string, ReactScanComponentInventory>(
  REACT_SCAN_TARGETS.map(({ area, name }) => [
    name,
    { area, name, observed: false, source: null },
  ]),
);
const EDITING_MARKER_SELECTOR = [
  ".draft-route-point-marker",
  ".poi-move-marker",
  ".route-midpoint-marker",
  ".route-vertex-marker",
  ".shape-midpoint-marker",
  ".shape-transform-marker",
  ".shape-vertex-marker",
].join(",");

function observeComponent(
  name: string,
  source: string | null,
) {
  const current = componentInventory.get(name);
  componentInventory.set(name, {
    area: current?.area ?? "Runtime-discovered",
    name,
    observed: true,
    source: current?.source ?? source,
  });
}

function recordMarkerMutation(node: Node, kind: "added" | "removed") {
  if (!probeState.active || !(node instanceof Element)) return;
  const markers = [
    ...(node.matches(EDITING_MARKER_SELECTOR) ? [node] : []),
    ...node.querySelectorAll(EDITING_MARKER_SELECTOR),
  ];
  for (const marker of markers) {
    probeState.active.domMutations.push({
      className: marker.className,
      kind,
    });
  }
}

function recordRender(
  name: string,
  renders: Parameters<ReactScanRenderHandler>[1],
  derivedChanges: readonly string[],
) {
  if (!probeState.active || renders.length === 0) return;
  const current = probeState.active.components[name] ?? {
    callbacks: 0,
    changes: [],
    committedRenders: 0,
    renderCount: 0,
    unnecessaryRenders: null,
  };
  const changes = new Set(current.changes);
  for (const change of derivedChanges) changes.add(change);
  const unnecessaryRenders = renders.some(
    (render) => render.unnecessary !== null,
  )
    ? (current.unnecessaryRenders ?? 0) +
      renders.filter((render) => render.unnecessary === true).length
    : current.unnecessaryRenders;
  probeState.active.components[name] = {
    callbacks: current.callbacks + 1,
    changes: [...changes],
    committedRenders:
      current.committedRenders +
      renders.filter((render) => render.didCommit).length,
    renderCount:
      current.renderCount +
      renders.reduce((total, render) => total + render.count, 0),
    unnecessaryRenders,
  };
}

const handleRender: ReactScanRenderHandler = (fiber, renders) => {
  for (const render of renders) {
    const analyzed = analyzeFiberRender(fiber, render);
    observeComponent(analyzed.name, analyzed.source);
    recordRender(analyzed.name, [render], analyzed.changes);
    probeState.active?.events.push({
      changes: analyzed.changes,
      component: analyzed.name,
      didCommit: analyzed.didCommit,
      instanceId: analyzed.instanceId,
      ownerPath: analyzed.ownerPath,
      phase: analyzed.phase,
      source: analyzed.source,
    });
  }
};

export function installReactScanProbe(): ReactScanRenderHandler {
  const existing = window.__PRINT_MAP_REACT_SCAN__;
  if (existing) return handleRender;

  const controller: ReactScanProbeController = {
    get inventory() {
      return [...componentInventory.values()].map((entry) => ({ ...entry }));
    },
    start(label) {
      if (probeState.active) {
        throw new Error(`React Scan probe "${probeState.active.label}" is already active.`);
      }
      probeState.active = {
        components: {},
        domMutations: [],
        events: [],
        label,
        mapMutations: [],
      };
    },
    finish() {
      if (!probeState.active) throw new Error("No React Scan probe is active.");
      const result = structuredClone(probeState.active);
      probeState.active = null;
      return result;
    },
  };
  Object.defineProperty(window, "__PRINT_MAP_REACT_SCAN__", {
    configurable: true,
    value: controller,
  });
  const markerObserver = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) recordMarkerMutation(node, "added");
      for (const node of record.removedNodes) {
        recordMarkerMutation(node, "removed");
      }
    }
  });
  markerObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  installMapLibreMutationProbe((mutation) => {
    probeState.active?.mapMutations.push(mutation);
  });
  return handleRender;
}
