import { beforeEach, describe, expect, it } from 'vitest';
import { loadRouteFolders, saveRouteFolders } from './routeFolderRepository';

describe('routeFolderRepository', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trips folders and assignments', () => {
    const state = { folders: [{ id: 'f', name: '여행', icon: '✈️' }], assign: { c1: 'f' } };
    saveRouteFolders(state);
    expect(loadRouteFolders()).toEqual(state);
  });

  it('drops malformed folders and assignments to unknown folders', () => {
    window.localStorage.setItem(
      'goodroot:route-folders:v1',
      JSON.stringify({ folders: [{ id: 'f', name: '아주아주아주아주긴폴더이름' }, { id: 'g', name: 'x', icon: '<b>' }, { id: 3 }], assign: { c1: 'f', c2: 'gone', c3: 7 } }),
    );
    const loaded = loadRouteFolders();
    // No icon (saved before icons) or an unknown one: the default folder icon.
    expect(loaded.folders).toEqual([
      { id: 'f', name: '아주아주아주아주긴폴더이', icon: '📁' },
      { id: 'g', name: 'x', icon: '📁' },
    ]);
    expect(loaded.assign).toEqual({ c1: 'f' });
  });

  it('falls back to no folders on broken JSON', () => {
    window.localStorage.setItem('goodroot:route-folders:v1', '{');
    expect(loadRouteFolders()).toEqual({ folders: [], assign: {} });
  });
});
