import { describe, expect, it } from 'vitest';
import type { Course } from '../types/course';
import { addFolder, deleteFolder, EMPTY_ROUTE_FOLDERS, moveFolder, folderOf, moveRoute, neighborRoute, nextFolderName, renameFolder, ROUTE_FOLDER_LIMITS, routesInTab, placeRoute, placeRoutes, gatherPlace, setFolderIcon } from './routeFolders';

const course = (id: string, createdAt: string): Course => ({
  id, userId: 'u', title: id, theme: 'date', travelMode: 'walk', stops: [], createdAt,
});

describe('route folders', () => {
  it('names new folders 폴더 N, skipping taken names', () => {
    expect(nextFolderName([])).toBe('폴더 1');
    expect(nextFolderName([{ id: 'a', name: '폴더 2', icon: '📁' }])).toBe('폴더 3');
  });

  it('adds folders up to the limit', () => {
    let state = EMPTY_ROUTE_FOLDERS;
    for (let i = 0; i < ROUTE_FOLDER_LIMITS.maxFolders; i += 1) state = addFolder(state, `f${i}`)!;
    expect(state.folders).toHaveLength(ROUTE_FOLDER_LIMITS.maxFolders);
    expect(addFolder(state, 'over')).toBeNull();
  });

  it('a new folder wears the default icon; only listed icons can be set', () => {
    const state = addFolder(EMPTY_ROUTE_FOLDERS, 'f')!;
    expect(state.folders[0].icon).toBe('📁');
    expect(setFolderIcon(state, 'f', '✈️').folders[0].icon).toBe('✈️');
    expect(setFolderIcon(state, 'f', 'x')).toBe(state);
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

  it('moves a folder among the folders, clamped to the ends', () => {
    let state = EMPTY_ROUTE_FOLDERS;
    for (const id of ['a', 'b', 'c']) state = addFolder(state, id)!;
    expect(moveFolder(state, 'a', 2).folders.map((f) => f.id)).toEqual(['b', 'c', 'a']);
    expect(moveFolder(state, 'c', -5).folders.map((f) => f.id)).toEqual(['c', 'a', 'b']);
    expect(moveFolder(state, 'b', 1)).toBe(state);
    expect(moveFolder(state, 'gone', 0)).toBe(state);
  });

  it('deleting a folder sends its routes back to 미분류', () => {
    let state = addFolder(addFolder(EMPTY_ROUTE_FOLDERS, 'a')!, 'b')!;
    state = moveRoute(moveRoute(state, 'r1', 'a'), 'r2', 'b');
    const after = deleteFolder(state, 'a');
    expect(after.folders.map((f) => f.id)).toEqual(['b']);
    expect(after.assign).toEqual({ r2: 'b' });
    expect(folderOf(after, 'r1')).toBeNull();
  });

  it('the < > arrows step through the open tab\'s list, wrapping round', () => {
    // 전체: 1 2 3 4 top to bottom (1 saved last); 2–4 in the heart folder.
    let state = addFolder(EMPTY_ROUTE_FOLDERS, 'heart')!;
    for (const id of ['r2', 'r3', 'r4']) state = moveRoute(state, id, 'heart');
    const courses = [course('r4', '2026-09-01'), course('r3', '2026-09-02'), course('r2', '2026-09-03'), course('r1', '2026-09-04')];
    const walk = (tab: string, from: string, steps: (-1 | 1)[]) =>
      steps.reduce<string[]>((seen, step) => [...seen, neighborRoute(courses, state, tab, seen[seen.length - 1], step)!.id], [from]).slice(1);
    expect(walk('all', 'r1', [1, 1, 1, 1])).toEqual(['r2', 'r3', 'r4', 'r1']);
    expect(walk('heart', 'r3', [1])).toEqual(['r4']);
    expect(walk('heart', 'r3', [-1, -1])).toEqual(['r2', 'r4']);
    // Not in the tab's list, or alone in it: nowhere to go.
    expect(neighborRoute(courses, state, 'heart', 'r1', 1)).toBeNull();
    expect(neighborRoute(courses, state, 'none', 'r1', 1)).toBeNull();
    // A folder gone missing falls back to 전체, as the sheet does.
    expect(neighborRoute(courses, state, 'gone', 'r4', 1)!.id).toBe('r1');
  });

  it('routes keep the order they are dragged into; new ones come first; a folder view places among the whole list', () => {
    let state = addFolder(EMPTY_ROUTE_FOLDERS, 'heart')!;
    for (const id of ['b', 'd']) state = moveRoute(state, id, 'heart');
    const courses = ['a', 'b', 'c', 'd'].map((id, i) => course(id, `2026-09-0${i + 1}`)); // newest: d c b a
    const ids = (tab: string, s = state) => routesInTab(courses, s, tab).map((c) => c.id);
    expect(ids('all')).toEqual(['d', 'c', 'b', 'a']);
    // 전체: d to the bottom.
    state = placeRoute(courses, state, 'all', 'd', 3);
    expect(ids('all')).toEqual(['c', 'b', 'a', 'd']);
    // In the heart folder (b, d), d to the top: just above b in the whole list.
    state = placeRoute(courses, state, 'heart', 'd', 0);
    expect(ids('heart')).toEqual(['d', 'b']);
    expect(ids('all')).toEqual(['c', 'd', 'b', 'a']);
    // A route made later shows first; deleting a folder keeps the order.
    const later = [...courses, course('e', '2026-09-09')];
    expect(routesInTab(later, state, 'all').map((c) => c.id)).toEqual(['e', 'c', 'd', 'b', 'a']);
    expect(ids('all', deleteFolder(state, 'heart'))).toEqual(['c', 'd', 'b', 'a']);
  });

  it('picked routes move as one block: gathered round the one held, or dropped where it is dragged', () => {
    // 1 2 3 4 top to bottom (1 newest); 2 and 4 picked.
    const courses = ['4', '3', '2', '1'].map((id, i) => course(id, `2026-09-0${i + 1}`));
    const state = EMPTY_ROUTE_FOLDERS;
    const ids = (s: typeof state) => routesInTab(courses, s, 'all').map((c) => c.id);
    expect(ids(state)).toEqual(['1', '2', '3', '4']);
    const picked = ['2', '4'];
    // Held 2, let go in place: 4 comes up under it.
    expect(ids(placeRoutes(courses, state, 'all', picked, gatherPlace(courses, state, 'all', picked, '2')))).toEqual(['1', '2', '4', '3']);
    // Held 4, let go in place: 2 comes down above it.
    expect(ids(placeRoutes(courses, state, 'all', picked, gatherPlace(courses, state, 'all', picked, '4')))).toEqual(['1', '3', '2', '4']);
    // Held 4, dragged above 1: the block goes to the top.
    expect(ids(placeRoutes(courses, state, 'all', picked, 0))).toEqual(['2', '4', '1', '3']);
  });
});
