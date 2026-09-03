import { memo, useMemo, type ComponentProps, type RefObject } from "react";
import type { MobilePanel } from "../hooks/useMobilePanels";
import { MapCanvas } from "../../map/MapCanvas";
import {
  useLayerPreviewId,
  visibleLayerPreviewId,
} from "../layerPreviewContext";
import { LocationSearch } from "./LocationSearch";
import {
  CanvasWorkspaceChrome,
  MobilePanelActions,
} from "./CanvasWorkspaceChrome";
import { RouteDiscardDialog } from "./RouteDiscardDialog";
import { MapScale } from "./MapScale";

export type CanvasWorkspaceViewProps = {
  activePanel: MobilePanel | null;
  activeTool: string;
  chromeProps: Omit<
    ComponentProps<typeof CanvasWorkspaceChrome>,
    "selectToolRef" | "topDock"
  >;
  isRouteDiscardOpen: boolean;
  layersTriggerRef: RefObject<HTMLButtonElement | null>;
  mapProps: Omit<ComponentProps<typeof MapCanvas>, "previewedId">;
  onDiscardRoute: () => void;
  onKeepEditingRoute: () => void;
  onOpenPanel: (panel: MobilePanel) => void;
  propertiesTriggerRef: RefObject<HTMLButtonElement | null>;
  selectToolRef: RefObject<HTMLButtonElement | null>;
  searchKey: number;
  searchProps: ComponentProps<typeof LocationSearch>;
};

const MapCanvasWithLayerPreview = memo(function MapCanvasWithLayerPreview({
  mapProps,
}: {
  mapProps: Omit<ComponentProps<typeof MapCanvas>, "previewedId">;
}) {
  const requestedPreviewId = useLayerPreviewId();
  const previewedId = visibleLayerPreviewId(
    mapProps.layers,
    requestedPreviewId,
  );
  return <MapCanvas {...mapProps} previewedId={previewedId} />;
});

export function CanvasWorkspaceView({
  activePanel,
  activeTool,
  chromeProps,
  isRouteDiscardOpen,
  layersTriggerRef,
  mapProps,
  onDiscardRoute,
  onKeepEditingRoute,
  onOpenPanel,
  propertiesTriggerRef,
  selectToolRef,
  searchKey,
  searchProps,
}: CanvasWorkspaceViewProps) {
  const {
    onSelect: onSearchSelect,
    provider: searchProvider,
    proximity: searchProximity,
  } = searchProps;
  const topDock = useMemo(
    () => (
      <MobilePanelActions
        activePanel={activePanel}
        layersTriggerRef={layersTriggerRef}
        onOpenPanel={onOpenPanel}
        propertiesTriggerRef={propertiesTriggerRef}
      >
        <LocationSearch
          key={searchKey}
          onSelect={onSearchSelect}
          proximity={searchProximity}
          {...(searchProvider && { provider: searchProvider })}
        />
      </MobilePanelActions>
    ),
    [
      activePanel,
      layersTriggerRef,
      onOpenPanel,
      propertiesTriggerRef,
      searchKey,
      onSearchSelect,
      searchProvider,
      searchProximity,
    ],
  );
  return (
    <section
      className="canvas-region"
      data-active-tool={activeTool}
      inert={activePanel !== null}
    >
      <MapCanvasWithLayerPreview mapProps={mapProps} />
      <div className="canvas-overlay">
        <CanvasWorkspaceChrome
          {...chromeProps}
          selectToolRef={selectToolRef}
          topDock={topDock}
        />
        {mapProps.camera && (
          <div className="canvas-scale-dock">
            <MapScale
              latitude={mapProps.camera.center[1]}
              zoom={mapProps.camera.zoom}
            />
          </div>
        )}
      </div>
      {isRouteDiscardOpen && (
        <RouteDiscardDialog
          onDiscard={onDiscardRoute}
          onKeepEditing={onKeepEditingRoute}
        />
      )}
    </section>
  );
}
