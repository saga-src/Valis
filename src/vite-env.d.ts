
// Fix: Manually defining ImportMeta and ImportMetaEnv because 'vite/client' types are missing in this environment.
interface ImportMetaEnv {
  readonly [key: string]: any;
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.mp3';
