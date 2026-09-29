import { describe, expect, it } from 'vitest';
import { tabForIncoming } from './appTabs';

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
});
