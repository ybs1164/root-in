import { describe, expect, it } from 'vitest';
import { barSlot, barTurn, calendarAgain, pageSwipes, showsPage, swipeCommits, tabForIncoming, type AppTab, type BarButton } from './appTabs';

describe('bottom-bar tabs', () => {
  it('incoming #share= / #diary= / #pins= links open the matching tab', () => {
    expect(tabForIncoming('day')).toBe('calendar');
    expect(tabForIncoming('pins')).toBe('pins');
    expect(tabForIncoming('course')).toBe('pins');
  });

  it('달력 is a full screen; the map shows through only when it is needed', () => {
    expect(showsPage('calendar', false)).toBe(true);
    expect(showsPage('pins', false)).toBe(false);
    expect(showsPage('calendar', true)).toBe(false);
  });

  it('달력 slides off to the left to uncover the map', () => {
    expect(pageSwipes('calendar')).toEqual({ left: 'pins', right: 'people' });
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

  it('사람 is a full screen too, sliding off to the right', () => {
    expect(showsPage('people', false)).toBe(true);
    expect(pageSwipes('people')).toEqual({ left: 'calendar', right: 'pins' });
  });

  it('the row turns like a wheel: 달력 핑 사람 / 사람 달력 핑 / 핑 사람 달력', () => {
    const row = (tab: AppTab) =>
      (['calendar', 'pins', 'people'] as BarButton[]).sort((a, b) => 'lcr'.indexOf(barSlot(a, tab)) - 'lcr'.indexOf(barSlot(b, tab)));
    expect(row('pins')).toEqual(['calendar', 'pins', 'people']);
    expect(row('calendar')).toEqual(['people', 'calendar', 'pins']);
    expect(row('people')).toEqual(['pins', 'people', 'calendar']);
  });

  it('pressing the left button turns the row right, the right button left', () => {
    expect(barTurn('pins', 'calendar')).toBe(1);
    expect(barTurn('calendar', 'people')).toBe(1);
    expect(barTurn('people', 'pins')).toBe(1);
    expect(barTurn('pins', 'people')).toBe(-1);
    expect(barTurn('calendar', 'pins')).toBe(-1);
    expect(barTurn('pins', 'pins')).toBe(0);
  });
});
