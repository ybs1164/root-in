import { beforeEach, describe, expect, it } from 'vitest';
import { loadGalleryStars, saveGalleryStars } from './galleryStarRepository';

describe('galleryStarRepository', () => {
  beforeEach(() => localStorage.clear());

  it('keeps my starred photos, each once', () => {
    saveGalleryStars(['u/a.jpg', 'u/b.jpg', 'u/a.jpg']);
    expect(loadGalleryStars()).toEqual(['u/a.jpg', 'u/b.jpg']);
  });

  it('drops broken storage and values that make no sense', () => {
    localStorage.setItem('goodroot:gallery-stars:v1', '{oops');
    expect(loadGalleryStars()).toEqual([]);
    localStorage.setItem('goodroot:gallery-stars:v1', JSON.stringify(['ok', 3, '', 'x'.repeat(200)]));
    expect(loadGalleryStars()).toEqual(['ok']);
  });
});
