import { describe, expect, it } from 'vitest';
import { clearAppData, DEFAULT_SETTINGS, loadSettings, saveSettings, withRecentCategory } from './settingsRepository';

describe('settings', () => {
  it('settings persist in goodroot:settings:v1 and survive a reload', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    saveSettings({ recentCategoryIds: ['cafe'] });
    expect(JSON.parse(localStorage.getItem('goodroot:settings:v1') ?? '{}').recentCategoryIds).toEqual(['cafe']);
    expect(loadSettings()).toEqual({ recentCategoryIds: ['cafe'] });
  });

  it('falls back to defaults for unknown or broken values', () => {
    // `theme` was app-wide in an earlier build; it's per calendar day now and dropped here.
    localStorage.setItem('goodroot:settings:v1', JSON.stringify({ theme: 'forest', recentCategoryIds: [1, 'bar'] }));
    expect(loadSettings()).toEqual({ recentCategoryIds: ['bar'] });
    localStorage.setItem('goodroot:settings:v1', '{not json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps the most recent categories first, without duplicates', () => {
    let s = DEFAULT_SETTINGS;
    for (const id of ['cafe', 'food', 'cafe']) s = withRecentCategory(s, id);
    expect(s.recentCategoryIds).toEqual(['cafe', 'food']);
  });

  it('clears only this app’s keys', () => {
    localStorage.setItem('goodroot:pins:v1', '[]');
    localStorage.setItem('other-app', 'keep');
    clearAppData();
    expect(localStorage.getItem('goodroot:pins:v1')).toBeNull();
    expect(localStorage.getItem('other-app')).toBe('keep');
  });
});
