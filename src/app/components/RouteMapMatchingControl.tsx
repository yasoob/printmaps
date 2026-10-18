import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SimpleSelect } from "@/components/ui/select";
import { ROAD_TRAVEL_MODE_OPTIONS } from "./routeSelectOptions";
import type {
  MapMatchingInput,
  MapMatchingProvenance,
} from "../../domain/project";
import type { RoadTravelMode } from "../../domain/routeProfiles";
import type {
  MapMatchingProvider,
  ProviderTravelProfile,
} from "../../services/mapbox/contracts";
import { createMapboxMapMatchingProvider } from "../../services/mapbox/mapMatching";
import { PropertyRow } from "./PropertyControls";
import type { ProjectMutationResult } from "../../domain/projectMutation";
import { trackEditorAction } from "../../analytics/editorAnalytics";

const defaultProvider = createMapboxMapMatchingProvider({
  token: import.meta.env.VITE_MAPBOX_PUBLIC_ACCESS,
});

const PROFILE: Record<RoadTravelMode, ProviderTravelProfile> = {
  car: "driving",
  walk: "walking",
  bike: "cycling",
};

type RouteMapMatchingControlProps = {
  coordinates: readonly (readonly [number, number])[];
  disabled: boolean;
  documentEpoch: number;
  onApply: (input: MapMatchingInput, expectedDocumentEpoch: number) => ProjectMutationResult;
  provenance?: MapMatchingProvenance;
  provider?: MapMatchingProvider;
};

type MatchingState =
  | { kind: "idle" }
  | { kind: "matching" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

function provenanceSummary(provenance: MapMatchingProvenance): string {
  const confidence =
    provenance.confidence === undefined
      ? ""
      : ` · ${Math.round(provenance.confidence * 100)}% confidence`;
  return `Matched to roads${confidence} · ${provenance.sourcePointCount} source points`;
}

function matchingGuidance(
  profile: ProviderTravelProfile | undefined,
  pointCount: number,
): string {
  if (!profile)
    return "Choose Car, Walking, or Cycling to match this route to roads.";
  if (pointCount > 100)
    return "Reduce this route to 100 points or fewer before matching it to roads.";
  if (pointCount < 2)
    return "This route needs at least two points before it can be matched.";
  return "Mapbox Map Matching uses 2–100 route points. The committed result remains editable and exportable offline.";
}

function isMatchingDisabled(
  options: Readonly<{
    disabled: boolean;
    isMatching: boolean;
    pointCount: number;
    profile: ProviderTravelProfile | undefined;
  }>,
): boolean {
  return (
    options.disabled ||
    options.isMatching ||
    !options.profile ||
    options.pointCount < 2 ||
    options.pointCount > 100
  );
}

function onlyMatch(
  response: Awaited<ReturnType<MapMatchingProvider["match"]>>,
) {
  const match = response.matches[0];
  if (!match || response.matches.length !== 1)
    throw new Error("Mapbox did not return one matched route.");
  return match;
}

function trackMatchingRequest(signal: AbortSignal) {
  trackEditorAction('mapMatchingStarted');
  const cancel = () => trackEditorAction('mapMatchingCancelled');
  signal.addEventListener('abort', cancel, { once: true });
  return () => signal.removeEventListener('abort', cancel);
}

function matchingFailure(error: unknown): MatchingState {
  return {
    kind: "error",
    message: error instanceof Error ? error.message : "The route could not be matched to roads.",
  };
}

export function RouteMapMatchingControl({
  coordinates,
  disabled,
  documentEpoch,
  onApply,
  provenance,
  provider = defaultProvider,
}: RouteMapMatchingControlProps) {
  const [state, setState] = useState<MatchingState>({ kind: "idle" });
  const [mode, setMode] = useState<RoadTravelMode>(() => {
    if (provenance?.profile === "walking") return "walk";
    if (provenance?.profile === "cycling") return "bike";
    return "car";
  });
  const controllerRef = useRef<AbortController | null>(null);
  const providerProfile = PROFILE[mode];
  const isMatching = state.kind === "matching";
  const isActionDisabled = isMatchingDisabled({
    disabled,
    isMatching,
    pointCount: coordinates.length,
    profile: providerProfile,
  });

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    },
    [coordinates, documentEpoch, mode],
  );

  const matchRoute = async () => {
    if (isActionDisabled || !providerProfile) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const stopTrackingCancellation = trackMatchingRequest(controller.signal);
    setState({ kind: "matching" });
    try {
      const response = await provider.match({
        profile: providerProfile,
        signal: controller.signal,
        trace: coordinates,
      });
      if (controller.signal.aborted) return;
      const match = onlyMatch(response);
      stopTrackingCancellation();
      const didApply = onApply(
        {
          geometry: match.geometry,
          profile: providerProfile,
          sourcePointCount: coordinates.length,
          ...(match.confidence !== undefined && {
            confidence: match.confidence,
          }),
        },
        documentEpoch,
      );
      if (!didApply.ok) {
        trackEditorAction('mapMatchingFailed');
        setState({ kind: "error", message: didApply.error });
        return;
      }
      trackEditorAction('mapMatchingCompleted');
      setState({
        kind: "success",
        message: "Route matched to roads. Undo is available.",
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      trackEditorAction('mapMatchingFailed');
      setState(matchingFailure(error));
    } finally {
      stopTrackingCancellation();
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  return (
    <div className="route-map-matching">
      <PropertyRow label="Travel mode">
        <SimpleSelect
          label="Road matching travel mode"
          disabled={disabled || isMatching}
          value={mode}
          options={ROAD_TRAVEL_MODE_OPTIONS}
          onValueChange={(nextMode) => {
            trackEditorAction('mapMatchingModeSelected');
            setMode(nextMode);
          }}
        />
      </PropertyRow>
      <Button
        className="secondary-action"
        variant="secondary"
        busy={isMatching}
        disabled={isActionDisabled}
        onClick={() => void matchRoute()}
      >
        {isMatching ? "Matching route…" : "Snap route to roads"}
      </Button>
      <small>{matchingGuidance(providerProfile, coordinates.length)}</small>
      {provenance && (
        <div className="provider-provenance-summary">
          {provenanceSummary(provenance)}
        </div>
      )}
      {state.kind === "success" && (
        <Notice tone="success" aria-label="Map matching status">
          {state.message}
        </Notice>
      )}
      {state.kind === "error" && <Notice tone="error">{state.message}</Notice>}
    </div>
  );
}
