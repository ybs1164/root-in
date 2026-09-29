import { beforeEach } from 'vitest';

// Services read `window.localStorage` directly. A plain Node environment is
// enough for them (no DOM rendering is tested), so a small in-memory Storage
// stands in for jsdom/happy-dom and is wiped before every test.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

const storage = new MemoryStorage();
const g = globalThis as unknown as { window?: unknown; localStorage?: Storage };
g.localStorage = storage;
g.window ??= globalThis;

beforeEach(() => {
  storage.clear();
});
