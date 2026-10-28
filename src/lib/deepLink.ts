import { publicAppUrl } from './appUrl';

const LINK_KEYS = ['s', 'share', 'c', 'g'] as const;
const SLUG = /^[A-Za-z0-9_-]{6,16}$/;
export const APP_LINK_FALLBACK = '_rootin_web';

/** Only share/invite data may enter the WebView; never navigate it to an external URL. */
export function incomingLinkHash(raw: string, base = publicAppUrl()): string | null {
  try {
    const url = new URL(raw);
    let params: URLSearchParams;
    if (url.protocol === 'rootin:' && url.hostname === 'open' && /^\/?$/.test(url.pathname)) {
      if (url.username || url.password || url.port) return null;
      params = url.hash ? new URLSearchParams(url.hash.slice(1)) : url.searchParams;
    } else {
      const trusted = new URL(base);
      // Android also verifies HTTP links for this host. Handle them locally,
      // with the same account, instead of sending them through a web redirect.
      const trustedOrigin = url.origin === trusted.origin ||
        (url.protocol === 'http:' && trusted.protocol === 'https:' && url.host === trusted.host);
      if (!['https:', 'http:'].includes(url.protocol) || !trustedOrigin ||
          url.pathname.replace(/\/$/, '') !== trusted.pathname.replace(/\/$/, '') ||
          url.username || url.password) return null;
      params = new URLSearchParams(url.hash.slice(1));
    }
    const keys = LINK_KEYS.filter((key) => params.has(key));
    if (keys.length !== 1) return null;
    const key = keys[0];
    const values = params.getAll(key);
    if (values.length !== 1) return null;
    const value = values[0];
    if (key === 'share' ? !/^[A-Za-z0-9_-]{1,4000}$/.test(value) : !SLUG.test(value)) return null;
    return `#${new URLSearchParams({ [key]: value })}`;
  } catch {
    return null;
  }
}

export type MobilePlatform = 'android' | 'ios';

export function mobilePlatform(userAgent: string, touchPoints = 0): MobilePlatform | null {
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && touchPoints > 1)) return 'ios';
  return null;
}

/** Query encoding keeps the share fragment out of Android's #Intent metadata. */
export function appLaunchUrl(raw: string, platform: MobilePlatform, base = publicAppUrl()): string | null {
  const hash = incomingLinkHash(raw, base);
  if (!hash) return null;
  const query = hash.slice(1);
  if (platform === 'ios') return `rootin://open?${query}`;
  const fallback = new URL(base);
  fallback.searchParams.set(APP_LINK_FALLBACK, '1');
  fallback.hash = hash;
  return `intent://open?${query}#Intent;scheme=rootin;package=app.rootin.android;S.browser_fallback_url=${encodeURIComponent(fallback.href)};end`;
}

/** Emits even for the same link reopened after its dialog was dismissed. */
export function applyIncomingLink(raw: string, base = publicAppUrl()): boolean {
  const hash = incomingLinkHash(raw, base);
  if (!hash) return false;
  const before = window.location.href;
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${hash}`);
  window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL: before, newURL: window.location.href }));
  return true;
}
