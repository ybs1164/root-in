import { DEFAULT_CATEGORIES } from '../domain/pin';
import { DEFAULT_FOLDER_ICON, isFolderIcon, ROUTE_FOLDER_LIMITS, type RouteFolders } from '../domain/routeFolders';
import { cleanRouteLook } from '../domain/routeStyle';
import { getCurrentUserId } from '../lib/currentUser';
import { THEME_LABELS, TRAVEL_MODE_LABELS, type Course, type CourseStop, type CourseTheme, type TravelMode } from '../types/course';
import type { Pin, PinCategory } from '../types/pin';
import { localCourses } from './courseRepository';
import { compactDecor, isBlankDecor, loadDays, parseDays, saveDays } from './dayRepository';
import { isCategory, isPin, readStoredCategories, readStoredPins, writeStoredCategories, writeStoredPins } from './pinRepository';
import { loadRouteFolders, saveRouteFolders } from './routeFolderRepository';
import type { SyncCollection } from './syncBus';
import type { Rows, SyncRow } from './syncMerge';

// Each synced store as rows of its server table (supabase/migrations). A row
// is built the same way from this device's data and from the server's — the
// server's goes through this device's own checks first — so the same content
// always hashes the same on both sides.

export interface SyncCollectionDef {
  name: SyncCollection;
  table: string;
  /** The row key column (besides user_id). */
  idColumn: string;
  /** Columns read back; the row's keys. */
  columns: readonly string[];
  readLocal(): Rows;
  writeLocal(rows: Rows): void;
  /** A server row, checked; null drops it. */
  fromRemote(raw: Record<string, unknown>): SyncRow | null;
  /** Extra or replaced columns when sending (computed, never read back). */
  toServer?(row: SyncRow): SyncRow;
  /** This device's rows before it ever synced, when they're only seeds (categories). */
  seeds?(): Rows;
}

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Timestamps as JS writes them, whatever form Postgres returns (it adds +00:00 and microseconds). */
export function iso(v: unknown): string {
  const time = typeof v === 'string' ? Date.parse(v) : NaN;
  return new Date(Number.isNaN(time) ? 0 : time).toISOString();
}

const byId = (rows: SyncRow[], key = 'id'): Rows => new Map(rows.map((row) => [String(row[key]), row]));
const sortByOrder = (rows: Rows) => [...rows.values()].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0) || String(a.id).localeCompare(String(b.id)));

// ── 핀 카테고리 ──────────────────────────────────────────────────────────
const categoryRow = (c: PinCategory): SyncRow => ({ id: c.id, name: c.name.slice(0, 12), icon: c.icon, color: String(c.color), position: c.order });

const categoryFrom = (raw: Record<string, unknown>): PinCategory | null => {
  const color = typeof raw.color === 'string' && /^[1-8]$/.test(raw.color) ? Number(raw.color) : raw.color;
  const category = { id: raw.id, name: raw.name, icon: raw.icon, color, order: finite(raw.position) ? raw.position : 0 };
  return isCategory(category) ? (category as PinCategory) : null;
};

export const categoriesCollection: SyncCollectionDef = {
  name: 'categories',
  table: 'pin_categories',
  idColumn: 'id',
  columns: ['id', 'name', 'icon', 'color', 'position'],
  readLocal: () => byId((readStoredCategories() ?? DEFAULT_CATEGORIES).map(categoryRow)),
  writeLocal: (rows) => writeStoredCategories(sortByOrder(rows).map((row) => categoryFrom(row)).filter((c): c is PinCategory => !!c)),
  fromRemote: (raw) => {
    const category = categoryFrom(raw);
    return category && categoryRow(category);
  },
  seeds: () => byId(DEFAULT_CATEGORIES.map(categoryRow)),
};

// ── 핀 ───────────────────────────────────────────────────────────────────
const pinRow = (p: Pin): SyncRow => ({
  id: p.id,
  category_id: p.categoryId,
  place: p.place,
  memo: p.memo ? p.memo.slice(0, 120) : null,
  created_at: iso(p.createdAt),
  updated_at: p.updatedAt ? iso(p.updatedAt) : null,
});

const pinFrom = (raw: Record<string, unknown>, userId: string): Pin | null => {
  const pin = {
    id: raw.id,
    userId,
    categoryId: raw.category_id,
    place: raw.place,
    ...(str(raw.memo, 120) ? { memo: str(raw.memo, 120) } : {}),
    createdAt: iso(raw.created_at),
    ...(raw.updated_at ? { updatedAt: iso(raw.updated_at) } : {}),
  };
  return isPin(pin) ? pin : null;
};

