import { describe, expect, it, vi } from 'vitest';
import type { AdminArea, AreaMap } from '../domain/adminAreas';
import type { MapViewport, Ring } from '../domain/districtMap';
import type { AdminAreaService } from './adminAreaService';
import { AreaRenderer } from './areaRenderer';

const square = (code: string, west: number, south: number, size: number): AdminArea => {
  const ring: Ring = [[west, south], [west + size, south], [west + size, south + size], [west, south + size], [west, south]];
  return { code, name: `${code}동`, bbox: { west, south, east: west + size, north: south + size }, polygons: [[ring]] };
};
const map = (focus: string): AreaMap => ({
  focus: { code: focus, name: focus },
  parts: [square('a', 127.005, 37.005, 0.015), square('b', 127.021, 37.005, 0.015)],
  others: [square('c', 127.005, 37.021, 0.031)],
});
const fakeService = (focus = { code: 'f' }) => {
  const service: AdminAreaService = { fetchAreaMap: vi.fn(async () => map(focus.code)) };
  return service;
};
const at = (west: number, south: number, span = 0.04): MapViewport =>
  ({ bounds: { west, south, east: west + span, north: south + span }, widthPx: 400 });

describe('area renderer', () => {
  it('draws once, then reuses the drawing while the screen pans inside it', async () => {
    const renderer = new AreaRenderer(fakeService());
    const first = await renderer.render(at(127, 37));
    expect(first && 'shapes' in first && first.shapes.parts.length).toBe(2);
    expect(first && 'shapes' in first && first.shapes.labels?.length).toBeGreaterThan(0);
    // A small pan: no new polygons (labels move only if they must).
    const panned = await renderer.render(at(127.003, 37.002));
    expect(panned === null || 'labels' in panned).toBe(true);
  });

  it('redraws after zooming, panning past the drawing or a new focus', async () => {
    const focus = { code: 'f' };
    const renderer = new AreaRenderer(fakeService(focus));
    await renderer.render(at(127, 37));
    const zoomed = await renderer.render(at(127.01, 37.01, 0.02));
    expect(zoomed && 'shapes' in zoomed).toBe(true);
    const far = await renderer.render(at(127.05, 37.01, 0.02));
    expect(far && 'shapes' in far).toBe(true);
    focus.code = 'g';
    const refocused = await renderer.render(at(127.05, 37.01, 0.02));
    expect(refocused && 'shapes' in refocused).toBe(true);
  });

  it('drops a request a newer one has replaced', async () => {
    const renderer = new AreaRenderer(fakeService());
    expect(await renderer.render(at(127, 37), {}, () => false)).toBeNull();
    // Nothing was drawn for it, so the next one still draws.
    const next = await renderer.render(at(127, 37));
    expect(next && 'shapes' in next).toBe(true);
  });

  it('sends a draft first for a screen nothing was drawn for, then the finished shapes', async () => {
    const renderer = new AreaRenderer(fakeService());
    const onDraft = vi.fn();
    const done = await renderer.render(at(127, 37), {}, () => true, onDraft);
    expect(onDraft).toHaveBeenCalledTimes(1);
    expect(onDraft.mock.calls[0][0].shapes.parts).toHaveLength(2);
    expect(done && 'shapes' in done && done.shapes.parts).toHaveLength(2);
    // Zooming in stays inside the drawing: the old shapes stay up, no draft.
    onDraft.mockClear();
    await renderer.render(at(127.01, 37.01, 0.02), {}, () => true, onDraft);
    expect(onDraft).not.toHaveBeenCalled();
  });

  it('redraws in full after a draft whose finished shapes a newer screen replaced', async () => {
    const renderer = new AreaRenderer(fakeService());
    const onDraft = vi.fn();
    expect(await renderer.render(at(127, 37), {}, () => false, onDraft)).toBeNull();
    // The draft never reached the map (a newer screen took over before it).
    expect(onDraft).not.toHaveBeenCalled();
    // A newer screen arrives while the draft is out.
    let current = true;
    onDraft.mockImplementation(() => { current = false; });
    expect(await renderer.render(at(127, 37), {}, () => current, onDraft)).toBeNull();
    expect(onDraft).toHaveBeenCalledTimes(1);
    // The map shows that draft, so the same screen must not count as drawn.
    const next = await renderer.render(at(127.003, 37.002));
    expect(next && 'shapes' in next).toBe(true);
  });
});
