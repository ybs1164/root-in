import { describe, expect, it } from 'vitest';
import { joinRoads, type RoadPiece } from './roadStrokes';

const piece = (tier: RoadPiece['tier'], ...path: [number, number][]): RoadPiece => ({ tier, path });

describe('joinRoads', () => {
  it('joins an avenue cut into stubs back into one road, whichever way each stub runs', () => {
    const strokes = joinRoads([
      piece(2, [0, 0], [10, 0]),
      piece(2, [20, 0], [10, 0]),
      piece(2, [20, 0], [30, 0.4]),
    ]);
    expect(strokes).toHaveLength(1);
    expect(strokes[0].length).toBeCloseTo(30, 0);
    expect(strokes[0].path[0][0] === 0 || strokes[0].path[0][0] === 30).toBe(true);
  });

  it('at a crossing, each road runs straight on rather than turning', () => {
    const strokes = joinRoads([
      piece(2, [-10, 0], [0, 0]), piece(2, [0, 0], [10, 0]),
      piece(3, [0, -10], [0, 0]), piece(3, [0, 0], [0, 10]),
    ]);
    expect(strokes).toHaveLength(2);
    for (const s of strokes) {
      const [[x0, y0], [x1, y1]] = [s.path[0], s.path[s.path.length - 1]];
      expect(x0 === x1 || y0 === y1).toBe(true);
    }
  });

  it('a street ending on the side of an avenue splits the avenue there but leaves it one road', () => {
    const strokes = joinRoads([piece(2, [0, 0], [10, 0], [20, 0]), piece(4, [10, 0], [10, 10])]);
    expect(strokes).toHaveLength(2);
    expect(strokes.find((s) => s.tier === 2)!.length).toBeCloseTo(20, 5);
  });

  it('a sharp turn ends the road', () => {
    expect(joinRoads([piece(2, [0, 0], [10, 0]), piece(2, [10, 0], [2, 3])])).toHaveLength(2);
  });

  it('an avenue goes on as the avenue at a fork, not as the side street', () => {
    const strokes = joinRoads([
      piece(1, [0, 0], [10, 0]),
      piece(1, [10, 0], [20, 3]),
      piece(3, [10, 0], [20, -1]),
    ]);
    const main = strokes.find((s) => s.tier === 1)!;
    expect(main.path[main.path.length - 1][1] === 3 || main.path[0][1] === 3).toBe(true);
  });

  it('a closed ring becomes one stroke and the walk ends', () => {
    const strokes = joinRoads([
      // Joined mid-side, where the ring runs straight through.
      piece(3, [5, 0], [10, 0], [10, 10], [5, 10]),
      piece(3, [5, 10], [0, 10], [0, 0], [5, 0]),
    ]);
    expect(strokes).toHaveLength(1);
  });

  it('takes the tier most of a road is', () => {
    const [s] = joinRoads([piece(2, [0, 0], [30, 0]), piece(3, [30, 0], [35, 0])]);
    expect(s.tier).toBe(2);
  });
});
