// Ties this device's stores to cloud sync without them knowing about it:
// each store says when it wrote (`localWrote`), cloud sync listens; when a
// pull rewrote stores, the screens holding them reload (`onPulled`).

export type SyncCollection = 'categories' | 'pins' | 'folders' | 'routes' | 'days';

type WroteListener = (collection: SyncCollection) => void;
type PulledListener = (collections: ReadonlySet<SyncCollection>) => void;

const wrote = new Set<WroteListener>();
const pulled = new Set<PulledListener>();
let quiet = 0;

export function localWrote(...collections: SyncCollection[]): void {
  if (quiet) return;
  collections.forEach((c) => wrote.forEach((listener) => listener(c)));
}

export function onLocalWrote(listener: WroteListener): () => void {
  wrote.add(listener);
  return () => wrote.delete(listener);
}

/** Runs writes that came from the server: they aren't sent back up. */
export function withoutEcho<T>(write: () => T): T {
  quiet += 1;
  try {
    return write();
  } finally {
    quiet -= 1;
  }
}

export function pulledFromServer(collections: ReadonlySet<SyncCollection>): void {
  if (collections.size) pulled.forEach((listener) => listener(collections));
}

export function onPulled(listener: PulledListener): () => void {
  pulled.add(listener);
  return () => pulled.delete(listener);
}
