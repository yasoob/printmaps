import { createContext, useContext } from "react";
import type { ProjectAutosaveState } from "./useProjectAutosave";

export const ProjectAutosaveContext = createContext<
  ProjectAutosaveState | undefined
>(undefined);
export const AutosaveCorruptedContext = createContext<boolean | undefined>(
  undefined,
);
export const AutosaveErrorContext = createContext<
  ProjectAutosaveState | null | undefined
>(undefined);
export const AutosaveCorruptionContext = createContext<
  ProjectAutosaveState | null | undefined
>(undefined);

export function useProjectAutosaveState(): ProjectAutosaveState {
  const autosave = useContext(ProjectAutosaveContext);
  if (!autosave) {
    throw new Error(
      "Autosave consumers must render inside ProjectAutosaveProvider.",
    );
  }
  return autosave;
}

export function useIsAutosaveCorrupted(): boolean {
  const isCorrupted = useContext(AutosaveCorruptedContext);
  if (isCorrupted === undefined) {
    throw new Error(
      "Autosave guards must render inside ProjectAutosaveProvider.",
    );
  }
  return isCorrupted;
}

export function useAutosaveErrorState(): ProjectAutosaveState | null {
  const autosave = useContext(AutosaveErrorContext);
  if (autosave === undefined) {
    throw new Error(
      "Autosave error surfaces must render inside ProjectAutosaveProvider.",
    );
  }
  return autosave;
}

export function useAutosaveCorruptionState(): ProjectAutosaveState | null {
  const autosave = useContext(AutosaveCorruptionContext);
  if (autosave === undefined) {
    throw new Error(
      "Autosave corruption surfaces must render inside ProjectAutosaveProvider.",
    );
  }
  return autosave;
}
