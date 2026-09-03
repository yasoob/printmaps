import { useState, type ReactNode } from "react";
import {
  LayerPreviewIdContext,
  SetLayerPreviewIdContext,
} from "./layerPreviewContext";

export function LayerPreviewProvider({ children }: { children: ReactNode }) {
  const [previewedLayerId, setPreviewedLayerId] = useState<string | null>(null);
  return (
    <SetLayerPreviewIdContext value={setPreviewedLayerId}>
      <LayerPreviewIdContext value={previewedLayerId}>
        {children}
      </LayerPreviewIdContext>
    </SetLayerPreviewIdContext>
  );
}
