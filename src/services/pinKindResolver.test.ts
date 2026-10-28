import { describe, expect, it, vi } from 'vitest';
import type { Pin } from '../types/pin';
import { resolvePinKinds } from './pinKindResolver';
import type { PlaceKindService } from './placeKindService';

const pins: Pin[] = Array.from({ length: 8 }, (_, i) => ({ id: `pin-${i}`, userId: 'user', categoryId: 'none', createdAt: '2026-10-01', place: { id: String(i), name: `장소 ${i}`, center: [127, 37] } }));

describe('older pin kind enrichment', () => {
  it('limits concurrent lookups and keeps successful matches after individual failures', async () => {
    let active = 0;
    let peak = 0;
    const lookup: PlaceKindService['lookup'] = vi.fn(async (place) => {
      peak = Math.max(peak, ++active);
      await Promise.resolve();
      active--;
      if (place.id === '1') throw new Error('offline');
      return place.id === '2' ? null : 'cafe';
    });
    const matches = await resolvePinKinds(pins, { lookup }, new AbortController().signal);
    expect(peak).toBeLessThanOrEqual(3);
    expect(matches.map((m) => m.pinId).sort()).toEqual(['pin-0', 'pin-3', 'pin-4', 'pin-5', 'pin-6', 'pin-7']);
  });

  it('stops starting new work when the component is closed and ignores late answers', async () => {
    const controller = new AbortController();
    const lookup = vi.fn(async () => { controller.abort(); return 'cafe' as const; });
    expect(await resolvePinKinds(pins, { lookup }, controller.signal)).toEqual([]);
    expect(lookup).toHaveBeenCalledOnce();
  });
});
