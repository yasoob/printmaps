/// <reference types="vite/client" />

declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_MAPBOX_PUBLIC_ACCESS?: string;
  readonly VITE_REACT_SCAN?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
