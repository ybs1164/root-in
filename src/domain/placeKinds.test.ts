import { describe, expect, it } from 'vitest';
import semasCodes from '../../scripts/place-kinds/semas-codes-202606.csv?raw';
import semasMapping from '../../scripts/place-kinds/mapping-semas.csv?raw';
import { PIN_ICON_GROUPS } from './categoryIcons';
import { isPlaceKind, KIND_GROUPS, KIND_ICON, kindIcon, PLACE_KINDS } from './placeKinds';

const rows = (csv: string) => csv.trim().split(/\r?\n/).slice(1);

describe('place kinds', () => {
  it('draws every kind with one of a few broad group icons', () => {
    const groups = KIND_GROUPS.map((g) => g.icon);
    expect(new Set(groups).size).toBe(groups.length);
    expect(new Set(Object.values(KIND_ICON))).toEqual(new Set(groups));
    expect(groups.length).toBeLessThanOrEqual(16);
    // Specific foods fold into 식당, sweets into 카페·디저트.
    for (const k of ['noodle', 'chicken', 'japanese', 'pizza', 'burger'] as const) expect(KIND_ICON[k]).toBe('food');
    for (const k of ['bakery', 'donut', 'icecream', 'tea'] as const) expect(KIND_ICON[k]).toBe('cafe');
  });

  it('gives every kind an icon the picker still offers', () => {
    const offered = new Set(PIN_ICON_GROUPS.flatMap((g) => g.icons));
    for (const kind of PLACE_KINDS) expect(offered.has(KIND_ICON[kind]), kind).toBe(true);
  });

  it('keeps ids storable: lowercase snake case', () => {
    for (const kind of PLACE_KINDS) expect(kind).toMatch(/^[a-z]+(_[a-z]+)*$/);
  });

  it('accepts only known kinds from untrusted input', () => {
    expect(isPlaceKind('cafe')).toBe(true);
    expect(isPlaceKind('toString')).toBe(false);
    expect(isPlaceKind('Cafe')).toBe(false);
    expect(isPlaceKind(1)).toBe(false);
    expect(kindIcon('bakery')).toBe('cafe');
    expect(kindIcon(null)).toBeNull();
    expect(kindIcon('nope' as never)).toBeNull();
  });
});

describe('상가정보 mapping (scripts/place-kinds/mapping-semas.csv)', () => {
  const mapping = rows(semasMapping).map((line) => {
    const m = line.match(/^(\w+),(?:"[^"]*"|[^,]*),(\d+),([a-z_]*),/);
    if (!m) throw new Error(`bad mapping row: ${line}`);
    return { code: m[1], kind: m[3] };
  });

  it('covers every 소분류 code exactly once', () => {
    const codes = rows(semasCodes).map((line) => line.split(',')[4]);
    expect(codes).toHaveLength(247);
    expect(mapping.map((r) => r.code).sort()).toEqual([...codes].sort());
  });

  it('maps only to known kinds (blank = general pin)', () => {
    for (const { code, kind } of mapping) if (kind) expect(isPlaceKind(kind), `${code} → ${kind}`).toBe(true);
  });

  it('pins down the obvious ones', () => {
    const kindOf = Object.fromEntries(mapping.map((r) => [r.code, r.kind]));
    expect(kindOf.I21201).toBe('cafe');
    expect(kindOf.I21001).toBe('bakery');
    expect(kindOf.G20405).toBe('convenience');
    expect(kindOf.S20701).toBe('salon');
    expect(kindOf.L10203).toBe(''); // 부동산
    expect(kindOf.S20601).toBe(''); // 수선업, not a clothes shop
  });
});
