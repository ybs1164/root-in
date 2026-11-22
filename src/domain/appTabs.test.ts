import { describe, expect, it } from 'vitest';
import { BACK_SWIPE, barSlot, barTurn, calendarAgain, pageSwipes, SHEET_PULL, showsPage, swipeCommits, swipeHeading, tabForIncoming, type AppTab, type BarButton } from './appTabs';

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

  it('a short swipe is enough: past 12% of the width or a quick flick, and only the right way', () => {
    expect(swipeCommits(-1, -50, 375, 0.1)).toBe(true);
    expect(swipeCommits(-1, -30, 375, 0.1)).toBe(false);
    expect(swipeCommits(-1, -30, 375, -0.4)).toBe(true); // quick flick left
    expect(swipeCommits(-1, 200, 375, 0.9)).toBe(false); // wrong way
    expect(swipeCommits(1, 50, 375, 0)).toBe(true);
    expect(swipeCommits(1, 10, 375, 2)).toBe(false); // too short even if fast
  });

  it('pulling a sheet stays deliberate', () => {
    expect(swipeCommits(1, 50, 375, 0, SHEET_PULL)).toBe(false);
    expect(swipeCommits(1, 120, 375, 0, SHEET_PULL)).toBe(true);
    expect(swipeCommits(1, 40, 375, 0.6, SHEET_PULL)).toBe(true);
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

describe('going back by swiping right', () => {
  it('tells a swipe from a scroll once the finger has gone a little, leaning up to about 56°', () => {
    expect(swipeHeading(6, 2)).toBeNull(); // too short to say
    expect(swipeHeading(12, 0)).toBe(1);
    expect(swipeHeading(10, 14)).toBe(1); // a thumb's arc, more up than across
    expect(swipeHeading(-10, 12)).toBe(-1);
    expect(swipeHeading(6, 14)).toBe('other'); // a scroll
    expect(swipeHeading(0, 20)).toBe('other');
  });

  it('goes after a short swipe or a light flick', () => {
    expect(swipeCommits(1, 32, 375, 0, BACK_SWIPE)).toBe(true); // ~8% of a phone's width
    expect(swipeCommits(1, 24, 375, 0, BACK_SWIPE)).toBe(false);
    expect(swipeCommits(1, 14, 375, 0.22, BACK_SWIPE)).toBe(true);
    expect(swipeCommits(1, 8, 375, 1, BACK_SWIPE)).toBe(false);
  });
});
