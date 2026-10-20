import { describe, expect, it } from 'vitest';
import { rgbOf, splitAlpha } from './cssColour';

describe('css colours for the map SDKs', () => {
  it("reads Chrome's color(srgb …) for a mix as rgb(), exactly — see-through ones too", () => {
    expect(rgbOf('color(srgb 1 0.5 0)')).toBe('rgb(255, 128, 0)');
    expect(rgbOf('color(srgb 0.4235 0.5647 0.8471 / 0.12)')).toBe('rgba(108, 144, 216, 0.12)');
    expect(rgbOf('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)');
    // Anything else is left to the one-pixel canvas.
    expect(rgbOf('oklch(0.7 0.1 250)')).toBeNull();
  });

  it("splits a see-through colour for Kakao's fillColor and fillOpacity", () => {
    expect(splitAlpha('rgba(108, 144, 216, 0.12)')).toEqual({ colour: 'rgb(108, 144, 216)', alpha: 0.12 });
    expect(splitAlpha('rgb(1, 2, 3)')).toEqual({ colour: 'rgb(1, 2, 3)', alpha: 1 });
  });
});
