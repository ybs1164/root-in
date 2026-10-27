import { describe, expect, it } from 'vitest';
import type { Pin } from '../types/pin';
import { pinKindKey, withPinKinds } from './pinKinds';
import { pinStyle } from './pin';

const pin: Pin = { id: 'one', userId: 'user', categoryId: 'favorites', memo: '내 메모', createdAt: '2026-10-01', place: { id: 'cafe', name: '동네 카페', center: [127, 37] } };
const match = { pinId: pin.id, placeKey: pinKindKey(pin.place), kind: 'cafe' as const };

describe('saved place icons', () => {
  it('fills the kind while preserving a category and edits made during lookup', () => {
    const latest = { ...pin, memo: '새 메모', categoryId: 'visited' };
    const [next] = withPinKinds([latest], [match], '2026-10-28');
    expect(next).toMatchObject({ memo: '새 메모', categoryId: 'visited', updatedAt: '2026-10-28', place: { kind: 'cafe' } });
    expect(pinStyle([], next.categoryId, next.place).icon).toBe('cafe');
    expect(pinStyle([{ id: 'visited', name: '다녀온 곳', icon: 'heart', color: 2, order: 0 }], next.categoryId, next.place).icon).toBe('heart');
  });

  it('does not replace a known kind, undo a rename or resurrect a deleted pin', () => {
    const known = [{ ...pin, place: { ...pin.place, kind: 'bakery' as const } }];
    expect(withPinKinds(known, [match])).toBe(known);
    for (const place of [{ ...pin.place, name: '이름 수정' }, { ...pin.place, center: [128, 37] as [number, number] }]) {
      const latest = [{ ...pin, place }];
      expect(withPinKinds(latest, [match])).toBe(latest);
    }
    expect(withPinKinds([], [match])).toEqual([]);
  });

  it('keeps unmatched pins as they were without triggering another save', () => {
    const pins = [pin];
    expect(withPinKinds(pins, [])).toBe(pins);
  });
});
