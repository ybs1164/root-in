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
import { StickerPackBand } from '../components/StickerSheets';
import { getSticker, STICKERS } from '../domain/decor';
import {
  layOutSheet,
  PACK_LIMITS,
  PACK_MOTIFS,
  PACK_NAME_STYLES,
  formatPacks,
  packsDocument,
  readPacks,
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
    const value = typeof next === 'function' ? next(now) : next;
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

  const editPack = (patch: Partial<StickerSheet> | ((p: StickerSheet) => Partial<StickerSheet>), key = '') =>
    edit((now) => now.map((p, i) => (i === pi ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p)), key);
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
  const movePack = (by: -1 | 1) => {
    const to = pi + by;
    if (!pack || to < 0 || to >= packs.length) return;
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
  const [unusedOnly, setUnusedOnly] = useState(false);
  const uses = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of packs) for (const s of p.slots) m.set(s.stickerId, (m.get(s.stickerId) ?? 0) + 1);
    return m;
  }, [packs]);
  const unused = STICKERS.filter((s) => !uses.has(s.id));
  const library = STICKERS.filter((s) => (!unusedOnly || !uses.has(s.id)) && (!query || s.label.includes(query.trim())));

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

      {/* Packs, in the order the app pages through them. */}
      <aside className="spe__packs">
        <ol>
          {packs.map((p, i) => (
            <li key={p.id}>
              <button
                ref={i === pi ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                className={`spe__pack ${i === pi ? 'is-on' : ''}`}
                onClick={() => setPackIndex(i)}
              >
                <span className="spe__pack-band" style={{ background: p.color, color: p.ink }}>
                  {p.name || '이름 없음'}
                </span>
                <span className="spe__pack-count">
                  {i + 1} · 스티커 {p.slots.length}개
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="spe__row">
          <button onClick={addPack}>+ 새 팩</button>
          <button onClick={duplicatePack} disabled={!pack}>
            복제
          </button>
        </div>
        <div className="spe__row">
          <button onClick={() => movePack(-1)} disabled={pi <= 0} aria-label="위로">
            ↑
          </button>
          <button onClick={() => movePack(1)} disabled={pi >= packs.length - 1} aria-label="아래로">
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
              이름 <small>(띠에 적히는 글자, {PACK_LIMITS.name}자 · 영문이 잘 어울려요)</small>
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
          </section>
        )}

        {/* Every sticker in the tray: drag onto the pack, or press to drop it in the middle. */}
        <section className="spe__panel spe__library">
          <h2>
            스티커 <small>{STICKERS.length}개 · 안 쓴 것 {unused.length}개</small>
          </h2>
          <div className="spe__row">
            <input placeholder="이름으로 찾기" value={query} onChange={(e) => setQuery(e.target.value)} />
            <label className="spe__check">
              <input type="checkbox" checked={unusedOnly} onChange={(e) => setUnusedOnly(e.target.checked)} /> 안 쓴 것만
            </label>
          </div>
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
                <img src={s.src} alt={s.label} draggable={false} loading="lazy" />
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
