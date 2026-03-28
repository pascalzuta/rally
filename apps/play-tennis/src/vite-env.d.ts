/// <reference types="vite/client" />

declare function fbq(command: string, event: string, params?: Record<string, unknown>): void
declare function gtag(...args: unknown[]): void

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
