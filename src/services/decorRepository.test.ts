import { beforeEach, describe, expect, it } from 'vitest';
import { saveDays } from './dayRepository';
import { loadDecor, saveDecor } from './decorRepository';

describe('share card decorations', () => {
  beforeEach(() => localStorage.clear());

  it('take over what calendar days had before (goodroot:days:v1), once', () => {
    saveDays({
      decor: { '2026-09-29': { stickers: [{ id: 's1', emoji: '⭐', x: 0.2, y: 0.3, size: 0.2 }], strokes: [], theme: 'mint' } },
      shapes: {},
      edges: {},
    });
    const store = loadDecor();
    expect(Object.keys(store)).toEqual(['day:2026-09-29']);
    expect(store['day:2026-09-29'].theme).toBe('mint');
    // Saved under the new key, the old day rows aren't read again.
    saveDecor({});
    expect(loadDecor()).toEqual({});
  });

  it('keeps each card’s pieces across a reload, and drops what doesn’t look right', () => {
    saveDecor({
      'route:c-1': { stickers: [], strokes: [{ tool: 'pen', color: 'ink-black', width: 'thin', points: [[0.123456, 0.5]] }], pattern: 'hearts' },
      'day:2026-10-03': { stickers: [], strokes: [] }, // blank: not stored
    });
    localStorage.setItem(
      'goodroot:decor:v1',
      JSON.stringify({ ...JSON.parse(localStorage.getItem('goodroot:decor:v1')!), 'bad key': { stickers: [], strokes: [], theme: 'mint' } }),
    );
    const store = loadDecor();
    expect(Object.keys(store)).toEqual(['route:c-1']);
    expect(store['route:c-1'].strokes[0].points[0]).toEqual([0.1235, 0.5]);
    expect(store['route:c-1'].pattern).toBe('hearts');
  });
});
