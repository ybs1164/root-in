import { describe, expect, it } from 'vitest';
import { STICKER_EDGE_RATIO, stickerEdgePx } from './stickerEdge';

describe('sticker edge', () => {
  it("keeps to the sticker's own width, a hairline at least", () => {
    expect(stickerEdgePx(100)).toBeCloseTo(100 * STICKER_EDGE_RATIO);
    expect(stickerEdgePx(400) / 400).toBeCloseTo(stickerEdgePx(100) / 100);
    expect(stickerEdgePx(5)).toBe(0.6);
  });
});
