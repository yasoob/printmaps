import { useState, type ReactNode } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { ProjectState } from "../app/store";
import {
  createIndexedDbAutosaveRepository,
  type AutosaveRepository,
} from "./autosave";
import {
  AutosaveCorruptedContext,
  AutosaveConflictOpenContext,
  AutosaveCorruptionContext,
  AutosaveErrorContext,
  ProjectAutosaveContext,
} from "./projectAutosaveContext";
import { useProjectAutosave } from "./useProjectAutosave";

type ProjectAutosaveProviderProps = {
  children: ReactNode;
  loadError: unknown | null;
  projectStore: StoreApi<ProjectState>;
  repository: AutosaveRepository | null | undefined;
};

export function ProjectAutosaveProvider({
  children,
  loadError,
  projectStore,
  repository,
}: ProjectAutosaveProviderProps) {
  const [resolvedRepository] = useState(() =>
    repository === undefined
      ? (typeof indexedDB === "undefined"
        ? null
        : createIndexedDbAutosaveRepository())
      : repository,
  );
  const autosave = useProjectAutosave(
    projectStore,
    resolvedRepository,
    loadError,
  );
  // Both are the existing autosave reference or null, so their identity only
  // changes with `autosave`; no memo is required for stable context values.
  const errorState = autosave.statusKind !== "status" && !autosave.corrupted ? autosave : null;
  const corruptionState = autosave.corrupted ? autosave : null;
  return (
    <AutosaveCorruptedContext value={autosave.corrupted}>
      <AutosaveConflictOpenContext value={autosave.conflictOpen}>
      <ProjectAutosaveContext value={autosave}>
        <AutosaveErrorContext value={errorState}>
          <AutosaveCorruptionContext value={corruptionState}>
            {children}
          </AutosaveCorruptionContext>
        </AutosaveErrorContext>
      </ProjectAutosaveContext>
      </AutosaveConflictOpenContext>
    </AutosaveCorruptedContext>
  );
}
