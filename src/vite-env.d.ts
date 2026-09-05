/// <reference types="vite/client" />

// Declares the storefront's own env vars explicitly. Without this, adding
// @types/bun's global `ImportMetaEnv` (a `{ [key: string]: string | undefined }`
// index signature, needed for bun:test types) merges with Vite's own
// `ImportMetaEnv` (a permissive `Record<string, any>`) and turns every
// `import.meta.env[...]` lookup into `string | undefined`, which no longer
// satisfies the `string`-typed `baseUrl`/`publishableKey` fields the Medusa
// SDK expects in src/lib/medusa/sdk.ts.
interface ImportMetaEnv {
  readonly VITE_MEDUSA_BACKEND_URL: string;
  readonly VITE_MEDUSA_PUBLISHABLE_KEY: string;
}
