import { describe, expect, it } from 'vitest';
import { bottomBarAction, showsPage, tabForIncoming } from './appTabs';

describe('bottom-bar tabs', () => {
  it('incoming #share= / #diary= / #pins= links open the matching tab', () => {
    expect(tabForIncoming('day', 'pins')).toBe('calendar');
    expect(tabForIncoming('pins', 'calendar')).toBe('pins');
    expect(tabForIncoming('course', 'calendar')).toBe('pins');
  });

  it('a course opened from the 추천 feed stays on that tab', () => {
    expect(tabForIncoming('course', 'influencer')).toBe('influencer');
    expect(tabForIncoming('pins', 'influencer')).toBe('influencer');
  });

  it('every bottom-bar button switches to its screen; the active pin button drops a pin', () => {
    expect(bottomBarAction('calendar', 'pins')).toBe('switch');
    expect(bottomBarAction('pins', 'influencer')).toBe('switch');
    expect(bottomBarAction('pins', 'pins')).toBe('pin');
    expect(bottomBarAction('calendar', 'calendar')).toBe('none');
    expect(bottomBarAction('influencer', 'influencer')).toBe('none');
  });

  it('달력 and 추천 are full screens; the map shows through only when it is needed', () => {
    expect(showsPage('calendar', false)).toBe(true);
    expect(showsPage('influencer', false)).toBe(true);
    expect(showsPage('pins', false)).toBe(false);
    expect(showsPage('calendar', true)).toBe(false);
    expect(showsPage('influencer', true)).toBe(false);
  });
});
