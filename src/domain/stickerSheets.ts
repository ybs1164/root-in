/**
 * Sticker packs: the tray's stickers laid out by hand into packs — a
 * coloured band with the pack's name over a white sheet. The packs live in
 * stickerPacks.json, made with the pack editor (tools/sticker-packs); the
 * sheet view peels stickers off them.
 */

import { getSticker } from './decor';
import packsFile from './stickerPacks.json';

export interface SheetSlot {
  stickerId: string;
  /** Centre, as fractions of the sticker area's width (x) and height (y) — the white part under the pack's band. */
  x: number;
  y: number;
  /** Width of the sticker's square picture, as a fraction of the sheet's width. */
  size: number;
  /** Turn in degrees, clockwise. */
  rotate: number;
}

/** The band's pattern beside the pack's name (drawn in CSS, `sticker-pack__motif--*`). */
export type PackMotif = 'stripes' | 'hearts' | 'dots' | 'checker' | 'grid' | 'sparkles' | 'lines' | 'none';
/** How the name is set: plain, in an outlined box, or slanted heavy. */
export type PackNameStyle = 'plain' | 'box' | 'slant';

export const PACK_MOTIFS: { motif: PackMotif; label: string }[] = [
  { motif: 'stripes', label: '사선' },
  { motif: 'hearts', label: '하트' },
  { motif: 'dots', label: '도트' },
  { motif: 'checker', label: '체크' },
  { motif: 'grid', label: '모눈' },
  { motif: 'sparkles', label: '반짝이' },
  { motif: 'lines', label: '가로줄' },
  { motif: 'none', label: '없음' },
];

export const PACK_NAME_STYLES: { style: PackNameStyle; label: string }[] = [
  { style: 'plain', label: '기본' },
  { style: 'box', label: '테두리 상자' },
  { style: 'slant', label: '굵게 기울임' },
];

export interface StickerSheet {
  id: string;
  /** The pack's name on its band (Latin reads best in its font). */
  name: string;
  /** Read out (absent = the name). */
  label?: string;
  /** The band's colour and the ink printed on it ('#rrggbb'). */
  color: string;
  ink: string;
  motif: PackMotif;
  nameStyle: PackNameStyle;
  /** Bottom to top: later ones lie over earlier ones. */
  slots: SheetSlot[];
}

/** The sticker area's height over its width (the band sits above it). */
export const SHEET_ASPECT = 0.9;

export const PACK_LIMITS = { packs: 60, slots: 24, name: 16, label: 30, minSize: 0.08, maxSize: 0.6 };

const HEX = /^#[0-9a-f]{6}$/;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Packs from a file (the app's own, or one made in the editor), checked:
 * anything the wrong shape is dropped, slots whose sticker isn't known are
 * left out, numbers are kept on the sheet, ids are made unique.
 */
export function readPacks(raw: unknown): StickerSheet[] {
  const list = (raw as { packs?: unknown } | null)?.packs;
  if (!Array.isArray(list)) return [];
  const ids = new Set<string>();
  const out: StickerSheet[] = [];
  for (const p of list.slice(0, PACK_LIMITS.packs)) {
    if (!p || typeof p !== 'object') continue;
    const r = p as Record<string, unknown>;
    if (typeof r.name !== 'string' || typeof r.color !== 'string' || typeof r.ink !== 'string') continue;
    const color = r.color.toLowerCase();
    const ink = r.ink.toLowerCase();
    if (!HEX.test(color) || !HEX.test(ink)) continue;
    let id = typeof r.id === 'string' && /^[a-z0-9-]{1,40}$/.test(r.id) ? r.id : 'pack';
    for (let n = 2; ids.has(id); n++) id = `${id.replace(/-\d+$/, '')}-${n}`;
    ids.add(id);
    const slots: SheetSlot[] = [];
    for (const sl of Array.isArray(r.slots) ? r.slots.slice(0, PACK_LIMITS.slots) : []) {
      const q = sl as Record<string, unknown> | null;
      if (!q || typeof q.stickerId !== 'string' || !getSticker(q.stickerId)) continue;
      const nums = [q.x, q.y, q.size, q.rotate ?? 0];
      if (!nums.every((v) => typeof v === 'number' && Number.isFinite(v))) continue;
      slots.push({
        stickerId: q.stickerId,
        x: round(clamp(q.x as number, 0, 1)),
        y: round(clamp(q.y as number, 0, 1)),
        size: round(clamp(q.size as number, PACK_LIMITS.minSize, PACK_LIMITS.maxSize)),
        rotate: Math.round(clamp((q.rotate as number | undefined) ?? 0, -180, 180)),
      });
    }
    const label = typeof r.label === 'string' ? r.label.trim().slice(0, PACK_LIMITS.label) : '';
    out.push({
      id,
      name: r.name.trim().slice(0, PACK_LIMITS.name),
      ...(label ? { label } : {}),
      color,
      ink,
      motif: PACK_MOTIFS.some((m) => m.motif === r.motif) ? (r.motif as PackMotif) : 'none',
      nameStyle: PACK_NAME_STYLES.some((m) => m.style === r.nameStyle) ? (r.nameStyle as PackNameStyle) : 'plain',
      slots,
    });
  }
  return out;
}