export const pinsCollection: SyncCollectionDef = {
  name: 'pins',
  table: 'pins',
  idColumn: 'id',
  columns: ['id', 'category_id', 'place', 'memo', 'created_at', 'updated_at'],
  readLocal: () => byId(readStoredPins().map(pinRow)),
  writeLocal: (rows) => {
    const userId = getCurrentUserId();
    writeStoredPins([...rows.values()].map((row) => pinFrom(row, userId)).filter((p): p is Pin => !!p));
  },
  fromRemote: (raw) => {
    const pin = pinFrom(raw, '');
    return pin && pinRow(pin);
  },
  // geom (for nearby lookups) is filled by the server from place.center.
};

// ── 루트 폴더 ────────────────────────────────────────────────────────────
const folderFrom = (raw: Record<string, unknown>): SyncRow | null => {
  const id = str(raw.id, 64);
  const name = typeof raw.name === 'string' ? raw.name.slice(0, ROUTE_FOLDER_LIMITS.name) : null;
  if (!id || name === null) return null;
  return { id, name, icon: isFolderIcon(raw.icon) ? raw.icon : DEFAULT_FOLDER_ICON, position: finite(raw.position) ? raw.position : 0 };
};

export const foldersCollection: SyncCollectionDef = {
  name: 'folders',
  table: 'route_folders',
  idColumn: 'id',
  columns: ['id', 'name', 'icon', 'position'],
  readLocal: () => byId(loadRouteFolders().folders.map((f, position) => ({ id: f.id, name: f.name, icon: f.icon, position }))),
  writeLocal: (rows) => {
    const folders = sortByOrder(rows)
      .slice(0, ROUTE_FOLDER_LIMITS.maxFolders)
      .map((row) => ({ id: String(row.id), name: String(row.name), icon: String(row.icon) }));
    const state = loadRouteFolders();
    const ids = new Set(folders.map((f) => f.id));
    const assign = Object.fromEntries(Object.entries(state.assign).filter(([, folder]) => ids.has(folder)));
    saveRouteFolders({ ...state, folders, assign });
  },
  fromRemote: folderFrom,
};

// ── 루트 (코스 + 폴더 배정·순서) ─────────────────────────────────────────
const stopFrom = (raw: unknown): CourseStop | null => {
  const s = raw as { place?: Record<string, unknown>; memo?: unknown } | null;
  const p = s?.place;
  const id = str(p?.id, 64);
  const name = str(p?.name, 80);
  const center = p?.center;
  if (!id || !name || !Array.isArray(center) || center.length !== 2 || !center.every(finite)) return null;
  const category = str(p?.category, 40);
  const address = str(p?.address, 120);
  const memo = str(s?.memo, 120);
  return {
    place: { id, name, center: [center[0], center[1]], ...(category ? { category } : {}), ...(address ? { address } : {}) },
    ...(memo ? { memo } : {}),
  };
};

const courseFrom = (raw: Record<string, unknown>, userId: string, shareCount?: number): Course | null => {
  const id = str(raw.id, 64);
  const title = typeof raw.title === 'string' ? raw.title.slice(0, 80) : null;
  if (!id || title === null || !Array.isArray(raw.stops)) return null;
  const stops = raw.stops.map(stopFrom).filter((s): s is CourseStop => !!s);
  const note = str(raw.note, 1000);
  const sharedBy = str(raw.shared_by, 40);
  return {
    id,
    userId,
    title,
    theme: (raw.theme as string) in THEME_LABELS ? (raw.theme as CourseTheme) : 'etc',
    travelMode: (raw.travel_mode as string) in TRAVEL_MODE_LABELS ? (raw.travel_mode as TravelMode) : 'walk',
    stops,
    ...(note ? { note } : {}),
    ...(sharedBy ? { sharedBy } : {}),
    ...cleanRouteLook({ stopShapes: raw.stop_shapes as Course['stopShapes'], edgeStyles: raw.edge_styles as Course['edgeStyles'] }, stops.length),
    ...(shareCount ? { shareCount } : {}),
    createdAt: iso(raw.created_at),
    ...(raw.updated_at ? { updatedAt: iso(raw.updated_at) } : {}),
  };
};

// The share count is the server's to keep (step 3), so it isn't part of the row.
const routeRow = (c: Course, folders: RouteFolders, order: Map<string, number>): SyncRow => ({
  id: c.id,
  folder_id: folders.assign[c.id] ?? null,
  title: c.title,
  theme: c.theme,
  travel_mode: c.travelMode,
  note: c.note ?? null,
  stops: c.stops,
  stop_shapes: c.stopShapes ?? null,
  edge_styles: c.edgeStyles ?? null,
  shared_by: c.sharedBy ?? null,
  position: order.get(c.id) ?? null,
  created_at: iso(c.createdAt),
  updated_at: c.updatedAt ? iso(c.updatedAt) : null,
});

