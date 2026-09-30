import { describe, expect, it } from 'vitest';
import { bottomBarAction, tabForIncoming } from './appTabs';

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
});
