import { describe, expect, it } from 'vitest';
import { bottomBarAction, calendarAgain, homeSwipeDirection, showsPage, swipeCommits, tabForIncoming } from './appTabs';

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

  it('every bottom-bar button switches to its screen; tapped again, pin drops a pin and calendar flips TODAY/month', () => {
    expect(bottomBarAction('calendar', 'pins')).toBe('switch');
    expect(bottomBarAction('pins', 'influencer')).toBe('switch');
    expect(bottomBarAction('pins', 'pins')).toBe('pin');
    expect(bottomBarAction('calendar', 'calendar')).toBe('calendar');
    expect(bottomBarAction('influencer', 'influencer')).toBe('none');
  });

  it('달력 and 추천 are full screens; the map shows through only when it is needed', () => {
    expect(showsPage('calendar', false)).toBe(true);
    expect(showsPage('influencer', false)).toBe(true);
    expect(showsPage('pins', false)).toBe(false);
    expect(showsPage('calendar', true)).toBe(false);
    expect(showsPage('influencer', true)).toBe(false);
  });

  it('달력 slides off to the left and 추천 to the right to uncover the map', () => {
    expect(homeSwipeDirection('calendar')).toBe(-1);
    expect(homeSwipeDirection('influencer')).toBe(1);
    expect(homeSwipeDirection('pins')).toBe(0);
  });

  it('a swipe commits past 30% of the width or on a quick flick, and only the right way', () => {
    expect(swipeCommits(-1, -120, 375, 0.1)).toBe(true);
    expect(swipeCommits(-1, -60, 375, 0.1)).toBe(false);
    expect(swipeCommits(-1, -60, 375, -0.8)).toBe(true); // quick flick left
    expect(swipeCommits(-1, 200, 375, 0.9)).toBe(false); // wrong way
    expect(swipeCommits(1, 150, 375, 0)).toBe(true);
    expect(swipeCommits(1, 20, 375, 2)).toBe(false); // too short even if fast
  });

  it('calendar button again: a day screen opens the 공유/월 달력 menu, the month goes back to TODAY', () => {
    expect(calendarAgain('day', false)).toBe('open-menu');
    expect(calendarAgain('day', true)).toBe('close-menu');
    expect(calendarAgain('month', false)).toBe('today');
    expect(calendarAgain('month', true)).toBe('close-menu');
  });
});
