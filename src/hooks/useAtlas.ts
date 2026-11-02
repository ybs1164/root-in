import { useEffect, useMemo, useState } from 'react';
import type { LonLat } from '../domain/districtMap';
import { outlinePath, planAtlas, regionName, stopOnCanvas, type AtlasIsland, type AtlasPlan } from '../domain/atlas';
import { dayMap, type DayMap, type MapPart, type MapPoint, type TerrainShapes } from '../domain/miniMap';
import type { GroupPingMark } from '../map/courseMap';
import { terrainService } from '../services/terrainService';
import { StaticAdminAreaService } from '../services/adminAreaService';
import koreaOutline from '../assets/koreaOutline.json';

export interface AtlasIslandView extends AtlasIsland {
  key: string;
  /** '서울 성동구' once the 시군구 under it is known. */
  name: string | null;
  /** Its picture's map parts (TODAY's 미니맵), none until its real map is in. */
  parts: MapPart[];
}

export interface Atlas {
  plan: AtlasPlan;
  islands: AtlasIslandView[];
  /** Where each mark (`member|seq`) stands on the canvas. */
  spots: Map<string, MapPoint>;
  /** Which island each mark (`member|seq`) is on (a leg between two islands is a jump, drawn dotted). */
  islandOf: Map<string, number>;
  /** Korea behind the islands, bent with them. */
  outline: string;
}

export const markKey = (member: string, seq: number) => `${member}|${seq}`;
const spotKey = (c: LonLat) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`;

const admin = new StaticAdminAreaService();
/** A region's name by its middle (the same island comes back every refresh and every reopening). */
const names = new Map<string, Promise<string | null>>();
const nameAt = (c: LonLat): Promise<string | null> => {
  const key = `${c[0].toFixed(3)},${c[1].toFixed(3)}`;
  let entry = names.get(key);
  if (!entry) {
    entry = admin.sggNamesAt(c).then((n) => (n ? regionName(n.sido, n.sgg) : null)).catch(() => null);
    names.set(key, entry);
  }
  return entry;
};

/** Each island's picture on its real map, kept by its stops (TODAY's `dayMap` is heavy: one island a tick). */
const pictures = new Map<string, { shapes: TerrainShapes; map: DayMap }>();

/**
 * A group's marks as an atlas: the plan (islands placed on the canvas), each
 * island's picture — its stops laid out as TODAY lays out a day, on its real
 * map once that's fetched (until then a plain island with the stops on their
 * own fit) — the marks' spots, and the bent Korea behind. The plan follows
 * only where the pings are: picking a member or tapping a ping moves nothing.
 */
export function useAtlas(marks: GroupPingMark[]): Atlas {
  // The distinct spots, in the marks' order (each member's day in turn: TODAY's leg-by-leg layout reads them as paths).
  const spots = useMemo(() => {
    const index = new Map<string, number>();
    const centers: LonLat[] = [];
    for (const m of marks) {
      const k = spotKey(m.center);
      if (!index.has(k)) {
        index.set(k, centers.length);
        centers.push(m.center);
      }
    }
    return { index, centers, key: centers.map(spotKey).join(' ') };
  }, [marks]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plan = useMemo(() => planAtlas(spots.centers), [spots.key]);
  const outline = useMemo(() => outlinePath(koreaOutline.rings, plan), [plan]);
  const islandKeys = useMemo(() => plan.islands.map((island) => island.stops.map((i) => spotKey(spots.centers[i])).join(' ')), [plan, spots]);

  const [terrain, setTerrain] = useState<Map<string, TerrainShapes | null>>(new Map());
  const [drawn, setDrawn] = useState(0);
  const [named, setNamed] = useState<Map<string, string | null>>(new Map());

  useEffect(() => {
    let alive = true;
    plan.islands.forEach((island, i) => {
      const key = islandKeys[i];
      const stops = island.stops.map((s) => spots.centers[s]);
      void terrainService.fetch(stops).then((shapes) => alive && setTerrain((t) => (t.get(key) === shapes ? t : new Map(t).set(key, shapes))));
      void nameAt(island.center).then((name) => alive && setNamed((n) => (n.get(key) === name ? n : new Map(n).set(key, name))));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [islandKeys]);

  // One island's real picture a tick, so a nine-region day doesn't freeze the screen while it's drawn.
  useEffect(() => {
    const todo = plan.islands.findIndex((_, i) => {
      const shapes = terrain.get(islandKeys[i]);
      return shapes && pictures.get(islandKeys[i])?.shapes !== shapes;
    });
    if (todo < 0) return;
    const id = setTimeout(() => {
      const key = islandKeys[todo];
      const shapes = terrain.get(key)!;
      pictures.set(key, { shapes, map: dayMap(shapes, plan.islands[todo].stops.map((s) => spots.centers[s]), -1) });
      setDrawn((n) => n + 1);
    }, 0);
    return () => clearTimeout(id);
  }, [plan, islandKeys, terrain, drawn, spots]);

  return useMemo(() => {
    const islands = plan.islands.map((island, i): AtlasIslandView & { points: MapPoint[] } => {
      const key = islandKeys[i];
      const shapes = terrain.get(key);
      const real = shapes ? pictures.get(key) : undefined;
      const map = real && real.shapes === shapes ? real.map : dayMap(null, island.stops.map((s) => spots.centers[s]), -1);
      return { ...island, key, name: named.get(key) ?? null, parts: map.parts, points: map.points };
    });
    const where = new Map<number, { at: MapPoint; island: number }>();
    islands.forEach((island, n) => island.stops.forEach((s, k) => where.set(s, { at: stopOnCanvas(island, island.points[k]), island: n })));
    const markSpots = new Map<string, MapPoint>();
    const islandOf = new Map<string, number>();
    for (const m of marks) {
      const spot = where.get(spots.index.get(spotKey(m.center)) ?? -1);
      if (!spot) continue;
      markSpots.set(markKey(m.member, m.seq), spot.at);
      islandOf.set(markKey(m.member, m.seq), spot.island);
    }
    return { plan, islands, spots: markSpots, islandOf, outline };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, outline, islandKeys, terrain, named, drawn, marks, spots]);
}
