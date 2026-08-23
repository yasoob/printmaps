/// <reference types="vite/client" />

declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_MAPBOX_PUBLIC_ACCESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
