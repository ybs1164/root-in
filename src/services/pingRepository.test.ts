import { beforeEach, describe, expect, it } from 'vitest';
import type { ExcludedPlace } from '../domain/privacy';
import { loadPings, onPingsChanged, parsePing, recordPing, recordPlacePing, removePing, removePingsOfPin, todayPingOfPin } from './pingRepository';
import { onLocalWrote } from './syncBus';

const place = { id: 'p1', name: '카페', center: [127.05, 37.54] as [number, number], address: '서울 성동구 성수동 1' };
const cafe = { id: 'pin-cafe', place };
const home: ExcludedPlace = { id: 'home', kind: 'home', address: '서울 성동구 성수동 9', center: [127.1, 37.6] };
const now = new Date(2026, 9, 8, 14, 30);

describe('pingRepository', () => {
  beforeEach(() => window.localStorage.clear());

  it('adds a pin to today once a day, and says so', () => {
    const wrote: string[] = [];
    const stopWrote = onLocalWrote((c) => wrote.push(c));
    let changed = 0;
    const stopChanged = onPingsChanged(() => (changed += 1));
    expect(recordPing(cafe, [home], now)).toEqual(expect.any(Function));
    expect(recordPing(cafe, [home], new Date(2026, 9, 8, 16, 0))).toBeNull();
    expect(loadPings()).toEqual([expect.objectContaining({ pinId: 'pin-cafe', day: '2026-10-08', name: '카페', center: place.center, address: place.address })]);
    // The next day it can go in again.
    expect(recordPing(cafe, [home], new Date(2026, 9, 9, 9, 0))).toEqual(expect.any(Function));
    expect(loadPings()[0]).not.toHaveProperty('local');
    expect(wrote).toEqual(['pings', 'pings']);
    expect(changed).toBe(2);
    stopWrote();
    stopChanged();
  });

  it('marks a ping at a 제외 주소 as this phone only', () => {
    recordPing({ ...cafe, place: { ...place, center: [127.1001, 37.6] } }, [home], now);
    expect(loadPings()[0].local).toBe(true);
  });

  it("pings a spot that isn't a pin (a TODAY photo), and finds a pin's ping of today", () => {
    const id = recordPlacePing({ id: 'spot', name: '성수동 골목', center: [127.06, 37.55] }, [], now);
    expect(loadPings()).toEqual([expect.objectContaining({ id, day: '2026-10-08', name: '성수동 골목' })]);
    expect(loadPings()[0]).not.toHaveProperty('pinId');
    // Spots aren't once-a-day: a second photo elsewhere is a second ping.
    expect(recordPlacePing({ id: 'spot2', name: '서울숲', center: [127.04, 37.54] }, [], now)).not.toBe(id);
    recordPing(cafe, [], now);
    expect(todayPingOfPin('pin-cafe', now)).toBe(loadPings()[2].id);
    expect(todayPingOfPin('pin-cafe', new Date(2026, 9, 9))).toBeNull();
  });

  it('takes a ping out of its day with its ✕', () => {
    recordPing(cafe, [], now);
    removePing(loadPings()[0].id);
    expect(loadPings()).toEqual([]);
  });

  it("takes a deleted pin's pings out of every day, and nothing else", () => {
    recordPing(cafe, [], now);
    recordPing(cafe, [], new Date(2026, 9, 9, 9, 0));
    recordPing({ id: 'pin-park', place: { ...place, id: 'p2', name: '공원' } }, [], now);
    removePingsOfPin('pin-cafe');
    expect(loadPings().map((p) => p.name)).toEqual(['공원']);
  });

  it('undo takes the ping back out', () => {
    const undo = recordPing(cafe, [], now)!;
    undo();
    expect(loadPings()).toEqual([]);
  });

  it("doesn't trust what's stored", () => {
    window.localStorage.setItem('goodroot:pings:v1', JSON.stringify([
      { id: 'a', day: '2026-10-08', at: '2026-10-08T05:00:00Z', name: '  ok  ', center: [127, 37.5], local: 'yes' },
      { id: 'a', day: '2026-10-08', at: '2026-10-08T05:00:00Z', name: 'dup', center: [127, 37.5] },
      { id: 'b', day: '2026-13-08', at: '2026-10-08T05:00:00Z', name: 'bad day', center: [127, 37.5] },
      { id: 'c', day: '2026-10-08', at: '2026-10-08T05:00:00Z', name: 'abroad', center: [2.35, 48.85] },
      'junk',
    ]));
    expect(loadPings()).toEqual([{ id: 'a', day: '2026-10-08', at: '2026-10-08T05:00:00.000Z', name: 'ok', center: [127, 37.5] }]);
    expect(parsePing({ id: 'x'.repeat(65), day: '2026-10-08', at: '2026-10-08T05:00:00Z', name: 'n', center: [127, 37.5] })).toBeNull();
  });
});
