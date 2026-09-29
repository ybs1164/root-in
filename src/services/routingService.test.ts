import { describe, expect, it, vi } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import { fetchRoute } from './routingService';

const origin = samplePlaces.onionSeongsu.center;
const destination = samplePlaces.seoulForest.center;

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 503, json: async () => body }) as Response;

describe('fetchRoute', () => {
  it('returns road geometry with distance and duration from OSRM', async () => {
    const coordinates = [origin, [127.05, 37.544], destination];
    const fetchMock = vi.fn(async (_url: string) =>
      jsonResponse({ code: 'Ok', routes: [{ geometry: { coordinates }, distance: 1800, duration: 420 }] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchRoute(origin, destination);

    expect(result).toEqual({ type: 'road', coordinates, distanceMeters: 1800, durationSeconds: 420 });
    expect(String(fetchMock.mock.calls[0][0])).toContain(`${origin[0]},${origin[1]};${destination[0]},${destination[1]}`);
  });

  it.each([
    ['no route found', () => jsonResponse({ code: 'NoRoute', routes: [] })],
    ['HTTP error', () => jsonResponse({}, false)],
    [
      'network failure',
      () => {
        throw new TypeError('Failed to fetch');
      },
    ],
  ])('falls back to a straight line on %s (never rejects)', async (_label, impl) => {
    vi.stubGlobal('fetch', vi.fn(async () => impl()));
    expect(await fetchRoute(origin, destination)).toEqual({ type: 'straight', coordinates: [origin, destination] });
  });

  it('falls back to a straight line when aborted by the caller', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          }),
      ),
    );
    const controller = new AbortController();
    const pending = fetchRoute(origin, destination, controller.signal);
    controller.abort();

    expect((await pending).type).toBe('straight');
  });
});
