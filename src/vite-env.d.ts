/// <reference types="vite/client" />

declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_MAPBOX_PUBLIC_ACCESS?: string;
  readonly VITE_REACT_SCAN?: 'true' | 'false';
  readonly VITE_TEST_INITIAL_PROJECT?: 'true';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
