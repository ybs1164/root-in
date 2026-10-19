/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KAKAO_JS_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  /** 'true': We Now needs a Kakao login (no guest accounts). */
  readonly VITE_GROUPS_NEED_LOGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
