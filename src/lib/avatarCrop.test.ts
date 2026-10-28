import { describe, expect, it } from 'vitest';
import { avatarCrop, constrainAvatarEdit, DEFAULT_AVATAR_EDIT } from './avatarCrop';

describe('avatar crop', () => {
  it.each([
    [1200, 800, 200, 0, 800],
    [800, 1200, 0, 200, 800],
    [800, 800, 0, 0, 800],
  ])('starts centred for a %i × %i image', (width, height, x, y, side) => {
    expect(avatarCrop(width, height, DEFAULT_AVATAR_EDIT)).toEqual({ x, y, side });
  });

  it('crops the chosen part of the original image when zoomed', () => {
    expect(avatarCrop(1200, 800, { x: 0.75, y: 0.25, zoom: 2 })).toEqual({ x: 700, y: 0, side: 400 });
  });

  it.each([[1200, 800], [800, 1200], [800, 800], [10, 4000]])('never exposes blank space in a %i × %i image', (width, height) => {
    for (const zoom of [0.1, 1, 1.7, 3, 10]) {
      for (const x of [-10, 0, 0.3, 1, 10]) {
        for (const y of [-10, 0, 0.7, 1, 10]) {
          const crop = avatarCrop(width, height, { x, y, zoom });
          expect(crop.x).toBeGreaterThanOrEqual(-1e-9);
          expect(crop.y).toBeGreaterThanOrEqual(-1e-9);
          expect(crop.x + crop.side).toBeLessThanOrEqual(width + 1e-9);
          expect(crop.y + crop.side).toBeLessThanOrEqual(height + 1e-9);
        }
      }
    }
  });

  it('brings an edge selection back inside the image when zooming out', () => {
    const edge = constrainAvatarEdit(1200, 800, { x: 1, y: 0, zoom: 3 });
    const crop = avatarCrop(1200, 800, { ...edge, zoom: 1 });
    expect(crop.x).toBeCloseTo(400);
    expect(crop.y).toBe(0);
    expect(crop.side).toBe(800);
  });
});
