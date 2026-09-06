import { useState } from 'react';
import { projectNameError } from '../../domain/projectLimits';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { useStableEvent } from './useStableEvent';

export function useLayerNameDraft(name: string, onCommit: (value: string) => ProjectMutationResult) {
  const [edit, setEdit] = useState<{ source: string; value: string; error: string | null }>(() => ({ source: name, value: name, error: null }));
  const draft = edit.source === name ? edit.value : name;
  const validationError = projectNameError(draft.trim());
  const error = validationError ?? (edit.source === name ? edit.error : null);
  const change = useStableEvent((value: string) => setEdit({ source: name, value, error: null }));
  const commit = useStableEvent(() => {
    if (validationError) return;
    const value = draft.trim();
    const result = onCommit(value);
    setEdit(result.ok ? { source: value, value, error: null } : { ...edit, error: result.error });
  });
  return { draft, error, change, commit };
}
