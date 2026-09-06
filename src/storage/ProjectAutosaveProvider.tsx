import { useMemo, useState, type ReactNode } from "react";
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
  const errorState = useMemo(
    () => autosave.statusKind !== "status" && !autosave.corrupted
      ? autosave
      : null,
    [autosave],
  );
  const corruptionState = useMemo(
    () => autosave.corrupted ? autosave : null,
    [autosave],
  );
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
