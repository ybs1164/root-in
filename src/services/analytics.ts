// Product analytics (PostHog), only to see where people get lost in the UI.
// Like Supabase: without VITE_POSTHOG_KEY nothing is sent and the library is
// never loaded, so `npm run dev` and the tests need no account.
//
// What is sent is behaviour only — never coordinates, addresses, place names
// or memos (this app holds people's homes and movements). Event properties
// are typed below so nothing else can slip in, and URLs are cut to origin +
// path because share links carry a whole route in their #hash.

export type PinSource = 'search' | 'long_press' | 'pin_button' | 'aim';
export type ShareKind = 'route' | 'day';
export type ShareMethod = 'system_share' | 'save_image' | 'copy_link';

/** Every event and its properties — the three funnels: 핀 꽂기, 루트 만들기, 공유. */
export interface EventProps {
  // 핀 꽂기
  pin_card_opened: { source: PinSource };
  pin_saved: { source: PinSource; uncategorized: boolean; has_memo: boolean };
  pin_card_dismissed: { source: PinSource };
  // 루트 만들기
  route_build_started: { method: 'plus' | 'drag' };
  route_build_ready: { stops: number };
  route_created: { stops: number; has_note: boolean; in_folder: boolean };
  route_build_cancelled: { stops: number };
  // 공유
  share_started: { kind: ShareKind };
  share_blocked_need_home: { kind: ShareKind };
  share_studio_opened: { kind: ShareKind };
  share_completed: { kind: ShareKind; method: ShareMethod; ok: boolean };
  share_studio_closed: { kind: ShareKind; completed: boolean };
}
export type AnalyticsEvent = keyof EventProps;

export interface Analytics {
  /** Never throws, never waits: events before the library is up are queued. */
  track<E extends AnalyticsEvent>(event: E, props: EventProps[E]): void;
}

/** The slice of posthog-js used here, so tests can stand in for it. */
export interface AnalyticsClient {
  capture(event: string, props: Record<string, unknown>): void;
}

const QUEUE_MAX = 200;

export function createAnalytics(load: (() => Promise<AnalyticsClient | null>) | null): Analytics {
  if (!load) return { track: () => {} };
  let client: AnalyticsClient | null = null;
  let failed = false;
  const queue: [string, Record<string, unknown>][] = [];
  const send = (event: string, props: Record<string, unknown>) => {
    try {
      client?.capture(event, props);
    } catch {
      // Analytics must never break the app.
    }
  };
  void load()
    .then((c) => {
      client = c;
      failed = !c;
      for (const [e, p] of queue.splice(0)) send(e, p);
    })
    .catch(() => {
      failed = true;
      queue.length = 0;
    });
  return {
    track(event, props) {
      if (failed) return;
      if (client) return send(event, props);
      if (queue.length < QUEUE_MAX) queue.push([event, props]);
    },
  };
}

/** Origin + path only: a #share= hash or ?code= query must never leave the device. */
export function scrubUrl(value: unknown): unknown {
  if (typeof value !== 'string' || !/^https?:\/\//.test(value)) return value;
  try {
    const u = new URL(value);
    return u.origin + u.pathname;
  } catch {
    return undefined;
  }
}

/** Applied to every outgoing PostHog event (`before_send`). */
export function scrubEvent<T extends { properties?: Record<string, unknown> }>(event: T): T {
  if (!event.properties) return event;
  const properties: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(event.properties)) properties[k] = scrubUrl(v);
  return { ...event, properties };
}

function loadPostHog(): Promise<AnalyticsClient | null> {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  return import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(key as string, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
        // Only the events above: no click autocapture (it reads element text,
        // e.g. place names), no pageviews (URLs), no replay until masking is set up.
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        // Off here as well as in the dashboard, so a switch flipped there can't
        // start them: heatmaps and dead clicks record where people press,
        // surveys load an extra script, and web vitals aren't about the UI.
        capture_heatmaps: false,
        capture_dead_clicks: false,
        capture_performance: false,
        disable_surveys: true,
        persistence: 'localStorage',
        person_profiles: 'identified_only',
        before_send: (e) => (e ? scrubEvent(e) : e),
      });
      return posthog as AnalyticsClient;
    })
    .catch(() => null);
}

// In development, `localStorage['goodroot:analytics-debug'] = '1'` prints
// every event to the console instead, to check the funnels without an account.
function debugLogging(): boolean {
  try {
    return import.meta.env.DEV && localStorage.getItem('goodroot:analytics-debug') === '1';
  } catch {
    return false;
  }
}
const logToConsole = async (): Promise<AnalyticsClient> => ({ capture: (e, p) => console.info('[analytics]', e, p) });

export const analytics: Analytics = createAnalytics(
  import.meta.env.VITE_POSTHOG_KEY ? loadPostHog : debugLogging() ? logToConsole : null,
);
