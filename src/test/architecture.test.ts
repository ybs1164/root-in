import { describe, expect, it } from 'vitest';

// The layering rules in CLAUDE.md ("작업 규칙"), checked on the source text so
// a new component can't quietly call a map SDK, the network or Supabase
// directly (docs/plan-maintenance-harness.md MH3).
const sources = Object.entries(
  import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../test/**'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
).map(([path, text]) => ({ path: path.replace(/^\.\.\//, 'src/'), code: stripComments(text) }));

/** Drops comments so a rule mentioned in prose doesn't count as a use. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** Files (outside `allowed`) whose code matches `pattern`. */
function offenders(pattern: RegExp, allowed: (path: string) => boolean): string[] {
  return sources.filter((s) => !allowed(s.path) && pattern.test(s.code)).map((s) => s.path);
}

const inDir = (...dirs: string[]) => (path: string) => dirs.some((d) => path.startsWith(d));

describe('architecture (CLAUDE.md 작업 규칙)', () => {
  it('reads the source tree', () => {
    expect(sources.length).toBeGreaterThan(100);
    expect(sources.some((s) => s.path === 'src/App.tsx')).toBe(true);
  });

  it('MapLibre is used only behind CourseMap in src/map/', () => {
    expect(offenders(/from 'maplibre-gl'|\bmaplibregl\./, inDir('src/map/'))).toEqual([]);
  });

  it('the Kakao SDK is loaded only by src/map/, services and main.tsx', () => {
    expect(
      offenders(/from '[^']*kakaoSdk'/, (p) => inDir('src/map/', 'src/services/', 'src/lib/kakaoSdk')(p) || p === 'src/main.tsx'),
    ).toEqual([]);
    expect(offenders(/\bkakao\.maps\b|window\.kakao\b/, inDir('src/map/', 'src/lib/kakaoSdk'))).toEqual([]);
  });

  it('the network (global fetch) is called only from services', () => {
    expect(offenders(/(^|[^.\w])fetch\(/m, inDir('src/services/'))).toEqual([]);
  });

  it('Supabase is reached only through services', () => {
    expect(offenders(/from '@supabase\/supabase-js'|from '[^']*lib\/supabase'/, inDir('src/services/', 'src/lib/supabase'))).toEqual([]);
  });

  it('PostHog is used only by services/analytics.ts (components call analytics.track)', () => {
    expect(offenders(/from 'posthog-js'|\bposthog\./, (p) => p === 'src/services/analytics.ts')).toEqual([]);
  });

  it('only known env vars are read, and never a secret key', () => {
    const known = [
      'BASE_URL',
      'DEV',
      'VITE_GROUPS_NEED_LOGIN',
      'VITE_KAKAO_JS_KEY',
      'VITE_MAP_DATA_URL',
      'VITE_POSTHOG_HOST',
      'VITE_POSTHOG_KEY',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_SUPABASE_URL',
    ];
    const used = new Set(sources.flatMap((s) => [...s.code.matchAll(/import\.meta\.env\.(\w+)/g)].map((m) => m[1])));
    // A new key must be added here on purpose — and must not be a server secret
    // (Kakao REST key, Supabase service_role) that would ship in the bundle.
    expect([...used].filter((k) => !known.includes(k))).toEqual([]);
    expect(offenders(/service_role|SERVICE_ROLE|KAKAO_REST/, () => false)).toEqual([]);
  });
});
