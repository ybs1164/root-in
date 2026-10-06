import { describe, expect, it } from 'vitest';
import { loadDays, saveDays, readDecor } from './dayRepository';

describe('calendar days', () => {
  it('removes legacy emoji and unrecognized stickers while keeping drawing data', () => {
    const decor = readDecor({
      stickers: [
        { id: 'old', emoji: '⭐', x: 0.5, y: 0.5, size: 0.13 },
        { id: 'unknown', stickerId: 'missing', x: 0.5, y: 0.5, size: 0.26 },
        { id: 'new', stickerId: 'flower', x: 0.5, y: 0.5, size: 0.26 },
      ],
      strokes: [{ tool: 'pen', color: 'accent', width: 'thin', points: [[0.1, 0.2]] }],
    });
    expect(decor?.stickers.map((s) => s.stickerId)).toEqual(['flower']);
    expect(decor?.stickers[0].size).toBe(0.26);
    expect(decor?.strokes).toHaveLength(1);
  });

  it('keeps a day’s name / time switches across a reload, even with nothing else on it', () => {
    saveDays({ decor: { '2026-09-29': { stickers: [], strokes: [], hideNames: true, hideTimes: true } }, shapes: {}, edges: {} });
    const day = loadDays().decor['2026-09-29'];
    expect(day.hideNames).toBe(true);
    expect(day.hideTimes).toBe(true);
    expect(readDecor({ stickers: [], strokes: [], hideNames: 'yes' })?.hideNames).toBeUndefined();
  });

  it('keeps each day’s stickers, strokes, theme, ping shapes and line styles across a reload', () => {
    saveDays({
      decor: {
        '2026-09-29': {
          stickers: [{ id: 's1', stickerId: 'star', x: 0.2, y: 0.3, size: 0.2, rotate: 45 }],
          strokes: [{ tool: 'pen', color: '#3aa0ff', width: 'thin', points: [[0.123456, 0.5], [0.6, 0.7]] }],
          theme: 'mint',
          pattern: 'hearts',
        },
        '2026-09-30': { stickers: [], strokes: [] }, // blank: not stored
      },
      shapes: { '2026-09-29|10:30|성수연방': 'heart' },
      edges: { '2026-09-29|10:30|성수연방>13:00|서울숲': 'dotted' },
    });
    const days = loadDays();
    expect(Object.keys(days.decor)).toEqual(['2026-09-29']);
    expect(days.decor['2026-09-29'].theme).toBe('mint');
    expect(days.decor['2026-09-29'].pattern).toBe('hearts');
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
            stickers: [{ id: 's', stickerId: 'star', x: 9, y: 0.5, size: 99 }, { id: 1 }],
            strokes: [{ tool: 'laser', color: 'red', width: 'thin', points: [[0, 0]] }, { tool: 'pen', color: 'accent', width: 'medium', points: [[2, -1]] }],
            theme: 'forest',
            pattern: 'plaid',
          },
          nope: { stickers: [], strokes: [] },
        },
        shapes: { '2026-09-29|x': 'square', '2026-09-29|y': 'star' },
        edges: 'bad',
      }),
    );
    const days = loadDays();
    const d = days.decor['2026-09-29'];
    expect(d.stickers).toEqual([{ id: 's', stickerId: 'star', x: 1, y: 0.5, size: 0.6 }]);
    expect(d.strokes).toEqual([{ tool: 'pen', color: 'accent', width: 'medium', points: [[1, 0]] }]);
    expect(d.theme).toBeUndefined();
    expect(d.pattern).toBeUndefined();
    expect(days.decor.nope).toBeUndefined();
    expect(days.shapes).toEqual({ '2026-09-29|y': 'star' });
    expect(days.edges).toEqual({});
    localStorage.setItem('goodroot:days:v1', '{oops');
    expect(loadDays().decor).toEqual({});
  });

  it('keeps text boxes with their style, drops blank or malformed ones', () => {
    localStorage.setItem(
      'goodroot:days:v1',
      JSON.stringify({
        decor: {
          '2026-10-01': {
            stickers: [],
            strokes: [],
            texts: [
              { id: 't1', text: '성수 산책\n좋았다', x: 0.4, y: 2, size: 9, font: 'pen', color: 'accent', align: 'left', bold: true, italic: 'yes', rotate: 10 },
              { id: 't2', text: ' \n\t ', x: 0.5, y: 0.5, size: 0.07, font: 'sans', color: 'ink-black', align: 'center' },
              { id: 't3', text: 'x'.repeat(500), x: 0.5, y: 0.5, size: 0.07, font: 'comic', color: 'red', align: 'justify' },
              { id: 't4', text: 'no position' },
            ],
          },
          '2026-10-02': { stickers: [], strokes: [], texts: [{ id: 'b', text: '   ', x: 0, y: 0, size: 0.1 }] },
        },
      }),
    );
    const d = loadDays().decor;
    expect(d['2026-10-01'].texts).toEqual([
      { id: 't1', text: '성수 산책\n좋았다', x: 0.4, y: 1, size: 0.3, rotate: 10, font: 'pen', color: 'accent', align: 'left', bold: true },
      { id: 't3', text: 'x'.repeat(200), x: 0.5, y: 0.5, size: 0.07, font: 'sans', color: 'ink-black', align: 'center' },
    ]);
    // Only a blank box: the day has nothing worth keeping.
    expect(d['2026-10-02'].texts).toBeUndefined();
    saveDays({ decor: d, shapes: {}, edges: {} });
    expect(Object.keys(loadDays().decor)).toEqual(['2026-10-01']);
  });
});
