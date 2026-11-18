/**
 * The sticker pack editor (dev only, tools/sticker-packs/index.html on the
 * dev server): lay stickers out on each pack by hand, name the pack, colour
 * its band, then export the file to hand over. Nothing here changes the app;
 * the exported file is applied with scripts/apply-sticker-packs.ts.
 *
 * The packs are drawn with the app's own classes (styles.css), so what's
 * laid out here is what the app shows.
 */

import React, { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import ReactDOM from 'react-dom/client';
import StickerPackBand from '../components/StickerPackBand';
import { getSticker, THEME_STICKERS, RECOVERED_STICKER_IDS, EDITOR_STICKERS as STICKERS } from '../domain/decor';
import {
  layOutSheet,
  PACK_LIMITS,
  PACK_MOTIFS,
  PACK_NAME_STYLES,
  formatPacks,
  oneIconPerTheme,
  packGroups,
  packsDocument,
  readPacks,
  setThemeIcon,
  setThemeIconBg,
  themeIcon,
  themeIconBg,
  SHEET_ASPECT,
  STICKER_SHEETS,
  type SheetSlot,
  type StickerSheet,
} from '../domain/stickerSheets';
import '../styles.css';
import './stickerPackEditor.css';

/** The work in progress, kept in this browser between visits (a tool's own key, not the app's). */
const DRAFT_KEY = 'goodroot-tools:sticker-packs:v1';
/** Edits this close together (same kind) undo as one: a drag, a slider pull, typing a name. */
const MERGE_MS = 700;
const HISTORY_MAX = 200;

/** The band colours the packs started with, to pick from. */
const PRESETS: { color: string; ink: string }[] = [
  { color: '#bcd9f2', ink: '#2f5d8a' },
  { color: '#f4c6d0', ink: '#2a2a2a' },
  { color: '#ffe58a', ink: '#3a2e1f' },
  { color: '#151515', ink: '#ffffff' },
  { color: '#d9bf96', ink: '#4a3523' },
  { color: '#e7c8f2', ink: '#5b2e78' },
  { color: '#b9d3a8', ink: '#2f4a26' },
  { color: '#ffffff', ink: '#2a3354' },
];

/** App theme palettes, paired with readable label ink. */
const THEME_PRESETS = [
  { name: '말차', colors: [['#a3c46f', '#3e5329'], ['#dfeac6', '#3e5329'], ['#6e9a3c', '#ffffff']] },
  { name: '바나나', colors: [['#ffd85f', '#a66726'], ['#fce89d', '#8e571f'], ['#a66726', '#ffffff']] },
  { name: '딸기', colors: [['#f48fa6', '#6b2337'], ['#fcdbe3', '#6b2337'], ['#c94a6a', '#ffffff']] },
  { name: '초코', colors: [['#a8704b', '#ffffff'], ['#ecdccf', '#4a2a1a'], ['#6f4128', '#ffffff']] },
];

const ZOOMS = [
  { width: 271, label: '폰 크기' },
  { width: 420, label: '크게' },
  { width: 560, label: '아주 크게' },
];

const round = (v: number) => Math.round(v * 1000) / 1000;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function loadDraft(): StickerSheet[] | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? readPacks(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function saveDraft(packs: StickerSheet[]) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(packsDocument(packs)));
    return true;
  } catch {
    return false;
  }
}

const freshId = (packs: StickerSheet[], base = 'pack') => {
  let n = packs.length + 1;
  while (packs.some((p) => p.id === `${base}-${n}`)) n++;
  return `${base}-${n}`;
};

/** A slot that spills off the white area (the app doesn't clip it, but it may cover the band or the edge). */
/** A pack whose main icon left with its sticker goes back to the default (its first sticker). */
const withIconOnPack = (p: StickerSheet): StickerSheet => {
  if (!p.icon || p.slots.some((s) => s.stickerId === p.icon)) return p;
  const { icon: _gone, ...rest } = p;
  return rest;
};

const spills = (s: SheetSlot) => {
  const half = s.size / 2;
  const halfY = half / SHEET_ASPECT;
  return s.x - half < -0.01 || s.x + half > 1.01 || s.y - halfY < -0.01 || s.y + halfY > 1.01;
};

