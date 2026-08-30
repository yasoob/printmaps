import { useEffect, useRef, useState } from "react";
import type {
  MapMatchingInput,
  MapMatchingProvenance,
} from "../../domain/project";
import {
  ROAD_TRAVEL_MODES,
  ROAD_TRAVEL_MODE_LABELS,
  type RoadTravelMode,
} from "../../domain/routeProfiles";
import type {
  MapMatchingProvider,
  ProviderTravelProfile,
} from "../../services/mapbox/contracts";
import { createMapboxMapMatchingProvider } from "../../services/mapbox/mapMatching";

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
  onApply: (input: MapMatchingInput, expectedDocumentEpoch: number) => boolean;
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
    setState({ kind: "matching" });
    try {
      const response = await provider.match({
        profile: providerProfile,
        signal: controller.signal,
        trace: coordinates,
      });
      if (controller.signal.aborted) return;
      const match = onlyMatch(response);
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
      if (!didApply)
        throw new Error(
          "The project changed before the matched route could be applied. Try again.",
        );
      setState({
        kind: "success",
        message: "Route matched to roads. Undo is available.",
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The route could not be matched to roads.",
      });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  return (
    <div className="route-map-matching">
      <label>
        <span>Travel mode</span>
        <select
          aria-label="Road matching travel mode"
          disabled={disabled || isMatching}
          value={mode}
          onChange={(event) => setMode(event.target.value as RoadTravelMode)}
        >
          {ROAD_TRAVEL_MODES.map((candidate) => (
            <option key={candidate} value={candidate}>
              {ROAD_TRAVEL_MODE_LABELS[candidate]}
            </option>
          ))}
        </select>
      </label>
      <button
        className="secondary-action"
        type="button"
        disabled={isActionDisabled}
        onClick={() => void matchRoute()}
      >
        {isMatching ? "Matching route…" : "Snap route to roads"}
      </button>
      <small>{matchingGuidance(providerProfile, coordinates.length)}</small>
      {provenance && (
        <div className="provider-provenance-summary">
          {provenanceSummary(provenance)}
        </div>
      )}
      {state.kind === "success" && (
        <div role="status" aria-label="Map matching status">
          {state.message}
        </div>
      )}
      {state.kind === "error" && <div role="alert">{state.message}</div>}
    </div>
  );
}
