import { EMPTY_ROUTE_FOLDERS, ROUTE_FOLDER_LIMITS, type RouteFolder, type RouteFolders } from '../domain/routeFolders';

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
      .map((f) => ({ id: f.id, name: f.name.slice(0, ROUTE_FOLDER_LIMITS.name) }));
    const ids = new Set(folders.map((f) => f.id));
    const assign: Record<string, string> = {};
    if (parsed.assign && typeof parsed.assign === 'object') {
      for (const [course, folder] of Object.entries(parsed.assign)) {
        if (typeof folder === 'string' && ids.has(folder)) assign[course] = folder;
      }
    }
    return { folders, assign };
  } catch {
    return EMPTY_ROUTE_FOLDERS;
  }
}

export function saveRouteFolders(state: RouteFolders): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Losing folder sorting is harmless: routes all show under 전체 / 미분류.
  }
}