/** The file the editor hands over and the app reads. */
export const packsDocument = (packs: StickerSheet[]) => ({ version: 1, packs });

/**
 * A pack file as text, compact but still readable in a diff: a pack's own
 * fields on one line, then one line per sticker slot (about half the size of
 * an indent-everything JSON.stringify). Extra top-level fields (the editor's
 * savedAt) come after the packs.
 */
export function formatPacks(doc: { version: number; packs: StickerSheet[]; [key: string]: unknown }): string {
  const { version, packs, ...rest } = doc;
  const body = packs.map(({ slots, ...head }) => {
    const rows = slots.map((s) => `        ${JSON.stringify(s)}`).join(',\n');
    return `    {\n      ${JSON.stringify(head).slice(1, -1)},\n      "slots": [\n${rows}\n      ]\n    }`;
  });
  const extra = Object.entries(rest).map(([k, v]) => `,\n  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join('');
  return `{\n  "version": ${version},\n  "packs": [\n${body.join(',\n')}\n  ]${extra}\n}\n`;
}

/** A small seeded random source (mulberry32), so a tidy-up lays out the same every time. */
function seeded(text: string): () => number {
  let a = [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The editor's 자동 정렬: the stickers in a grid (3 across, as many rows as
 * it takes) on the white area, each nudged and turned a little so it reads
 * as stuck on by hand. A short last row is centred.
 */
export function layOutSheet(id: string, stickerIds: string[]): SheetSlot[] {
  const rand = seeded(id);
  const jitter = (amount: number) => (rand() * 2 - 1) * amount;
  const cols = 3;
  const rows = Math.max(3, Math.ceil(stickerIds.length / cols));
  const [left, right, top, bottom] = [0.07, 0.93, 0.05, 0.96];
  const cellW = (right - left) / cols;
  const cellH = (bottom - top) / rows;
  const size = Math.min(0.25, (cellH * SHEET_ASPECT) * 0.9);
  return stickerIds.map((stickerId, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, stickerIds.length - row * cols);
    const x = left + cellW * ((i % cols) + 0.5 + (cols - inRow) / 2);
    const y = top + cellH * (row + 0.5);
    return {
      stickerId,
      x: round(x + jitter(0.03)),
      y: round(y + jitter(0.02)),
      size: round(size + jitter(0.02)),
      rotate: Math.round(jitter(12)),
    };
  });
}

export const STICKER_SHEETS: StickerSheet[] = readPacks(packsFile);

// ----- Peeling -----

/** Pulled this far, as a share of the sticker's width, it comes off the sheet. */
export const PEEL_DETACH = 0.6;

export interface PeelFold {
  /** The pull's direction (unit). */
  nx: number;
  ny: number;
  /** A point on the fold line, which runs across the pull. */
  mx: number;
  my: number;
  /** 0 flat … 1 off the sheet. */
  progress: number;
}

/**
 * A sticker being pulled flat over itself, like a page turning: the edge
 * behind the pull lifts and folds over toward where the finger goes. The
 * lifted edge moves as far as the finger has (`dx`, `dy` from where it came
 * down), so the fold line lies halfway between where that edge was and
 * where it is now. `width` is the sticker's on-screen width; null when the
 * finger has barely moved.
 */
export function peelFold(cx: number, cy: number, width: number, dx: number, dy: number): PeelFold | null {
  const pulled = Math.hypot(dx, dy);
  if (pulled < 1) return null;
  const [nx, ny] = [dx / pulled, dy / pulled];
  // The lifting edge: the sticker's far side behind the pull (its picture is
  // inset in its square, so a little inside the square's half-width).
  const reach = width * 0.42;
  const ex = cx - nx * reach;
  const ey = cy - ny * reach;
  return { nx, ny, mx: ex + dx / 2, my: ey + dy / 2, progress: Math.min(1, pulled / (width * PEEL_DETACH)) };
}

/** A sticker taken off a sheet, handed to the drawing to stick down. */
export interface StickerDrop {
  stickerId: string;
  /** Where its centre was let go (client px); absent = the drawing's middle (a tap, or the keyboard). */
  at?: { x: number; y: number };
  /** Its picture's on-screen width (px), kept as it lands; absent = the usual size. */
  width?: number;
  rotate?: number;
}
