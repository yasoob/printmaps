import { createAutosaveRecoveryFile, getRecoveryDiscardFailureMessage } from '../../src/storage/autosaveRecovery';
import { AutosaveConflictError } from '../../src/storage/autosave';

it('downloads recovery data without pretending it is a supported portable project', async () => {
  const record = { recordVersion: 99, revision: 5, document: { schemaVersion: 900, title: 'Preserve me', assets: {} } };
  const file = createAutosaveRecoveryFile(record);
  expect(file.name).toBe('local-draft-recovery.json');
  expect(file.name).not.toContain('.printmap.');
  expect(JSON.parse(await file.text())).toEqual(record);
});

it.each([undefined, NaN, Infinity, 1n, new Map([['value', 'recover me']]), new Date()])('rejects lossy JSON recovery conversion for %s', (value) => {
  expect(() => createAutosaveRecoveryFile({ value })).toThrow(/local record is still preserved/);
});

it('rejects cyclic data rather than producing a misleading partial recovery download', () => {
  const record: { self?: unknown } = {};
  record.self = record;
  expect(() => createAutosaveRecoveryFile(record)).toThrow('cannot be represented safely');
});

it('points discard failures to reachable recovery actions', () => {
  expect(getRecoveryDiscardFailureMessage(new DOMException('full', 'QuotaExceededError'))).toContain('free storage and retry');
  expect(getRecoveryDiscardFailureMessage(new AutosaveConflictError())).toContain('changed in another tab');
  expect(getRecoveryDiscardFailureMessage(new Error('blocked'))).toContain('continue without autosave');
});
