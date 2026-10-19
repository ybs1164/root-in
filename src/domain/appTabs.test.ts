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

  it('We Now slides off to the right to uncover the map', () => {
    expect(pageSwipes('people')).toEqual({ left: null, right: 'pins' });
  });

  it('the row has no calendar button: 핑(big) 사람 on the map, 핑 사람(big) on We Now', () => {
    const row = (tab: AppTab) =>
      (['pins', 'people'] as BarButton[]).map((b) => barSlot(b, tab));
    expect(row('pins')).toEqual(['c', 'r']);
    expect(row('people')).toEqual(['l', 'c']);
  });

  it('pressing the left button turns the row right, the right button left', () => {
    expect(barTurn('people', 'pins')).toBe(1);
    expect(barTurn('pins', 'people')).toBe(-1);
    expect(barTurn('pins', 'pins')).toBe(0);
  });
});
