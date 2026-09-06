import { useState } from 'react';
import type { ProjectMutationResult } from '../../domain/projectMutation';

export function useMutationFeedback(source: unknown) {
  const [failure, setFailure] = useState<{ source: unknown; message: string } | null>(null);
  const report = (result: ProjectMutationResult) => {
    setFailure(result.ok ? null : { source, message: result.error });
    return result;
  };
  return { error: failure && failure.source === source ? failure.message : null, report };
}
