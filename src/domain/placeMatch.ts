import { haversineMeters } from './geo';
import type { PlaceKind } from './placeKinds';

// Matching a place to the 상가정보 shops around it (docs/plan-auto-icon.md, I6).
// The shop files come from scripts/place-kinds/build_places.py; names there
// went through the same normalisation as below (scripts/place-kinds/name-cases.json
// is checked against both).

/** One shop as the app keeps it: normalised name, point ×1e5, kind. */
export interface KindShop {
  name: string;
  x: number;
  y: number;
  kind: PlaceKind;
}

/** A shop whose name matches counts this far away (coordinates differ by source). */
export const NAME_MATCH_RADIUS_M = 40;
/** Without a matching name, only shops this close — and all of one kind — say anything. */
export const POINT_MATCH_RADIUS_M = 15;
const NAME_MAX = 20;
const SIMILAR = 0.6;

const BRACKETS = /\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|<[^>]*>/gu;
const COMPANY = /주식회사|유한회사|㈜/gu;
// Only a separate last word: "스타벅스 성수점" → "스타벅스", while "홍콩반점" stays.
const BRANCH_WORD = /^\S{1,12}(점|지점|호점)$/u;
const DROP = /[^0-9a-z가-힣]/gu;

/** Same rules as build_places.py `normalize_name`. */
export function normalizePlaceName(name: string, branch = ''): string {
  let s = name.normalize('NFKC').toLowerCase().replace(BRACKETS, ' ').replace(COMPANY, ' ');
  let words = s.split(/\s+/u).filter(Boolean);
  if (words.length > 1 && BRANCH_WORD.test(words[words.length - 1])) words = words.slice(0, -1);
  s = words.join('').replace(DROP, '');
  const b = branch.normalize('NFKC').toLowerCase().replace(DROP, '');
  if (b && s.endsWith(b) && s.length > b.length) s = s.slice(0, -b.length);
  return Array.from(s).slice(0, NAME_MAX).join('');
}

const bigrams = (s: string): string[] => {
  const chars = Array.from(s);
  return chars.slice(1).map((c, i) => chars[i] + c);
};

/** Same shop by name: equal, one inside the other (2+ letters), or mostly the same letter pairs. */
export function namesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (Array.from(short).length >= 2 && long.includes(short)) return true;
  const pa = bigrams(a);
  const pb = bigrams(b);
  if (!pa.length || !pb.length) return false;
  const rest = [...pb];
  let common = 0;
  for (const p of pa) {
    const i = rest.indexOf(p);
    if (i >= 0) {
      common++;
      rest.splice(i, 1);
    }
  }
  return (2 * common) / (pa.length + pb.length) >= SIMILAR;
}

const point = (s: KindShop): [number, number] => [s.x / 1e5, s.y / 1e5];

/**
 * The kind of the place at `center` called `name`: the nearest shop within
 * 40m with a matching name; failing that, when `byPointOnly` (a spot the
 * user picked, not a named search result), the one kind of every shop within
 * 15m. Otherwise null — a general pin beats a wrong icon.
 */
export function matchKind(shops: readonly KindShop[], center: [number, number], name: string | null, byPointOnly: boolean): PlaceKind | null {
  // A cheap box first: files hold tens of thousands of shops.
  const dy = (NAME_MATCH_RADIUS_M / 111_320) * 1e5;
  const dx = dy / Math.max(0.2, Math.cos((center[1] * Math.PI) / 180));
  const cx = center[0] * 1e5;
  const cy = center[1] * 1e5;
  const near: { shop: KindShop; m: number }[] = [];
  for (const shop of shops) {
    if (Math.abs(shop.x - cx) > dx || Math.abs(shop.y - cy) > dy) continue;
    const m = haversineMeters(center, point(shop));
    if (m <= NAME_MATCH_RADIUS_M) near.push({ shop, m });
  }
  near.sort((a, b) => a.m - b.m);

  const wanted = name ? normalizePlaceName(name) : '';
  const named = wanted && near.find(({ shop }) => namesMatch(wanted, shop.name));
  if (named) return named.shop.kind;
  if (!byPointOnly) return null;
  const kinds = new Set(near.filter(({ m }) => m <= POINT_MATCH_RADIUS_M).map(({ shop }) => shop.kind));
  return kinds.size === 1 ? [...kinds][0] : null;
}
