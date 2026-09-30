import { describe, expect, it } from 'vitest';
import { loadDays, saveDays } from './dayRepository';

describe('calendar days', () => {
  it('keeps each day’s stickers, strokes, theme, ping shapes and line styles across a reload', () => {
    saveDays({
      decor: {
        '2026-09-29': {
          stickers: [{ id: 's1', emoji: '⭐', x: 0.2, y: 0.3, size: 0.2, rotate: 45 }],
          strokes: [{ tool: 'pen', color: '#3aa0ff', width: 'thin', points: [[0.123456, 0.5], [0.6, 0.7]] }],
          theme: 'mint',
        },
        '2026-09-30': { stickers: [], strokes: [] }, // blank: not stored
      },
      shapes: { '2026-09-29|10:30|성수연방': 'heart' },
      edges: { '2026-09-29|10:30|성수연방>13:00|서울숲': 'dotted' },
    });
    const days = loadDays();
    expect(Object.keys(days.decor)).toEqual(['2026-09-29']);
    expect(days.decor['2026-09-29'].theme).toBe('mint');
    expect(days.decor['2026-09-29'].stickers[0].rotate).toBe(45);
    expect(days.decor['2026-09-29'].strokes[0].points[0]).toEqual([0.1235, 0.5]);
    expect(days.shapes['2026-09-29|10:30|성수연방']).toBe('heart');
    expect(days.edges['2026-09-29|10:30|성수연방>13:00|서울숲']).toBe('dotted');
  });

  it('drops what doesn’t look right instead of failing', () => {
    localStorage.setItem(
      'goodroot:days:v1',
      JSON.stringify({
        decor: {
          '2026-09-29': {
            stickers: [{ id: 's', emoji: '⭐', x: 9, y: 0.5, size: 99 }, { id: 1 }],
            strokes: [{ tool: 'laser', color: 'red', width: 'thin', points: [[0, 0]] }, { tool: 'pen', color: 'accent', width: 'medium', points: [[2, -1]] }],
            theme: 'forest',
          },
          nope: { stickers: [], strokes: [] },
        },
        shapes: { '2026-09-29|x': 'square', '2026-09-29|y': 'star' },
        edges: 'bad',
      }),
    );
    const days = loadDays();
    const d = days.decor['2026-09-29'];
    expect(d.stickers).toEqual([{ id: 's', emoji: '⭐', x: 1, y: 0.5, size: 0.6 }]);
    expect(d.strokes).toEqual([{ tool: 'pen', color: 'accent', width: 'medium', points: [[1, 0]] }]);
    expect(d.theme).toBeUndefined();
    expect(days.decor.nope).toBeUndefined();
    expect(days.shapes).toEqual({ '2026-09-29|y': 'star' });
    expect(days.edges).toEqual({});
    localStorage.setItem('goodroot:days:v1', '{oops');
    expect(loadDays().decor).toEqual({});
  });
});
