export type ProjectMutationFailure = {
  ok: false;
  error: string;
  code?: 'invalid' | 'capacity' | 'stale' | 'unavailable';
};

export type ProjectMutationResult = ProjectMutationFailure | { ok: true; changed?: boolean };
export type LayerMutationResult = ProjectMutationFailure | { ok: true; layerId: string };
export type GeometryEditResult = ProjectMutationResult | { pending: true };

export function mutationRejected(
  error: string,
  code: ProjectMutationFailure['code'] = 'invalid',
): ProjectMutationFailure {
  return { ok: false, error, code };
}
