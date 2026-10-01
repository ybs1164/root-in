import { describe, expect, it } from 'vitest';
import type { Course } from '../types/course';
import { addFolder, EMPTY_ROUTE_FOLDERS, folderOf, moveRoute, nextFolderName, renameFolder, ROUTE_FOLDER_LIMITS, routesInTab } from './routeFolders';

const course = (id: string, createdAt: string): Course => ({
  id, userId: 'u', title: id, theme: 'date', travelMode: 'walk', stops: [], createdAt,
});

describe('route folders', () => {
  it('names new folders 폴더 N, skipping taken names', () => {
    expect(nextFolderName([])).toBe('폴더 1');
    expect(nextFolderName([{ id: 'a', name: '폴더 2' }])).toBe('폴더 3');
  });

  it('adds folders up to the limit', () => {
    let state = EMPTY_ROUTE_FOLDERS;
    for (let i = 0; i < ROUTE_FOLDER_LIMITS.maxFolders; i += 1) state = addFolder(state, `f${i}`)!;
    expect(state.folders).toHaveLength(ROUTE_FOLDER_LIMITS.maxFolders);
    expect(addFolder(state, 'over')).toBeNull();
  });

  it('renames, keeping the old name when the new one is blank', () => {
    const state = addFolder(EMPTY_ROUTE_FOLDERS, 'f', '데이트')!;
    expect(renameFolder(state, 'f', '  ').folders[0].name).toBe('데이트');
    expect(renameFolder(state, 'f', '여행').folders[0].name).toBe('여행');
  });

  it('전체 shows every route, 미분류 the unfiled ones, a folder its own', () => {
    let state = addFolder(EMPTY_ROUTE_FOLDERS, 'trip', '여행')!;
    state = moveRoute(state, 'b', 'trip');
    const courses = [course('a', '2026-09-01'), course('b', '2026-09-02'), course('c', '2026-09-03')];
    expect(routesInTab(courses, state, 'all').map((c) => c.id)).toEqual(['c', 'b', 'a']);
    expect(routesInTab(courses, state, 'none').map((c) => c.id)).toEqual(['c', 'a']);
    expect(routesInTab(courses, state, 'trip').map((c) => c.id)).toEqual(['b']);
    expect(folderOf(moveRoute(state, 'b', null), 'b')).toBeNull();
    expect(folderOf(moveRoute(state, 'a', 'gone'), 'a')).toBeNull();
  });
});
