import type { Course } from '../types/course';

/**
 * 경로 폴더: the user's own index tabs for sorting saved routes (courses).
 * A route sits in at most one folder; one in none is 미분류. Kept apart from
 * the courses themselves so the course store and share links don't change.
 */
export interface RouteFolder {
  id: string;
  /** Shown on tabs and folder choosers. */
  name: string;
  /** What the folder's index tab shows, one of FOLDER_ICONS. */
  icon: string;
}

/** Icons a folder's tab can wear; the first is a new folder's. */
export const FOLDER_ICONS = [
  '📁', '❤️', '⭐', '🍽️', '☕', '🍷', '🏖️', '✈️', '🚗', '🌳', '⛰️', '🏛️', '🎉', '🛍️', '📷', '🎵', '🏠', '🌙',
] as const;

export const DEFAULT_FOLDER_ICON = FOLDER_ICONS[0];

export const isFolderIcon = (v: unknown): v is string => typeof v === 'string' && (FOLDER_ICONS as readonly string[]).includes(v);

export interface RouteFolders {
  folders: RouteFolder[];
  /** Course id → folder id. Missing (or pointing at a gone folder) = 미분류. */
  assign: Record<string, string>;
  /**
   * Routes in the order the user dragged them into (course ids). Absent
   * until the first drag; routes not in it (new ones) come first, newest first.
   */
  order?: string[];
}

/** The fixed tabs before the user's folders. */
export type RouteTab = 'all' | 'none' | string;

export const ROUTE_FOLDER_LIMITS = { maxFolders: 20, name: 12 } as const;

export const EMPTY_ROUTE_FOLDERS: RouteFolders = { folders: [], assign: {} };

/** '#1', '#2', … skipping names already taken. */
export function nextFolderName(folders: RouteFolder[]): string {
  const taken = new Set(folders.map((f) => f.name));
  let n = 1;
  while (taken.has(`#${n}`)) n += 1;
  return `#${n}`;
}

export function addFolder(state: RouteFolders, id: string, name = nextFolderName(state.folders)): RouteFolders | null {
  if (state.folders.length >= ROUTE_FOLDER_LIMITS.maxFolders) return null;
  return {
    ...state,
    folders: [...state.folders, { id, name: name.slice(0, ROUTE_FOLDER_LIMITS.name), icon: DEFAULT_FOLDER_ICON }],
  };
}

export function setFolderIcon(state: RouteFolders, id: string, icon: string): RouteFolders {
  if (!isFolderIcon(icon)) return state;
  return { ...state, folders: state.folders.map((f) => (f.id === id ? { ...f, icon } : f)) };
}

/** An empty name keeps the old one. */
export function renameFolder(state: RouteFolders, id: string, name: string): RouteFolders {
  const trimmed = name.trim().slice(0, ROUTE_FOLDER_LIMITS.name);
  if (!trimmed) return state;
  return { ...state, folders: state.folders.map((f) => (f.id === id ? { ...f, name: trimmed } : f)) };
}

/** Moves a folder to `to` among the folders (the fixed tabs don't count). */
export function moveFolder(state: RouteFolders, id: string, to: number): RouteFolders {
  const from = state.folders.findIndex((f) => f.id === id);
  if (from < 0) return state;
  const target = Math.max(0, Math.min(state.folders.length - 1, to));
  if (target === from) return state;
  const folders = [...state.folders];
  const [moved] = folders.splice(from, 1);
  folders.splice(target, 0, moved);
  return { ...state, folders };
}

/** Removes a folder; its routes go back to 미분류 (the routes themselves stay). */
export function deleteFolder(state: RouteFolders, id: string): RouteFolders {
  const assign = Object.fromEntries(Object.entries(state.assign).filter(([, folder]) => folder !== id));
  return { ...state, folders: state.folders.filter((f) => f.id !== id), assign };
}

/** Files a route into a folder, or back to 미분류 with `null`. */
export function moveRoute(state: RouteFolders, courseId: string, folderId: string | null): RouteFolders {
  const assign = { ...state.assign };
  if (folderId && state.folders.some((f) => f.id === folderId)) assign[courseId] = folderId;
  else delete assign[courseId];
  return { ...state, assign };
}

