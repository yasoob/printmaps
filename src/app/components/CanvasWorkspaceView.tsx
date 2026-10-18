import { memo, useMemo, useState, type ComponentProps, type ReactNode, type RefObject } from "react";
import type { MobilePanel } from "../hooks/useMobilePanels";
import { StudioMapCanvas } from "../studio/StudioMapCanvas";
import { EditorStudioMapCanvas } from "../studio/EditorStudioMapCanvas";
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
import { UnfinishedDrawingNotice } from "./UnfinishedDrawingNotice";

export type CanvasWorkspaceViewProps = {
  activePanel: MobilePanel | null;
  activeTool: string;
  chromeProps: Omit<
    ComponentProps<typeof CanvasWorkspaceChrome>,
    "selectToolRef"
  > & { statusNotice?: ReactNode; hasUnfinishedDrawing: boolean; hasUnfinishedPoiList: boolean };
  isRouteDiscardOpen: boolean;
  layersTriggerRef: RefObject<HTMLButtonElement | null>;
  mapProps: Omit<ComponentProps<typeof StudioMapCanvas>, "previewedId">;
  onDiscardRoute: () => void;
  onKeepEditingRoute: () => void;
  onOpenPanel: (panel: MobilePanel) => void;
  propertiesTriggerRef: RefObject<HTMLButtonElement | null>;
  selectToolRef: RefObject<HTMLButtonElement | null>;
  scaleMaxWidthPx: number;
  searchKey: number;
  searchProps: ComponentProps<typeof LocationSearch>;
};

const MapCanvasWithLayerPreview = memo(function MapCanvasWithLayerPreview(
  mapProps: Omit<ComponentProps<typeof StudioMapCanvas>, "previewedId">,
) {
  const requestedPreviewId = useLayerPreviewId();
  const previewedId = visibleLayerPreviewId(
    mapProps.layers,
    requestedPreviewId,
  );
  return <EditorStudioMapCanvas {...mapProps} previewedId={previewedId} />;
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
  scaleMaxWidthPx,
  selectToolRef,
  searchKey,
  searchProps,
}: CanvasWorkspaceViewProps) {
  const [cameraNoticeContainer, setCameraNoticeContainer] = useState<HTMLDivElement | null>(null);
  const { statusNotice, hasUnfinishedDrawing, hasUnfinishedPoiList, ...authoringChromeProps } = chromeProps;
  const {
    onSelect: onSearchSelect,
    provider: searchProvider,
    proximity: searchProximity,
    feedback: searchFeedback,
    onClearFeedback,
  } = searchProps;
  const topDock = useMemo(
    () => (
      <><MobilePanelActions
        activePanel={activePanel}
        layersTriggerRef={layersTriggerRef}
        onOpenPanel={onOpenPanel}
        propertiesTriggerRef={propertiesTriggerRef}
      >
        <LocationSearch
          key={searchKey}
          onSelect={onSearchSelect}
          proximity={searchProximity}
          feedback={searchFeedback}
          onClearFeedback={onClearFeedback}
          {...(searchProvider && { provider: searchProvider })}
        />
      </MobilePanelActions><div ref={setCameraNoticeContainer} className="canvas-camera-notice" /></>
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
      searchFeedback,
      onClearFeedback,
    ],
  );
  return (
    <section
      className="canvas-region"
      data-active-tool={activeTool}
      inert={activePanel !== null}
    >
      <MapCanvasWithLayerPreview {...mapProps} cameraNoticeContainer={cameraNoticeContainer} />
      <div className="canvas-overlay">
        <div className="canvas-top-dock">{topDock}{statusNotice}{(hasUnfinishedDrawing || hasUnfinishedPoiList) && <UnfinishedDrawingNotice hasPoiList={hasUnfinishedPoiList} hasDrawing={hasUnfinishedDrawing} />}</div>
        <CanvasWorkspaceChrome
          {...authoringChromeProps}
          selectToolRef={selectToolRef}
        />
        {mapProps.camera && (
          <div className="canvas-scale-dock">
            <MapScale
              latitude={mapProps.camera.center[1]}
              zoom={mapProps.camera.zoom}
              maxWidthPx={scaleMaxWidthPx}
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
