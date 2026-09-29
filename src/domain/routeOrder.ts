import { haversineMeters, type LonLat } from './geo';

// Ordering pins into a walkable line ("선으로 잇기"). There is no routing
// API (plan 1.5), so "short" means the shortest straight-line path. Inputs
// are small (a course is ≤ 10 stops), so nearest-neighbour + 2-opt is
// plenty; brute force exists only to check it in tests.

/** Total length of an open path visiting `points` in `order`. */
export function pathLength(points: LonLat[], order: number[]): number {
  let total = 0;
  for (let i = 1; i < order.length; i += 1) total += haversineMeters(points[order[i - 1]], points[order[i]]);
  return total;
}

function nearestNeighbour(points: LonLat[], start: number): number[] {
  const order = [start];
  const left = new Set(points.map((_, i) => i).filter((i) => i !== start));
  while (left.size > 0) {
    const last = points[order[order.length - 1]];
    let best = -1;
    let bestDistance = Infinity;
    for (const i of left) {
      const d = haversineMeters(last, points[i]);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    order.push(best);
    left.delete(best);
  }
  return order;
}

/** Reverses segments while that shortens the path; the first stop stays first. */
function twoOpt(points: LonLat[], order: number[]): number[] {
  let best = order;
  let bestLength = pathLength(points, best);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 1; i += 1) {
      for (let k = i + 1; k < best.length; k += 1) {
        const candidate = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const length = pathLength(points, candidate);
        if (length + 1e-6 < bestLength) {
          best = candidate;
          bestLength = length;
          improved = true;
        }
      }
    }
  }
  return best;
}

/**
 * A short visiting order. With a fixed `start` the path begins there;
 * otherwise every start is tried and the shortest path wins.
 */
export function orderByNearest(points: LonLat[], start?: number): number[] {
  if (points.length <= 2) return points.map((_, i) => i);
  const starts = start !== undefined ? [start] : points.map((_, i) => i);
  let best: number[] = [];
  let bestLength = Infinity;
  for (const s of starts) {
    const order = twoOpt(points, nearestNeighbour(points, s));
    const length = pathLength(points, order);
    if (length < bestLength) {
      best = order;
      bestLength = length;
    }
  }
  return best;
}

/** Index of the point closest to `from` (e.g. the user's location). */
export function nearestIndex(points: LonLat[], from: LonLat): number {
  let best = -1;
  let bestDistance = Infinity;
  points.forEach((p, i) => {
    const d = haversineMeters(from, p);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return best;
}

/** Exhaustive shortest open path — tests only; O(n!). */
export function bruteForceOrder(points: LonLat[]): number[] {
  let best: number[] = [];
  let bestLength = Infinity;
  const permute = (prefix: number[], rest: number[]) => {
    if (rest.length === 0) {
      const length = pathLength(points, prefix);
      if (length < bestLength) {
        bestLength = length;
        best = prefix;
      }
      return;
    }
    rest.forEach((r, i) => permute([...prefix, r], [...rest.slice(0, i), ...rest.slice(i + 1)]));
  };
  permute([], points.map((_, i) => i));
  return best;
}