/** Where a route is filed; null = 미분류. */
export function folderOf(state: RouteFolders, courseId: string): string | null {
  const id = state.assign[courseId];
  return id && state.folders.some((f) => f.id === id) ? id : null;
}

/** The tab actually open: a folder deleted elsewhere falls back to 전체. */
export function openRouteTab(state: RouteFolders, tab: RouteTab): RouteTab {
  return tab === 'all' || tab === 'none' || state.folders.some((f) => f.id === tab) ? tab : 'all';
}

/**
 * Every route in list order: ones not yet placed by a drag first, newest
 * first (a route just made shows at the top), then the dragged order.
 */
export function orderedRoutes(courses: Course[], state: RouteFolders): Course[] {
  const at = new Map((state.order ?? []).map((id, i) => [id, i]));
  const newest = [...courses].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
  return [...newest.filter((c) => !at.has(c.id)), ...newest.filter((c) => at.has(c.id)).sort((a, b) => at.get(a.id)! - at.get(b.id)!)];
}

/** The routes a tab shows, in list order. */
export function routesInTab(courses: Course[], state: RouteFolders, tab: RouteTab): Course[] {
  const routes = orderedRoutes(courses, state);
  if (tab === 'all') return routes;
  if (tab === 'none') return routes.filter((c) => folderOf(state, c.id) === null);
  return routes.filter((c) => folderOf(state, c.id) === tab);
}

/**
 * Several routes (picked in 다중 선택) moved as one block to place `to`
 * among the tab's other routes, keeping their list order. The tab may show
 * only some routes, so the block goes just before the route it now sits
 * above (or just after the one above it, at the bottom), wherever that is
 * in the whole order.
 */
export function placeRoutes(courses: Course[], state: RouteFolders, tab: RouteTab, ids: readonly string[], to: number): RouteFolders {
  const moving = new Set(ids);
  const list = routesInTab(courses, state, tab).map((c) => c.id);
  const block = list.filter((id) => moving.has(id));
  const rest = list.filter((id) => !moving.has(id));
  if (!block.length) return state;
  const at = Math.max(0, Math.min(to, rest.length));
  const next = [...rest.slice(0, at), ...block, ...rest.slice(at)];
  if (next.every((id, i) => id === list[i])) return state;
  const below = rest[at];
  const above = rest[at - 1];
  const order = orderedRoutes(courses, state)
    .map((c) => c.id)
    .filter((c) => !moving.has(c));
  const i = below ? order.indexOf(below) : above ? order.indexOf(above) + 1 : 0;
  order.splice(i, 0, ...block);
  return { ...state, order };
}

/**
 * Where the block lands when a held route is let go without moving: the
 * route held stays put and the others gather round it in list order — the
 * ones above it just above, the ones below just below.
 */
export function gatherPlace(courses: Course[], state: RouteFolders, tab: RouteTab, ids: readonly string[], held: string): number {
  const moving = new Set(ids);
  const list = routesInTab(courses, state, tab).map((c) => c.id);
  return list.slice(0, Math.max(0, list.indexOf(held))).filter((id) => !moving.has(id)).length;
}

/** One route dragged to place `to` in the tab's list (the others close up around it). */
export function placeRoute(courses: Course[], state: RouteFolders, tab: RouteTab, id: string, to: number): RouteFolders {
  return placeRoutes(courses, state, tab, [id], to);
}

/**
 * The route next to `id` in the open tab's list, as the < > arrows over a
 * route on show step through it: -1 is the row above (saved later), 1 the
 * row below (saved earlier), wrapping round at either end. Null when the
 * route isn't in that list or has no neighbour to step to.
 */
export function neighborRoute(courses: Course[], state: RouteFolders, tab: RouteTab, id: string, step: -1 | 1): Course | null {
  const routes = routesInTab(courses, state, openRouteTab(state, tab));
  const at = routes.findIndex((c) => c.id === id);
  if (at < 0 || routes.length < 2) return null;
  return routes[(at + step + routes.length) % routes.length];
}
