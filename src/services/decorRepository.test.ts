import { beforeEach, describe, expect, it } from 'vitest';
import { saveDays } from './dayRepository';
import { cardToScene, DRAWING_BOX, FRONT_CARD, SCENE } from '../domain/polaroid';
import { boxToScene, loadDecor, saveDecor } from './decorRepository';

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
      'goodroot:decor:v2',
      JSON.stringify({ ...JSON.parse(localStorage.getItem('goodroot:decor:v2')!), 'bad key': { stickers: [], strokes: [], theme: 'mint' } }),
    );
    const store = loadDecor();
    expect(Object.keys(store)).toEqual(['route:c-1']);
    expect(store['route:c-1'].strokes[0].points[0]).toEqual([0.1235, 0.5]);
    expect(store['route:c-1'].pattern).toBe('hearts');
  });

  it('move v1 pieces from the drawing box onto the scene, where that box lies on the front card', () => {
    localStorage.setItem(
      'goodroot:decor:v1',
      JSON.stringify({ 'route:c-1': { stickers: [{ id: 's', emoji: '⭐', x: 0.5, y: 0.5, size: 0.2, rotate: 10 }], strokes: [] } }),
    );
    const s = loadDecor()['route:c-1'].stickers[0];
    const mid = cardToScene(FRONT_CARD, DRAWING_BOX.x + DRAWING_BOX.size / 2, DRAWING_BOX.y + DRAWING_BOX.size / 2);
    expect(s.x).toBeCloseTo(mid.x / SCENE.w, 4);
    expect(s.y).toBeCloseTo(mid.y / SCENE.h, 4);
    // Same size on screen, and turned with the card.
    expect(s.size).toBeCloseTo((0.2 * DRAWING_BOX.size) / SCENE.w, 4);
    expect(s.rotate).toBe(10 + FRONT_CARD.angle);
    // The box's corners land inside the scene.
    const moved = boxToScene({ stickers: [], strokes: [{ tool: 'pen', color: 'ink-black', width: 'thin', points: [[0, 0], [1, 1]] }] });
    for (const [x, y] of moved.strokes[0].points) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(1);
    }
  });
});