export const routesCollection: SyncCollectionDef = {
  name: 'routes',
  table: 'courses',
  idColumn: 'id',
  columns: ['id', 'folder_id', 'title', 'theme', 'travel_mode', 'note', 'stops', 'stop_shapes', 'edge_styles', 'shared_by', 'position', 'created_at', 'updated_at'],
  readLocal: () => {
    const folders = loadRouteFolders();
    const order = new Map((folders.order ?? []).map((id, i) => [id, i]));
    return byId(localCourses.read().map((c) => routeRow(c, folders, order)));
  },
  writeLocal: (rows) => {
    const userId = getCurrentUserId();
    const counts = new Map(localCourses.read().map((c) => [c.id, c.shareCount]));
    localCourses.write([...rows.values()].map((row) => courseFrom(row, userId, counts.get(String(row.id)))).filter((c): c is Course => !!c));
    // Runs after folders: assignments only to folders this device now has.
    const state = loadRouteFolders();
    const ids = new Set(state.folders.map((f) => f.id));
    const assign: Record<string, string> = {};
    rows.forEach((row, id) => {
      if (typeof row.folder_id === 'string' && ids.has(row.folder_id)) assign[id] = row.folder_id;
    });
    const order = [...rows.values()]
      .filter((row) => finite(row.position))
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((row) => String(row.id));
    saveRouteFolders(order.length ? { folders: state.folders, assign, order } : { folders: state.folders, assign });
  },
  fromRemote: (raw) => {
    const course = courseFrom(raw, '');
    if (!course) return null;
    const folderId = str(raw.folder_id, 64);
    const order = finite(raw.position) ? new Map([[course.id, raw.position]]) : new Map<string, number>();
    return routeRow(course, { folders: [], assign: folderId ? { [course.id]: folderId } : {} }, order);
  },
};

// ── 하루 (날짜 화면 꾸미기, 핑 모양·선) ──────────────────────────────────
const dayRows = (store: ReturnType<typeof loadDays>): Rows => {
  const dates = new Set([...Object.keys(store.decor), ...Object.keys(store.shapes), ...Object.keys(store.edges)].map((k) => k.slice(0, 10)));
  const rows: Rows = new Map();
  for (const day of dates) {
    const of = <T>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).filter(([k]) => k.startsWith(day)));
    const decor = store.decor[day];
    const looks = { shapes: of(store.shapes), edges: of(store.edges) };
    const hasDecor = !!decor && !isBlankDecor(decor);
    if (!hasDecor && !Object.keys(looks.shapes).length && !Object.keys(looks.edges).length) continue;
    rows.set(day, { day, decor: hasDecor ? compactDecor(decor) : null, looks });
  }
  return rows;
};

const asStore = (rows: Iterable<SyncRow>) => {
  const decor: Record<string, unknown> = {};
  const shapes: Record<string, unknown> = {};
  const edges: Record<string, unknown> = {};
  for (const row of rows) {
    const day = String(row.day);
    const looks = (row.looks ?? {}) as { shapes?: Record<string, unknown>; edges?: Record<string, unknown> };
    if (row.decor) decor[day] = row.decor;
    // Only keys of this day: a row can't touch another date.
    for (const [k, v] of Object.entries(looks.shapes ?? {})) if (k.startsWith(day)) shapes[k] = v;
    for (const [k, v] of Object.entries(looks.edges ?? {})) if (k.startsWith(day)) edges[k] = v;
  }
  return parseDays({ decor, shapes, edges });
};

export const daysCollection: SyncCollectionDef = {
  name: 'days',
  table: 'days',
  idColumn: 'day',
  columns: ['day', 'decor', 'looks'],
  readLocal: () => dayRows(loadDays()),
  writeLocal: (rows) => saveDays(asStore(rows.values())),
  fromRemote: (raw) => {
    if (typeof raw.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.day)) return null;
    return dayRows(asStore([raw])).get(raw.day) ?? null;
  },
  toServer: (row) => ({ ...row, decor: row.decor ?? {} }),
};

/** In write order: folders before the routes that point at them. */
export const SYNC_COLLECTIONS: readonly SyncCollectionDef[] = [categoriesCollection, pinsCollection, foldersCollection, routesCollection, daysCollection];
