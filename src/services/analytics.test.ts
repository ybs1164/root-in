import { describe, expect, it, vi } from 'vitest';
import { createAnalytics, scrubEvent, scrubUrl } from './analytics';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('analytics', () => {
  it('does nothing without a key', () => {
    expect(() => createAnalytics(null).track('share_started', { kind: 'day' })).not.toThrow();
  });

  it('queues events until the library is up, then sends them in order', async () => {
    const capture = vi.fn();
    const a = createAnalytics(async () => ({ capture }));
    a.track('route_build_started', { method: 'drag' });
    a.track('route_build_ready', { stops: 2 });
    await flush();
    a.track('route_created', { stops: 3, has_note: false, in_folder: true });
    expect(capture.mock.calls.map((c) => c[0])).toEqual(['route_build_started', 'route_build_ready', 'route_created']);
  });

  it('drops events quietly when the library fails or throws', async () => {
    const failed = createAnalytics(() => Promise.reject(new Error('blocked')));
    await flush();
    expect(() => failed.track('share_started', { kind: 'route' })).not.toThrow();
    const throwing = createAnalytics(async () => ({ capture: () => { throw new Error('x'); } }));
    await flush();
    expect(() => throwing.track('share_started', { kind: 'route' })).not.toThrow();
  });

  it('cuts URLs to origin and path so share hashes never leave', () => {
    expect(scrubUrl('https://root.in/app/?code=abc#share=TOKEN')).toBe('https://root.in/app/');
    expect(scrubUrl('route_created')).toBe('route_created');
    expect(scrubEvent({ event: 'x', properties: { $current_url: 'http://localhost:5188/#s=abcdefghij', stops: 2 } }).properties).toEqual({
      $current_url: 'http://localhost:5188/',
      stops: 2,
    });
  });
});
