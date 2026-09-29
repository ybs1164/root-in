import type { NewTravelRouteInput, TravelRoute } from '../types/travelRoute';

const STORAGE_KEY = 'goodroot:travel-routes:v1';

/**
 * Everything the app needs to read/write travel routes, kept independent of
 * *where* they actually live. `LocalTravelRouteRepository` below backs this
 * with localStorage for now; swapping in a REST/GraphQL-backed
 * implementation later (once there's a real backend + auth) means writing
 * one new class and changing the single call site that constructs
 * `travelRouteRepository` — nothing that calls through this interface has
 * to change.
 */
export interface TravelRouteRepository {
  /** Routes belonging to one user (today: this browser; later: an account). */
  listByUser(userId: string): Promise<TravelRoute[]>;
  /**
   * Every route this repository knows about, regardless of owner.
   *
   * A localStorage-backed repository only ever sees this one browser's
   * data, so today this is equivalent to `listByUser` for the sole local
   * user. It exists as the seam the upcoming recommendation feature will
   * read from: once routes are stored server-side, this naturally starts
   * returning every user's routes without callers changing.
   */
  listAll(): Promise<TravelRoute[]>;
  add(userId: string, input: NewTravelRouteInput): Promise<TravelRoute>;
  remove(id: string, userId: string): Promise<void>;
}

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `route-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export class LocalTravelRouteRepository implements TravelRouteRepository {
  private read(): TravelRoute[] {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as TravelRoute[]) : [];
    } catch {
      return [];
    }
  }

  private write(routes: TravelRoute[]): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
    } catch {
      // Ignore write failures (e.g. storage full/disabled); the in-memory
      // caller-side state still reflects the attempted change until reload.
    }
  }

  async listByUser(userId: string): Promise<TravelRoute[]> {
    return this.read().filter((route) => route.userId === userId);
  }

  async listAll(): Promise<TravelRoute[]> {
    return this.read();
  }

  async add(userId: string, input: NewTravelRouteInput): Promise<TravelRoute> {
    const route: TravelRoute = {
      id: generateId(),
      userId,
      origin: input.origin,
      destination: input.destination,
      title: input.title?.trim() || `${input.origin.name} → ${input.destination.name}`,
      note: input.note?.trim() || undefined,
      sharedBy: input.sharedBy?.trim(),
      createdAt: new Date().toISOString(),
    };

    this.write([...this.read(), route]);
    return route;
  }

  async remove(id: string, userId: string): Promise<void> {
    this.write(this.read().filter((route) => !(route.id === id && route.userId === userId)));
  }
}

export const travelRouteRepository: TravelRouteRepository = new LocalTravelRouteRepository();
