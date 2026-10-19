import type { LonLat } from '../domain/districtMap';
import { isPlaceKind, type PlaceKind } from '../domain/placeKinds';
import { matchKind, type KindShop } from '../domain/placeMatch';
import type { PlaceRef } from '../types/course';
import { StaticAdminAreaService } from './adminAreaService';
import { UNNAMED_SPOT } from './placeSearch/placeSearchService';

/**
 * Fills in what kind of place a pin is when its source didn't say (a long
 * press, an aimed spot, a Photon result with no known tag), from the 상가정보
 * files in korea/places/ (scripts/place-kinds/README.md). Never rejects:
 * missing data, a failed fetch or no confident match all give null.
 */
export interface PlaceKindService {
  lookup(place: PlaceRef, signal?: AbortSignal): Promise<PlaceKind | null>;
}

const BASE = `${import.meta.env.BASE_URL}korea/places/`;
const FORMAT_VERSION = 1;
const MAX_NAME = 40;

/** Static files, but still checked: bad rows are skipped, a bad file is ignored. */
export function parseKindShops(value: unknown): KindShop[] | null {
  const v = value as { v?: unknown; k?: unknown; r?: unknown } | null;
  if (!v || v.v !== FORMAT_VERSION || !Array.isArray(v.k) || !Array.isArray(v.r)) return null;
  const kinds = v.k.map((k) => (isPlaceKind(k) ? k : null));
  const shops: KindShop[] = [];
  for (const row of v.r as unknown[]) {
    if (!Array.isArray(row) || row.length !== 4) continue;
    const [name, x, y, k] = row as unknown[];
    const kind = Number.isInteger(k) ? kinds[k as number] : null;
    if (typeof name !== 'string' || !name || name.length > MAX_NAME || !kind) continue;
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    shops.push({ name, x: x as number, y: y as number, kind });
  }
  return shops;
}

/** A spot the user picked on the map (long press, aiming), not a named search result. */
export const isPickedSpot = (place: PlaceRef) => place.id.startsWith('pin:');

export class StaticPlaceKindService implements PlaceKindService {
  private files = new Map<string, Promise<KindShop[] | null>>();

  constructor(
    /** The 시군구 code under a point; the places files use the same codes as korea/admin. */
    private readonly areaCodeAt: (point: LonLat) => Promise<string | null>,
    private readonly base: string = BASE,
  ) {}

  private load(code: string): Promise<KindShop[] | null> {
    let entry = this.files.get(code);
    if (!entry) {
      // Not tied to one lookup's signal: closing a card must not poison the cache.
      entry = fetch(`${this.base}${code}.json`)
        .then(async (response) => (response.ok ? parseKindShops(await response.json()) : null))
        .catch(() => null);
      entry.then((shops) => { if (!shops) this.files.delete(code); });
      this.files.set(code, entry);
    }
    return entry;
  }

  async lookup(place: PlaceRef, signal?: AbortSignal): Promise<PlaceKind | null> {
    try {
      const code = await this.areaCodeAt(place.center);
      if (!code || !/^\d{5}$/.test(code) || signal?.aborted) return null;
      const shops = await this.load(code);
      if (!shops || signal?.aborted) return null;
      const picked = isPickedSpot(place);
      // A picked spot is named by its building, or only by its address (or not
      // at all yet) — and an address contains too many shop names to compare.
      const name = picked && (place.name === place.address || place.name === UNNAMED_SPOT) ? null : place.name;
      return matchKind(shops, place.center, name, picked);
    } catch {
      return null;
    }
  }
}

const admin = new StaticAdminAreaService();
export const placeKindService: PlaceKindService = new StaticPlaceKindService((point) => admin.sggCodeAt(point));
