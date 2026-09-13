import { useCallback, useMemo, useState } from 'react';
import { mutationRejected } from '../../domain/projectMutation';
import {
  applyMapDataBatchAppearance,
  createMapDataBatchAppearance,
  MapDataBatchAppearanceError,
  validateMapDataBatchAppearance,
  type MapDataBatchAppearance,
} from '../../import/mapDataBatchAppearance';
import {
  replacementSuccess,
  reviewedSuccess,
  useMapDataImportReader,
  type MapDataImportOptions,
} from './useMapDataImportReader';

export function useMapDataImport(options: MapDataImportOptions) {
  const reader = useMapDataImportReader(options);
  const { batch, replacementTarget, shouldFitView } = reader;
  const [appearanceState, setAppearanceState] = useState<{
    batch: NonNullable<typeof batch>;
    settings: MapDataBatchAppearance;
  } | null>(null);
  const [appearanceFailure, setAppearanceFailure] = useState<{
    batch: NonNullable<typeof batch>; settings: MapDataBatchAppearance; error: string;
  } | null>(null);
  const defaults = useMemo(() => batch ? createMapDataBatchAppearance(batch.layers) : null, [batch]);
  const batchAppearance = appearanceState?.batch === batch ? appearanceState.settings : defaults;
  const batchAppearanceValidation = useMemo(
    () => batch && batchAppearance ? validateMapDataBatchAppearance(batch.layers, batchAppearance) : null,
    [batch, batchAppearance],
  );
  const setBatchAppearance = useCallback((settings: MapDataBatchAppearance) => {
    if (batch) setAppearanceState({ batch, settings });
  }, [batch]);

  const commitReviewedImport = () => {
    const review = reader.getReview(batch);
    if (!review || !batch) return mutationRejected('This import review is no longer active. Choose the files again.', 'stale');
    review.analytics.start();
    let layers = batch.layers;
    if (!replacementTarget) {
      if (!batchAppearance) {
        review.analytics.finish('importFailed');
        return mutationRejected('Choose import styling before adding this batch.');
      }
      try {
        layers = applyMapDataBatchAppearance(batch.layers, batchAppearance);
      } catch (error) {
        review.analytics.finish('importFailed');
        if (!(error instanceof MapDataBatchAppearanceError)) throw error;
        setAppearanceFailure({ batch, settings: batchAppearance, error: error.message });
        return mutationRejected(error.message);
      }
    }
    let result;
    try {
      result = options.onImport({
        ...review.source,
        layers,
        replacementTarget,
        shouldFitView,
      });
    } catch (error) {
      review.analytics.finish('importFailed');
      throw error;
    }
    if (!reader.getReview(batch)) return result;
    if (!result.ok) {
      review.analytics.finish('importFailed');
      reader.setDialogError(result.error);
      return result;
    }
    review.analytics.finish('importCompleted');
    reader.setStatus(replacementTarget
      ? replacementSuccess(replacementTarget, review.source.documentEpoch)
      : reviewedSuccess(batch, review.source.documentEpoch));
    reader.closeDialog();
    return result;
  };

  const appearanceError = appearanceFailure?.batch === batch && appearanceFailure?.settings === batchAppearance
    ? appearanceFailure.error : null;
  return { ...reader, dialogError: reader.dialogError ?? appearanceError, batchAppearance, batchAppearanceValidation, commitReviewedImport, setBatchAppearance };
}
