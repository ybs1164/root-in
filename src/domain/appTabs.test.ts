import { describe, expect, it } from 'vitest';
import { barSlot, barTurn, calendarAgain, pageSwipes, showsPage, swipeCommits, tabForIncoming, type AppTab, type BarButton } from './appTabs';

describe('bottom-bar tabs', () => {
  it('incoming #share= / #diary= / #pins= links open the matching tab', () => {
    expect(tabForIncoming('day')).toBe('people');
    expect(tabForIncoming('pins')).toBe('pins');
    expect(tabForIncoming('course')).toBe('pins');
  });

  it('We Now is a full screen; the map shows through only when it is needed', () => {
    expect(showsPage('people', false)).toBe(true);
    expect(showsPage('pins', false)).toBe(false);
    expect(showsPage('people', true)).toBe(false);
    expect(pageSwipes('pins')).toEqual({ left: null, right: null });
  });

  it('a swipe commits past 30% of the width or on a quick flick, and only the right way', () => {
    expect(swipeCommits(-1, -120, 375, 0.1)).toBe(true);
    expect(swipeCommits(-1, -60, 375, 0.1)).toBe(false);
    expect(swipeCommits(-1, -60, 375, -0.8)).toBe(true); // quick flick left
    expect(swipeCommits(-1, 200, 375, 0.9)).toBe(false); // wrong way
    expect(swipeCommits(1, 150, 375, 0)).toBe(true);
    expect(swipeCommits(1, 20, 375, 2)).toBe(false); // too short even if fast
  });

  it('calendar button again: a day screen goes straight to the month, the month back to TODAY', () => {
    expect(calendarAgain('day')).toBe('month');
    expect(calendarAgain('month')).toBe('today');
  });

  it('We Now slides off to the left to uncover the map on its right', () => {
    expect(pageSwipes('people')).toEqual({ left: 'pins', right: null });
  });

  it('the row has no calendar button: 사람 핑(big) on the map, 사람(big) 핑 on We Now', () => {
    const row = (tab: AppTab) =>
      (['pins', 'people'] as BarButton[]).map((b) => barSlot(b, tab));
    expect(row('pins')).toEqual(['c', 'l']);
    expect(row('people')).toEqual(['r', 'c']);
  });

  it('pressing the left button turns the row right, the right button left', () => {
    expect(barTurn('people', 'pins')).toBe(-1);
    expect(barTurn('pins', 'people')).toBe(1);
    expect(barTurn('pins', 'pins')).toBe(0);
  });
});