function Editor() {
  // ----- Packs and undo -----
  const [initial] = useState(() => {
    const draft = loadDraft();
    return { packs: draft?.length ? draft : STICKER_SHEETS, fromDraft: !!draft?.length };
  });
  const [packs, setPacksState] = useState<StickerSheet[]>(initial.packs);
  const past = useRef<StickerSheet[][]>([]);
  const future = useRef<StickerSheet[][]>([]);
  const lastEdit = useRef<{ key: string; at: number } | null>(null);
  const [note, setNote] = useState(initial.fromDraft ? '지난번 작업을 불러왔어요.' : '앱에 들어 있는 스티커팩을 불러왔어요.');

  // Mirrored in a ref: a drag sends many edits between renders, each built on the last.
  const packsRef = useRef(packs);
  const show = (value: StickerSheet[]) => {
    packsRef.current = value;
    setPacksState(value);
  };
  /** One edit; `key` ties together a run of the same edit so it undoes in one step. */
  const edit = (next: StickerSheet[] | ((now: StickerSheet[]) => StickerSheet[]), key = '') => {
    const now = packsRef.current;
    // A rename can bring a second icon into a theme: it keeps the first.
    const value = oneIconPerTheme(typeof next === 'function' ? next(now) : next);
    if (value === now) return;
    const t = Date.now();
    const merge = key && lastEdit.current?.key === key && t - lastEdit.current.at < MERGE_MS;
    if (!merge) {
      past.current = [...past.current.slice(-HISTORY_MAX), now];
      future.current = [];
    }
    lastEdit.current = { key, at: t };
    show(value);
  };
  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(packsRef.current);
    lastEdit.current = null;
    show(prev);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(packsRef.current);
    lastEdit.current = null;
    show(next);
  };

  // Saved as it goes, so closing the tab loses nothing.
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setSaved(saveDraft(packs)), 300);
    return () => window.clearTimeout(t);
  }, [packs]);

  // ----- What's picked -----
  const [packIndex, setPackIndex] = useState(0);
  const pi = Math.min(packIndex, packs.length - 1);
  const pack = packs[pi] as StickerSheet | undefined;
  const [picked, setPicked] = useState<number | null>(null);
  const slot = pack && picked !== null ? pack.slots[picked] : undefined;
  useEffect(() => setPicked(null), [pi]);
  // Bring the picked pack into view only when the pick changes: a ref callback ran on
  // every render and pulled the list back up while scrolling or editing.
  const pickedPackRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    pickedPackRef.current?.scrollIntoView({ block: 'nearest' });
  }, [pi]);

  const editPack = (patch: Partial<StickerSheet> | ((p: StickerSheet) => Partial<StickerSheet>), key = '') =>
    edit((now) => now.map((p, i) => (i === pi ? withIconOnPack({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) }) : p)), key);
  /** The shown pack's theme icon (a sticker on one of its packs), or undefined for the default — its first pack's first sticker. */
  const setIcon = (stickerId: string | undefined) => {
    if (!pack) return;
    edit((now) => setThemeIcon(now, pack.name, stickerId, pack.id));
    setNote(
      stickerId
        ? `'${pack.name}' 테마의 대표 아이콘을 '${getSticker(stickerId)?.label ?? stickerId}'(으)로 정했어요.`
        : `'${pack.name}' 테마의 대표 아이콘을 기본(첫 팩의 첫 스티커)으로 되돌렸어요.`,
    );
  };
  const groups = packGroups(packs);
  const theme = pack ? groups.find((g) => g.name === pack.name) : undefined;
  const themeIconId = theme && themeIcon(theme.packs.map((p) => p.sheet));
  const themePicked = theme?.packs.find((p) => p.sheet.icon)?.sheet.icon;
  /** The square's background as set (undefined = the band colour), and as drawn. */
  const themeBgSet = theme?.packs.find((p) => p.sheet.iconBg)?.sheet.iconBg;
  const themeBg = theme ? (themeIconBg(theme.packs.map((p) => p.sheet)) ?? theme.color) : undefined;
  const setIconBg = (bg: string | undefined, key = '') => {
    if (!pack) return;
    edit((now) => setThemeIconBg(now, pack.name, bg), key);
  };
  const editSlot = (index: number, patch: Partial<SheetSlot>, key = '') =>
    editPack((p) => ({ slots: p.slots.map((s, i) => (i === index ? { ...s, ...patch } : s)) }), key);

  // ----- Packs list -----
  const addPack = () => {
    const id = freshId(packs);
    edit((now) => [...now, { id, name: 'NEW PACK', color: '#bcd9f2', ink: '#2f5d8a', motif: 'stripes', nameStyle: 'plain', slots: [] }]);
    setPackIndex(packs.length);
  };
  const duplicatePack = () => {
    if (!pack) return;
    const copy = { ...pack, id: freshId(packs, pack.id.replace(/-\d+$/, '')), slots: pack.slots.map((s) => ({ ...s })) };
    edit((now) => [...now.slice(0, pi + 1), copy, ...now.slice(pi + 1)]);
    setPackIndex(pi + 1);
  };
  const deletePack = () => {
    // No confirm() popup: some browsers (the app's own preview pane) block it, and undo brings it back.
    if (!pack) return;
    edit((now) => now.filter((_, i) => i !== pi));
    setPackIndex(Math.max(0, pi - 1));
    setNote(`'${pack.name}' 팩을 지웠어요. 되돌리기로 살릴 수 있어요.`);
  };
  // Up and down within the pack's theme: the order the app's < > page through.
  const themeNeighbour = (by: -1 | 1) => {
    if (!pack) return -1;
    const same = packs.flatMap((p, i) => (p.name === pack.name ? [i] : []));
    return same[same.indexOf(pi) + by] ?? -1;
  };
  const movePack = (by: -1 | 1) => {
    const to = themeNeighbour(by);
    if (!pack || to < 0) return;
    edit((now) => {
      const next = [...now];
      [next[pi], next[to]] = [next[to], next[pi]];
      return next;
    });
    setPackIndex(to);
  };

  // ----- Stickers on the pack -----
  const addSticker = (stickerId: string, at?: { x: number; y: number }) => {
    if (!pack) return;
    if (pack.slots.length >= PACK_LIMITS.slots) return setNote(`한 팩에는 ${PACK_LIMITS.slots}개까지 넣을 수 있어요.`);
    // Pressed rather than dropped: the next spot of a 3 × 3 grid, so they don't pile up.
    const n = pack.slots.length;
    const spot = at ?? { x: 0.2 + 0.3 * (n % 3) + 0.03 * Math.floor(n / 9), y: 0.19 + 0.31 * (Math.floor(n / 3) % 3) + 0.03 * Math.floor(n / 9) };
    const s: SheetSlot = { stickerId, x: round(clamp(spot.x, 0, 1)), y: round(clamp(spot.y, 0, 1)), size: 0.25, rotate: 0 };
    editPack((p) => ({ slots: [...p.slots, s] }));
    setPicked(pack.slots.length);
  };
  const removeSticker = (index: number) => {
    editPack((p) => ({ slots: p.slots.filter((_, i) => i !== index) }));
    setPicked(null);
  };
  const restack = (index: number, to: 'front' | 'back' | 1 | -1) => {
    if (!pack) return;
    const n = pack.slots.length;
    const dest = to === 'front' ? n - 1 : to === 'back' ? 0 : clamp(index + to, 0, n - 1);
    if (dest === index) return;
    editPack((p) => {
      const slots = [...p.slots];
      const [s] = slots.splice(index, 1);
      slots.splice(dest, 0, s);
      return { slots };
    });
    setPicked(dest);
  };
  const tidy = () => {
    if (!pack?.slots.length) return;
    const laid = layOutSheet(`${pack.id}-${Date.now()}`, pack.slots.map((s) => s.stickerId));
    editPack({ slots: laid });
    setNote('격자로 정리했어요. 마음에 안 들면 되돌리기.');
  };

  // Dragging a sticker on the pack: by fractions of the white area.
  const body = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ index: number; startX: number; startY: number; from: SheetSlot; id: number } | null>(null);
  const dragRun = useRef(0);
  const onSlotDown = (index: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!pack) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setPicked(index);
    drag.current = { index, startX: e.clientX, startY: e.clientY, from: pack.slots[index], id: ++dragRun.current };
  };
  const onSlotMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    const box = body.current?.getBoundingClientRect();
    if (!d || !box) return;
    const x = clamp(d.from.x + (e.clientX - d.startX) / box.width, 0, 1);
    const y = clamp(d.from.y + (e.clientY - d.startY) / box.height, 0, 1);
    editSlot(d.index, { x: round(x), y: round(y) }, `drag-${d.id}`);
  };
  const onSlotUp = () => {
    drag.current = null;
  };

  // Keys: nudge, turn, size, layer, delete, undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as Element | null)?.closest('input, textarea, select');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (typing) return;
        e.preventDefault();
        return e.shiftKey ? redo() : undo();
      }
      if (typing || picked === null || !slot) return;
      const step = e.shiftKey ? 0.02 : 0.005;
      const moves: Record<string, Partial<SheetSlot>> = {
        ArrowLeft: { x: round(clamp(slot.x - step, 0, 1)) },
        ArrowRight: { x: round(clamp(slot.x + step, 0, 1)) },
        ArrowUp: { y: round(clamp(slot.y - step, 0, 1)) },
        ArrowDown: { y: round(clamp(slot.y + step, 0, 1)) },
        '[': { rotate: clamp(slot.rotate - (e.shiftKey ? 15 : 1), -180, 180) },
        ']': { rotate: clamp(slot.rotate + (e.shiftKey ? 15 : 1), -180, 180) },
        '-': { size: round(clamp(slot.size - 0.01, PACK_LIMITS.minSize, PACK_LIMITS.maxSize)) },
        '=': { size: round(clamp(slot.size + 0.01, PACK_LIMITS.minSize, PACK_LIMITS.maxSize)) },
      };
      if (moves[e.key]) {
        e.preventDefault();
        return editSlot(picked, moves[e.key], `key-${e.key}`);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSticker(picked);
      } else if (e.key === 'Escape') setPicked(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ----- The sticker library -----
  const [query, setQuery] = useState('');
  const [imageRevision, setImageRevision] = useState(0);
  const [unusedOnly, setUnusedOnly] = useState(false);
  const [themeFilter, setThemeFilter] = useState('all');
  const uses = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of packs) for (const s of p.slots) m.set(s.stickerId, (m.get(s.stickerId) ?? 0) + 1);
    return m;
  }, [packs]);
  const unused = STICKERS.filter((s) => !uses.has(s.id));
  const library = STICKERS.filter((s) => {
    const matchesGroup = themeFilter === 'all'
      || (themeFilter === 'latest' && s.id.startsWith('theme-20261116-') && !RECOVERED_STICKER_IDS.has(s.id))
      || (themeFilter === 'previous' && s.id.startsWith('theme-20261115-'))
      || (themeFilter === 'recovered' && RECOVERED_STICKER_IDS.has(s.id))
      || (themeFilter === 'new' && /^theme-\d{8}-/.test(s.id))
      || new RegExp(`^theme-\\d{8}-${themeFilter}-`).test(s.id);
    return matchesGroup && (!unusedOnly || !uses.has(s.id)) && (!query || s.label.includes(query.trim()));
  });

  // ----- Files -----
  const fileInput = useRef<HTMLInputElement | null>(null);
  const exportFile = () => {
    const doc = { ...packsDocument(packs), savedAt: new Date().toISOString() };
    const blob = new Blob([formatPacks(doc)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'sticker-packs.json' });
    a.click();
    URL.revokeObjectURL(a.href);
    setNote('sticker-packs.json을 내려받았어요. 이 파일을 채팅에 올려 주시면 앱에 적용할게요.');
  };
  const importFile = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      const read = readPacks(raw);
      if (!read.length) return setNote('스티커팩 파일이 아니거나 비어 있어요.');
      const given = Array.isArray(raw?.packs) ? raw.packs.length : 0;
      edit(read);
      setPackIndex(0);
      setNote(`${read.length}개 팩을 불러왔어요.${given > read.length ? ` (${given - read.length}개는 형식이 맞지 않아 뺐어요)` : ''}`);
    } catch {
      setNote('파일을 읽지 못했어요.');
    }
  };
  const resetToApp = () => {
    edit(STICKER_SHEETS);
    setPackIndex(0);
    setNote('앱에 들어 있는 스티커팩으로 돌아왔어요. 되돌리기로 하던 작업을 살릴 수 있어요.');
  };

  // ----- Checks before handing over -----
  const issues: string[] = [];
  packs.forEach((p, i) => {
    if (!p.name.trim()) issues.push(`${i + 1}번 팩: 이름이 비어 있어요.`);
    if (!p.slots.length) issues.push(`${i + 1}번 팩 '${p.name}': 스티커가 없어요.`);
    const spilled = p.slots.filter(spills).length;
    if (spilled) issues.push(`${i + 1}번 팩 '${p.name}': ${spilled}개가 흰 면 밖으로 나가요.`);
  });

  const [zoom, setZoom] = useState(1);

  return (
    <div className="spe">
      <header className="spe__head">
        <h1>스티커팩 편집기</h1>
        <span className="spe__note" role="status">
          {note}
        </span>
        <span className={`spe__saved ${saved ? '' : 'is-failed'}`}>{saved ? '이 브라우저에 자동 저장됨' : '자동 저장 실패 — 내보내기로 보관하세요'}</span>
        <div className="spe__actions">
          <button onClick={undo} disabled={!past.current.length} title="Ctrl/⌘+Z">
            되돌리기
          </button>
          <button onClick={redo} disabled={!future.current.length} title="Ctrl/⌘+Shift+Z">
            다시 실행
          </button>
          <button onClick={() => fileInput.current?.click()}>불러오기</button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = '';
            }}
          />
          <button onClick={resetToApp}>앱 값으로 되돌리기</button>
          <button className="is-primary" onClick={exportFile}>
            내보내기
          </button>
        </div>
      </header>

      {/* Packs by theme (the packs of one name), each theme's in the order the app pages through them. */}
      <aside className="spe__packs">
        <div className="spe__pack-list">
        {groups.map((g) => {
          const icon = getSticker(themeIcon(g.packs.map((p) => p.sheet)) ?? '');
          return (
            <section key={g.name} className="spe__theme">
              <h3 className="spe__theme-head">
                <span
                  className="spe__icon-preview spe__icon-preview--small"
                  style={{ background: themeIconBg(g.packs.map((p) => p.sheet)) ?? g.color }}
                  aria-hidden
                >
                  {icon && <img src={icon.src} alt="" />}
                </span>
                {g.name || '이름 없음'}
                <small>{g.packs.length}팩</small>
              </h3>
              <ol>
                {g.packs.map(({ sheet: p, index: i }, n) => (
                  <li key={p.id}>
                    <button
                      ref={i === pi ? pickedPackRef : undefined}
                      className={`spe__pack ${i === pi ? 'is-on' : ''}`}
                      onClick={() => setPackIndex(i)}
                    >
                      <span className="spe__pack-band" style={{ background: p.color, color: p.ink }}>
                        {p.name || '이름 없음'} {n + 1}
                      </span>
                      <span className="spe__pack-count">스티커 {p.slots.length}개</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
        </div>
        <div className="spe__row">
          <button onClick={addPack}>+ 새 팩</button>
          <button onClick={duplicatePack} disabled={!pack}>
            복제
          </button>
        </div>
        <div className="spe__row">
          <button onClick={() => movePack(-1)} disabled={themeNeighbour(-1) < 0} aria-label="테마 안에서 위로">
            ↑
          </button>
          <button onClick={() => movePack(1)} disabled={themeNeighbour(1) < 0} aria-label="테마 안에서 아래로">
            ↓
          </button>
          <button className="is-danger" onClick={deletePack} disabled={!pack}>
            삭제
          </button>
        </div>
      </aside>

      {/* The pack, drawn as the app draws it. */}
      <main className="spe__stage">
        <div className="spe__zoom">
          {ZOOMS.map((z, i) => (
            <button key={z.width} className={zoom === i ? 'is-on' : ''} onClick={() => setZoom(i)}>
              {z.label}
            </button>
          ))}
        </div>
        {pack ? (
          <div className="spe__canvas" style={{ '--sheet-w': `${ZOOMS[zoom].width}px` } as CSSProperties}>
            <div
              className="sticker-sheet"
              style={{ '--pack': pack.color, '--pack-ink': pack.ink } as CSSProperties}
              onPointerDown={(e) => !(e.target as Element).closest('.sticker-sheet__slot') && setPicked(null)}
            >
              <StickerPackBand sheet={pack} />
              <div
                ref={body}
                className="sticker-sheet__body"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/x-sticker');
                  const box = body.current?.getBoundingClientRect();
                  if (!id || !box) return;
                  addSticker(id, { x: clamp((e.clientX - box.left) / box.width, 0, 1), y: clamp((e.clientY - box.top) / box.height, 0, 1) });
                }}
              >
                {pack.slots.map((s, i) => {
                  const sticker = getSticker(s.stickerId);
                  if (!sticker) return null;
                  return (
                    <button
                      key={`${i}-${s.stickerId}`}
                      className={`sticker-sheet__slot spe__slot ${picked === i ? 'is-picked' : ''} ${spills(s) ? 'is-spilling' : ''}`}
                      style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.size * 100}%`, rotate: `${s.rotate}deg` }}
                      aria-label={sticker.label}
                      onPointerDown={onSlotDown(i)}
                      onPointerMove={onSlotMove}
                      onPointerUp={onSlotUp}
                      onPointerCancel={onSlotUp}
                    >
                      <img src={sticker.src} alt="" draggable={false} />
                    </button>
                  );
                })}
                {!pack.slots.length && <p className="spe__empty">오른쪽 목록에서 스티커를 끌어 오거나 눌러서 넣으세요.</p>}
              </div>
            </div>
          </div>
        ) : (
          <p className="spe__empty">팩이 없어요. 왼쪽에서 + 새 팩.</p>
        )}

        {/* The picked sticker. */}
        <section className="spe__panel spe__picked">
          {slot && picked !== null ? (
            <>
              <h2>{getSticker(slot.stickerId)?.label}</h2>
              <label>
                크기 <output>{Math.round(slot.size * 100)}%</output>
                <input
                  type="range"
                  min={PACK_LIMITS.minSize}
                  max={PACK_LIMITS.maxSize}
                  step={0.005}
                  value={slot.size}
                  onChange={(e) => editSlot(picked, { size: round(Number(e.target.value)) }, 'size')}
                />
              </label>
              <label>
                회전 <output>{slot.rotate}°</output>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={slot.rotate}
                  onChange={(e) => editSlot(picked, { rotate: Number(e.target.value) }, 'rotate')}
                />
              </label>
              <div className="spe__row">
                <button onClick={() => restack(picked, 'front')}>맨 앞으로</button>
                <button onClick={() => restack(picked, 1)}>앞으로</button>
                <button onClick={() => restack(picked, -1)}>뒤로</button>
                <button onClick={() => restack(picked, 'back')}>맨 뒤로</button>
              </div>
              <div className="spe__row">
                <button onClick={() => addSticker(slot.stickerId, { x: clamp(slot.x + 0.04, 0, 1), y: clamp(slot.y + 0.04, 0, 1) })}>복제</button>
                <button className={themePicked === slot.stickerId ? 'is-on' : ''} onClick={() => setIcon(slot.stickerId)}>
                  테마 대표 아이콘으로
                </button>
                <button className="is-danger" onClick={() => removeSticker(picked)}>
                  빼기
                </button>
              </div>
            </>
          ) : (
            <p className="spe__hint">
              스티커를 눌러 고르고 끌어서 옮겨요. 방향키 = 옮기기(Shift 크게) · [ ] = 회전 · - = = 크기 · Delete = 빼기 · Esc = 선택 해제
            </p>
          )}
          {pack && (
            <div className="spe__row">
              <button onClick={tidy} disabled={!pack.slots.length}>
                자동 정렬
              </button>
              <button
                className="is-danger"
                onClick={() => {
                  editPack({ slots: [] });
                  setNote('스티커를 모두 뺐어요. 되돌리기로 살릴 수 있어요.');
                }}
                disabled={!pack.slots.length}
              >
                모두 빼기
              </button>
            </div>
          )}
        </section>
      </main>

      <aside className="spe__side">
        {/* The pack's name and band. */}
        {pack && (
          <section className="spe__panel">
            <h2>팩 꾸미기</h2>
            <label>
              이름 = 테마 <small>(띠에 적히는 글자, {PACK_LIMITS.name}자 · 영문이 잘 어울려요 · 이름이 같은 팩끼리 한 테마로 묶여요)</small>
              <input
                value={pack.name}
                maxLength={PACK_LIMITS.name}
                onChange={(e) => editPack({ name: e.target.value }, 'name')}
              />
            </label>
            <label>
              읽는 이름 <small>(화면 읽기용, 비우면 이름)</small>
              <input
                value={pack.label ?? ''}
                maxLength={PACK_LIMITS.label}
                onChange={(e) => editPack({ label: e.target.value || undefined }, 'label')}
              />
            </label>
            <div className="spe__colors">
              <label>
                띠 색
                <span className="spe__color">
                  <input type="color" value={pack.color} onChange={(e) => editPack({ color: e.target.value }, 'color')} />
                  <code>{pack.color}</code>
                </span>
              </label>
              <label>
                글자 색
                <span className="spe__color">
                  <input type="color" value={pack.ink} onChange={(e) => editPack({ ink: e.target.value }, 'ink')} />
                  <code>{pack.ink}</code>
                </span>
              </label>
            </div>
            <div className="spe__theme-presets" role="group" aria-label="테마 기본 색상">
              {THEME_PRESETS.map((theme) => (
                <div key={theme.name} className="spe__theme-preset-row">
                  <strong>{theme.name}</strong>
                  {theme.colors.map(([color, ink], i) => (
                    <button key={color} style={{ background: color, color: ink }}
                      aria-label={`${theme.name} ${['기본', '연한색', '진한색'][i]} 색상 적용`}
                      title={`띠 ${color} · 글자 ${ink}`}
                      onClick={() => editPack({ color, ink })}>
                      {['기본', '연한색', '진한색'][i]}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="spe__presets" role="group" aria-label="색 조합">
              {PRESETS.map((c) => (
                <button
                  key={c.color}
                  style={{ background: c.color, color: c.ink }}
                  aria-label={`띠 ${c.color} 글자 ${c.ink}`}
                  onClick={() => editPack({ color: c.color, ink: c.ink })}
                >
                  Aa
                </button>
              ))}
            </div>
            <div className="spe__field">
              이름 모양
              <div className="spe__chips">
                {PACK_NAME_STYLES.map((n) => (
                  <button key={n.style} className={pack.nameStyle === n.style ? 'is-on' : ''} onClick={() => editPack({ nameStyle: n.style })}>
                    {n.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="spe__field">
              무늬
              <div className="spe__chips">
                {PACK_MOTIFS.map((m) => (
                  <button key={m.motif} className={pack.motif === m.motif ? 'is-on' : ''} onClick={() => editPack({ motif: m.motif })}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {theme && (
              <div className="spe__field">
                테마 대표 아이콘{' '}
                <small>
                  ('{pack.name}' 테마 {theme.packs.length}팩에 하나 — 앱 스티커 창 위 테마 정사각형에 나오는 그림, 그 테마 팩들의 스티커 중에서)
                </small>
                <div className="spe__icon-pick">
                  <span className="spe__icon-preview" style={{ background: themeBg }} aria-label="테마 정사각형 미리보기">
                    {getSticker(themeIconId ?? '') && <img src={getSticker(themeIconId ?? '')!.src} alt="" />}
                  </span>
                  <div className="spe__icons" role="group" aria-label="테마 대표 아이콘 고르기">
                    <button className={!themePicked ? 'is-on' : ''} onClick={() => setIcon(undefined)} title="테마 첫 팩의 첫 스티커">
                      기본
                    </button>
                    {[...new Set(theme.packs.flatMap((p) => p.sheet.slots.map((sl) => sl.stickerId)))].map((id) => {
                      const st = getSticker(id);
                      return (
                        st && (
                          <button key={id} className={`spe__icon ${themePicked === id ? 'is-on' : ''}`} title={st.label} aria-label={`대표 아이콘: ${st.label}`} onClick={() => setIcon(id)}>
                            <img src={st.src} alt="" draggable={false} />
                          </button>
                        )
                      );
                    })}
                  </div>
                </div>
                {/* The square behind the icon: the band colour unless set — any colour, or none. */}
                <div className="spe__icon-bg" role="group" aria-label="테마 정사각형 배경 색">
                  배경
                  <button className={!themeBgSet ? 'is-on' : ''} onClick={() => setIconBg(undefined)} title="첫 팩의 띠 색">
                    띠 색
                  </button>
                  <button className={themeBgSet === 'transparent' ? 'is-on' : ''} onClick={() => setIconBg('transparent')}>
                    투명
                  </button>
                  <span className="spe__color">
                    <input
                      type="color"
                      aria-label="배경 색 고르기"
                      value={themeBg && themeBg !== 'transparent' ? themeBg : theme.color}
                      onChange={(e) => setIconBg(e.target.value, 'icon-bg')}
                    />
                    <code>{themeBgSet ?? theme.color}</code>
                  </span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Every sticker in the tray: drag onto the pack, or press to drop it in the middle. */}
        <section className="spe__panel spe__library">
          <h2>
            스티커 <small>{STICKERS.length}개 · 안 쓴 것 {unused.length}개</small>
          </h2>
          <div className="spe__row">
            <select aria-label="스티커 테마" value={themeFilter} onChange={(e) => setThemeFilter(e.target.value)}>
              <option value="all">전체 스티커 · {STICKERS.length}개</option>
              <option value="previous">이전 작업 · 144개</option>
              <option value="recovered">누락 복원 · 12개</option>
              <option value="latest">이번 추가 스티커 · 120개</option>
              <option value="new">테마 스티커 전체 · {THEME_STICKERS.length}개</option>
              <option value="matcha">말차 · {THEME_STICKERS.filter(s => s.id.includes('-matcha-')).length}개</option>
              <option value="banana">바나나 · {THEME_STICKERS.filter(s => s.id.includes('-banana-')).length}개</option>
              <option value="strawberry">딸기 · {THEME_STICKERS.filter(s => s.id.includes('-strawberry-')).length}개</option>
              <option value="choco">초코 · {THEME_STICKERS.filter(s => s.id.includes('-choco-')).length}개</option>
            </select>
            <input placeholder="이름으로 찾기" value={query} onChange={(e) => setQuery(e.target.value)} />
            <label className="spe__check">
              <input type="checkbox" checked={unusedOnly} onChange={(e) => setUnusedOnly(e.target.checked)} /> 안 쓴 것만
            </label>
          </div>
          <button className="spe__reload-images" onClick={() => setImageRevision(Date.now())}>이미지 다시 불러오기</button>
          <div className="spe__grid">
            {library.map((s) => (
              <button
                key={s.id}
                className="spe__thumb"
                draggable
                title={s.label}
                onDragStart={(e) => e.dataTransfer.setData('text/x-sticker', s.id)}
                onClick={() => addSticker(s.id)}
              >
                <img key={`${s.id}-${imageRevision}`} src={imageRevision ? `${s.src}${s.src.includes('?') ? '&' : '?'}reload=${imageRevision}` : s.src} alt={s.label} draggable={false} loading="eager" decoding="async" />
                {uses.has(s.id) && <span className="spe__uses">{uses.get(s.id)}</span>}
              </button>
            ))}
          </div>
        </section>
      </aside>

      <footer className="spe__foot">
        {issues.length ? (
          <details>
            <summary>확인할 것 {issues.length}개</summary>
            <ul>
              {issues.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </details>
        ) : (
          <span>모든 팩이 괜찮아요.</span>
        )}
        <span>
          {packs.length}개 팩 · 안 쓴 스티커 {unused.length}개(앱의 스티커 고르기에 안 나와요)
        </span>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Editor />
  </React.StrictMode>,
);
