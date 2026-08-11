/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `1` / `true` enables perf HUD + console samples (see `npm run dev:debug`). */
  readonly VITE_STARC_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
