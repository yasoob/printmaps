import '@testing-library/jest-dom/vitest';

const inspectorPreferenceKeys = [
  'page',
  'map-style',
  'camera-location',
  'map-details',
  'provider-services',
  'technical-export',
].map((section) => `print-map-studio:inspector:project:${section}`);

const storedValues = new Map<string, string>();
const testStorage: Storage = {
  get length() { return storedValues.size; },
  clear: () => { storedValues.clear(); },
  getItem: (key) => storedValues.get(key) ?? null,
  key: (index) => [...storedValues.keys()][index] ?? null,
  removeItem: (key) => { storedValues.delete(key); },
  setItem: (key, value) => { storedValues.set(key, value); },
};

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: testStorage,
  });

  beforeEach(() => {
    for (const key of inspectorPreferenceKeys) window.localStorage.setItem(key, 'open');
  });
}
