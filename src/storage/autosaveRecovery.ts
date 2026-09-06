import { downloadBlob } from '../lib/downloadBlob';
import { getAutosaveErrorName } from './autosave';

function isRecoveryScalar(value: unknown) {
  return value === null || typeof value === 'string' || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value));
}

function assertRecoveryJson(value: unknown, ancestors: WeakSet<object>): void {
  if (isRecoveryScalar(value)) return;
  if (value === null || typeof value !== 'object' || ancestors.has(value)) {
    throw new Error('Recovery data cannot be represented safely as JSON. The local record is still preserved.');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype && !Array.isArray(value)) {
    throw new Error('Recovery data contains an unsupported value. The local record is still preserved.');
  }
  ancestors.add(value);
  const children = Array.isArray(value) ? value : Object.values(value);
  for (const child of children) {
    assertRecoveryJson(child, ancestors);
  }
  ancestors.delete(value);
}

export function createAutosaveRecoveryFile(record: unknown): File {
  assertRecoveryJson(record, new WeakSet());
  return new File([`${JSON.stringify(record, null, 2)}\n`], 'local-draft-recovery.json', { type: 'application/json' });
}

export function downloadAutosaveRecovery(record: unknown) {
  const file = createAutosaveRecoveryFile(record);
  downloadBlob(file, file.name);
}

export function getRecoveryDiscardFailureMessage(error: unknown) {
  const name = getAutosaveErrorName(error);
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return 'Browser storage is full, so the local draft could not be discarded. Download recovery data, then free storage and retry, or continue without autosave.';
  }
  const reason = name === 'AutosaveConflictError'
    ? 'The local draft changed in another tab, so it was not discarded.'
    : 'The local draft could not be discarded.';
  return `${reason} Retry, download recovery data, or continue without autosave. No new work will overwrite the local draft.`;
}
