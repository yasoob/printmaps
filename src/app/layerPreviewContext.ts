import {
  createContext,
  useContext,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ContentLayer } from "../domain/project";

export const LayerPreviewIdContext = createContext<
  string | null | undefined
>(undefined);
export const SetLayerPreviewIdContext = createContext<
  Dispatch<SetStateAction<string | null>> | undefined
>(undefined);

export function useLayerPreviewId(): string | null {
  const previewedLayerId = useContext(LayerPreviewIdContext);
  if (previewedLayerId === undefined) {
    throw new Error(
      "Layer preview consumers must render inside LayerPreviewProvider.",
    );
  }
  return previewedLayerId;
}

export function useSetLayerPreviewId(): Dispatch<
  SetStateAction<string | null>
> {
  const setPreviewedLayerId = useContext(SetLayerPreviewIdContext);
  if (!setPreviewedLayerId) {
    throw new Error(
      "Layer preview actions must render inside LayerPreviewProvider.",
    );
  }
  return setPreviewedLayerId;
}

export function visibleLayerPreviewId(
  layers: readonly ContentLayer[],
  previewedLayerId: string | null,
): string | null {
  if (previewedLayerId === null) return null;
  const layer = layers.find(({ id }) => id === previewedLayerId);
  return layer?.visible && layer.geometry ? previewedLayerId : null;
}
