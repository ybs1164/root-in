import { DEFAULT_FOLDER_ICON, EMPTY_ROUTE_FOLDERS, isFolderIcon, ROUTE_FOLDER_LIMITS, type RouteFolder, type RouteFolders } from '../domain/routeFolders';

import { localWrote } from './syncBus';

const KEY = 'goodroot:route-folders:v1';

const isFolder = (v: unknown): v is RouteFolder =>
  typeof v === 'object' && v !== null && typeof (v as RouteFolder).id === 'string' && typeof (v as RouteFolder).name === 'string';

/** Reads the 경로 폴더; anything malformed falls back to no folders. */
export function loadRouteFolders(): RouteFolders {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_ROUTE_FOLDERS;
    const parsed = JSON.parse(raw) as Partial<RouteFolders>;
    const folders = (Array.isArray(parsed.folders) ? parsed.folders : [])
      .filter(isFolder)
      .slice(0, ROUTE_FOLDER_LIMITS.maxFolders)
      // Folders saved before icons existed (or with an unknown one) get the default.
      .map((f) => ({ id: f.id, name: f.name.slice(0, ROUTE_FOLDER_LIMITS.name), icon: isFolderIcon(f.icon) ? f.icon : DEFAULT_FOLDER_ICON }));
    const ids = new Set(folders.map((f) => f.id));
    const assign: Record<string, string> = {};
    if (parsed.assign && typeof parsed.assign === 'object') {
      for (const [course, folder] of Object.entries(parsed.assign)) {
        if (typeof folder === 'string' && ids.has(folder)) assign[course] = folder;
      }
    }
    // The dragged route order: ids only, at most as many as could be useful.
    const order = Array.isArray(parsed.order)
      ? [...new Set(parsed.order.filter((id): id is string => typeof id === 'string' && id.length <= 64))].slice(0, 1000)
      : undefined;
    return order?.length ? { folders, assign, order } : { folders, assign };
  } catch {
    return EMPTY_ROUTE_FOLDERS;
  }
}

export function saveRouteFolders(state: RouteFolders): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    // Folder ids and names are folders; which folder and order belong to the route rows.
    localWrote('folders', 'routes');
  } catch {
    // Losing folder sorting is harmless: routes all show under 전체 / 미분류.
  }
}
