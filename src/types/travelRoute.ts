// A lightweight snapshot of a Place at the moment a route referencing it was
// created. Storing name/center (not just an id) means a saved route still
// renders correctly even if the underlying place catalog changes later, and
// it gives a future backend-aggregated recommendation feature something to
// group/display without having to re-join against a places table.
export interface PlaceRef {
  id: string;
  name: string;
  center: [number, number];
  /** Human-readable category, e.g. '카페', '한식'. */
  category?: string;
  address?: string;
}

export interface TravelRoute {
  id: string;
  // Owner of this route. Today every route lives in one browser's
  // localStorage, so this is just an anonymous per-browser id (see
  // lib/currentUser.ts). Once routes move to a real backend, this becomes
  // the authenticated user's id, and is what a recommendation feature would
  // use to tell "my routes" apart from "everyone's routes".
  userId: string;
  origin: PlaceRef;
  destination: PlaceRef;
  title: string;
  /** Free-form memo attached by the author (or carried over from a share). */
  note?: string;
  /** Set when this route was saved from someone else's share link. */
  sharedBy?: string;
  createdAt: string; // ISO timestamp
}

export interface NewTravelRouteInput {
  origin: PlaceRef;
  destination: PlaceRef;
  title?: string;
  note?: string;
  sharedBy?: string;
}

/**
 * What travels inside a share link. Deliberately self-contained (place
 * snapshots, not just ids) so the recipient needs nothing but the link —
 * and a future backend share service can store this exact shape.
 */
export interface SharedRoute {
  origin: PlaceRef;
  destination: PlaceRef;
  title: string;
  note?: string;
  /** Display name the sharer chose; empty means anonymous. */
  sharedBy?: string;
  sharedAt: string; // ISO timestamp
}
