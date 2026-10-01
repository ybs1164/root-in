import type { Course } from '../types/course';

/**
 * 경로 폴더: the user's own index tabs for sorting saved routes (courses).
 * A route sits in at most one folder; one in none is 미분류. Kept apart from
 * the courses themselves so the course store and share links don't change.
 */
export interface RouteFolder {
  id: string;
  /** Not shown (tabs show the icon); read out by screen readers. */
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
}

/** The fixed tabs before the user's folders. */
export type RouteTab = 'all' | 'none' | string;

export const ROUTE_FOLDER_LIMITS = { maxFolders: 20, name: 12 } as const;

export const EMPTY_ROUTE_FOLDERS: RouteFolders = { folders: [], assign: {} };

/** '폴더 1', '폴더 2', … skipping names already taken. */
export function nextFolderName(folders: RouteFolder[]): string {
  const taken = new Set(folders.map((f) => f.name));
  let n = folders.length + 1;
  while (taken.has(`폴더 ${n}`)) n += 1;
  return `폴더 ${n}`;
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

/** The routes a tab shows, newest first. */
export function routesInTab(courses: Course[], state: RouteFolders, tab: RouteTab): Course[] {
  const newest = [...courses].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
  if (tab === 'all') return newest;
  if (tab === 'none') return newest.filter((c) => folderOf(state, c.id) === null);
  return newest.filter((c) => folderOf(state, c.id) === tab);
}
