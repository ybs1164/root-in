import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderDistrict } from './districtRenderer';
import type { DistrictMap } from '../domain/districtMap';

afterEach(() => vi.unstubAllGlobals());
const map: DistrictMap = { region: [], blocks: [], sourceRoadWidthM: 18 };
const viewport = { bounds: { west: 126, east: 127, south: 37, north: 38 }, widthPx: 400 };

describe('district render cancellation', () => {
  it('terminates an obsolete zoom worker without delivering its map', async () => {
    const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null };
    const create = vi.fn(function () { return worker; });
    vi.stubGlobal('Worker', create);
    const abort = new AbortController();
    const pending = renderDistrict(map, viewport, abort.signal);
    abort.abort();
    expect(await pending).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('does not start work when a viewport request is already obsolete', async () => {
    const create = vi.fn(); vi.stubGlobal('Worker', create);
    const abort = new AbortController(); abort.abort();
    expect(await renderDistrict(map, viewport, abort.signal)).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
