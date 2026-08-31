import type { ComponentProps, RefObject } from "react";
import type { MobilePanel } from "../hooks/useMobilePanels";
import { MapCanvas } from "../../map/MapCanvas";
import { LocationSearch } from "./LocationSearch";
import {
  CanvasWorkspaceChrome,
  MobilePanelActions,
} from "./CanvasWorkspaceChrome";
import { RouteDiscardDialog } from "./RouteDiscardDialog";

export type CanvasWorkspaceViewProps = {
  activePanel: MobilePanel | null;
  activeTool: string;
  chromeProps: Omit<
    ComponentProps<typeof CanvasWorkspaceChrome>,
    "selectToolRef" | "topDock"
  >;
  isRouteDiscardOpen: boolean;
  layersTriggerRef: RefObject<HTMLButtonElement | null>;
  mapProps: ComponentProps<typeof MapCanvas>;
  onDiscardRoute: () => void;
  onKeepEditingRoute: () => void;
  onOpenPanel: (panel: MobilePanel) => void;
  propertiesTriggerRef: RefObject<HTMLButtonElement | null>;
  selectToolRef: RefObject<HTMLButtonElement | null>;
  searchKey: number;
  searchProps: ComponentProps<typeof LocationSearch>;
};

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
  return (
    <section
      className="canvas-region"
      data-active-tool={activeTool}
      inert={activePanel !== null}
    >
      <MapCanvas {...mapProps} />
      <CanvasWorkspaceChrome
        {...chromeProps}
        selectToolRef={selectToolRef}
        topDock={(
          <MobilePanelActions
            activePanel={activePanel}
            layersTriggerRef={layersTriggerRef}
            onOpenPanel={onOpenPanel}
            propertiesTriggerRef={propertiesTriggerRef}
          >
            <LocationSearch key={searchKey} {...searchProps} />
          </MobilePanelActions>
        )}
      />
      {isRouteDiscardOpen && (
        <RouteDiscardDialog
          onDiscard={onDiscardRoute}
          onKeepEditing={onKeepEditingRoute}
        />
      )}
    </section>
  );
}
