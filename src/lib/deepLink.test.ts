import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_LINK_FALLBACK, appLaunchUrl, applyIncomingLink, incomingLinkHash, mobilePlatform } from './deepLink';
import { encodeSharedCourse } from '../services/courseShareService';
import { samplePlaces } from '../test/fixtures';

const base = 'https://ybs1164.github.io/root-in/';

describe('incoming app links', () => {
  it.each(['s', 'c', 'g'])('keeps the %s destination across web, iOS and Android links', (key) => {
    const original = `${base}#${key}=Abcdef1234`;
    const ios = appLaunchUrl(original, 'ios', base)!;
    expect(incomingLinkHash(original, base)).toBe(`#${key}=Abcdef1234`);
    expect(incomingLinkHash(ios, base)).toBe(`#${key}=Abcdef1234`);
    const android = appLaunchUrl(original, 'android', base)!;
    expect(incomingLinkHash(android.split('#Intent;')[0].replace('intent:', 'rootin:'), base)).toBe(`#${key}=Abcdef1234`);
    expect(android).toContain('package=app.rootin.android;');
    const fallback = new URL(decodeURIComponent(android.match(/S.browser_fallback_url=([^;]+)/)![1]));
    expect(fallback.hash).toBe(`#${key}=Abcdef1234`);
    expect(fallback.searchParams.get(APP_LINK_FALLBACK)).toBe('1');
  });

  it('round-trips a real course token without confusing its fragment with Intent metadata', () => {
    const token = encodeSharedCourse({
      title: '성수 데이트 🌿', theme: 'date', travelMode: 'walk',
      stops: [{ place: samplePlaces.onionSeongsu }, { place: samplePlaces.seoulForest }],
      sharedAt: '2026-10-28T00:00:00.000Z',
    }).token;
    const raw = `${base}#share=${token}`;
    expect(incomingLinkHash(appLaunchUrl(raw, 'ios', base)!, base)).toBe(`#share=${token}`);
    expect(appLaunchUrl(raw, 'android', base)).toContain(`?share=${token}#Intent;`);
  });

  it.each([
    'https://evil.example/root-in/#g=abcdefghij',
    'https://ybs1164.github.io/other/#g=abcdefghij',
    'https://ybs1164.github.io/root-in/other/#g=abcdefghij',
    'https://user:pass@ybs1164.github.io/root-in/#g=abcdefghij',
    'javascript:alert(1)',
    'rootin://elsewhere?g=abcdefghij',
    'rootin://open/elsewhere?g=abcdefghij',
    'rootin://user:pass@open?g=abcdefghij',
    'rootin://open?g=short',
    'rootin://open?g=abcdefghij&g=klmnopqrst',
    'rootin://open?g=abcdefghij&s=klmnopqrst',
    'rootin://open?share=bad%3BIntent%3B',
    `rootin://open?share=${'x'.repeat(4001)}`,
    'rootin://open?access_token=secret',
    'not a URL',
  ])('ignores untrusted, malformed or ambiguous URLs: %s', (raw) => {
    expect(incomingLinkHash(raw, base)).toBeNull();
    expect(appLaunchUrl(raw, 'android', base)).toBeNull();
  });

  it('passes only the destination, dropping unrelated query/hash data', () => {
    expect(incomingLinkHash(`${base}?code=secret#access_token=secret&g=abcdefghij`, base)).toBe('#g=abcdefghij');
    expect(incomingLinkHash('rootin://open/#g=abcdefghij', base)).toBe('#g=abcdefghij');
    expect(incomingLinkHash(`${base.slice(0, -1)}#g=abcdefghij`, base)).toBe('#g=abcdefghij');
  });

  it('also accepts a configured host and base path', () => {
    const custom = 'https://links.example/app/';
    expect(incomingLinkHash(`${custom}#s=abcdefghij`, custom)).toBe('#s=abcdefghij');
    expect(incomingLinkHash(`${base}#s=abcdefghij`, custom)).toBeNull();
  });
});

describe('routing within the native WebView', () => {
  let location: URL;
  const dispatch = vi.fn();
  beforeEach(() => {
    location = new URL('https://localhost/?local=keep');
    dispatch.mockClear();
    vi.stubGlobal('location', location);
    vi.stubGlobal('history', {
      state: { kept: true },
      replaceState: vi.fn((_state, _title, path) => { location.href = new URL(path, location).href; }),
    });
    vi.stubGlobal('HashChangeEvent', class extends Event {});
    vi.stubGlobal('dispatchEvent', dispatch);
  });

  it('keeps the local origin and notifies existing URL readers on every delivery', () => {
    expect(applyIncomingLink('rootin://open?g=abcdefghij', base)).toBe(true);
    expect(location.href).toBe('https://localhost/?local=keep#g=abcdefghij');
    expect(applyIncomingLink('rootin://open?g=abcdefghij', base)).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[0][0].type).toBe('hashchange');
    expect(applyIncomingLink(`${base}#c=klmnopqrst`, base)).toBe(true);
    expect(location.hash).toBe('#c=klmnopqrst');
  });

  it('leaves the current screen untouched for unrelated links', () => {
    expect(applyIncomingLink('https://evil.example/#g=abcdefghij', base)).toBe(false);
    expect(location.href).toBe('https://localhost/?local=keep');
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('mobile browser detection', () => {
  it('offers app opening on Android, iPhone and iPads using desktop Safari', () => {
    expect(mobilePlatform('Mozilla/5.0 (Linux; Android 15)')).toBe('android');
    expect(mobilePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('ios');
    expect(mobilePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 5)).toBe('ios');
    expect(mobilePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 0)).toBeNull();
    expect(mobilePlatform('Mozilla/5.0 (Windows NT 10.0)')).toBeNull();
  });
});
