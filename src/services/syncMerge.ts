// Cloud sync core: rows are plain JSON objects keyed by id. Each device keeps,
// per row, a hash of the version it last agreed on with the server (`base`).
// Comparing this device's row and the server's row against that base tells
// who changed what since — a three-way merge, so an edit or a delete made
// offline on one phone isn't undone by the other's older copy.

export type SyncRow = Record<string, unknown>;
export type Rows = Map<string, SyncRow>;
/** id → hash of the row as last synced. */
export type Base = Record<string, string>;

/** JSON with object keys sorted, so the same content always reads the same (Postgres jsonb reorders keys). */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** FNV-1a (32-bit, two seeds) of the row's stable JSON: short enough to keep one per row. */
export function rowHash(row: SyncRow): string {
  const text = stableStringify(row);
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

export function hashAll(rows: Rows): Base {
  const base: Base = {};
  rows.forEach((row, id) => (base[id] = rowHash(row)));
  return base;
}

export interface MergeResult {
  /** What this device should hold now. */
  rows: Rows;
  /** Rows the server needs (new or changed here). */
  upsert: SyncRow[];
  /** Ids the server should drop (deleted here). */
  remove: string[];
  /** Whether `rows` differs from what this device had. */
  localChanged: boolean;
}

const stamp = (row: SyncRow): string => String(row.updated_at ?? row.created_at ?? '');

/**
 * Both sides against the last agreed base. A row only one side touched takes
 * that side; touched on both, the later `updated_at` wins (the server's when
 * there is none). An edit beats a delete, so nothing typed is lost.
 */
export function mergeRows(local: Rows, remote: Rows, base: Base): MergeResult {
  const rows: Rows = new Map();
  const upsert: SyncRow[] = [];
  const remove: string[] = [];
  let localChanged = false;
  const ids = new Set([...local.keys(), ...remote.keys()]);

  for (const id of ids) {
    const l = local.get(id);
    const r = remote.get(id);
    const b = base[id];
    if (l && r) {
      const hl = rowHash(l);
      const hr = rowHash(r);
      if (hl === hr || hl === b) {
        rows.set(id, r);
        if (hl !== hr) localChanged = true;
      } else if (hr === b) {
        rows.set(id, l);
        upsert.push(l);
      } else if (stamp(l) > stamp(r)) {
        rows.set(id, l);
        upsert.push(l);
      } else {
        rows.set(id, r);
        localChanged = true;
      }
    } else if (l) {
      if (b !== undefined && rowHash(l) === b) {
        localChanged = true; // deleted on another device
      } else {
        rows.set(id, l); // new here, or edited here after the other side deleted it
        upsert.push(l);
      }
    } else if (r) {
      if (b !== undefined && rowHash(r) === b) {
        remove.push(id); // deleted here
      } else {
        rows.set(id, r); // new elsewhere, or edited there after this side deleted it
        localChanged = true;
      }
    }
  }
  return { rows, upsert, remove, localChanged };
}

/** What this device changed since the base, to send without fetching first. */
export function diffRows(local: Rows, base: Base): { upsert: SyncRow[]; remove: string[] } {
  const upsert = [...local].filter(([id, row]) => base[id] !== rowHash(row)).map(([, row]) => row);
  const remove = Object.keys(base).filter((id) => !local.has(id));
  return { upsert, remove };
}
