import { cleanup } from '@testing-library/react';
import { WORKFLOW_ACTIONS } from '../../src/analytics/workflowActions';

const workflowActions = new Set<string>(WORKFLOW_ACTIONS);

export function recordWorkflowAnalytics() {
  const gtag = vi.fn<NonNullable<Window['gtag']>>();
  beforeEach(() => {
    gtag.mockClear();
    Object.defineProperty(window, 'gtag', { configurable: true, writable: true, value: gtag });
  });
  afterEach(() => {
    cleanup();
    delete window.gtag;
    vi.restoreAllMocks();
  });
  return {
    gtag,
    events: () => gtag.mock.calls.map((call) => call[2])
      .filter(({ action }) => workflowActions.has(action)),
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
