import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { getSticker } from '../domain/decor';
import type { StickerSheet } from '../domain/stickerSheets';
import { StickerPackBand } from './StickerSheets';

/** Packs that share a name (MATCHA, BANANA …), in the order they first appear. */
export function packGroups(sheets: StickerSheet[]): { name: string; color: string; packs: { sheet: StickerSheet; index: number }[] }[] {
  const out: { name: string; color: string; packs: { sheet: StickerSheet; index: number }[] }[] = [];
  sheets.forEach((sheet, index) => {
    let group = out.find((g) => g.name === sheet.name);
    if (!group) out.push((group = { name: sheet.name, color: sheet.color, packs: [] }));
    group.packs.push({ sheet, index });
  });
  return out;
}

/** A pack as printed (band and stickers), only to look at. */
function PackPreview({ sheet }: { sheet: StickerSheet }) {
  return (
    <div className="sticker-list__current" style={{ '--pack': sheet.color, '--pack-ink': sheet.ink } as CSSProperties} aria-hidden>
      <StickerPackBand sheet={sheet} />
      <div className="sticker-sheet__body">
        {sheet.slots.map((slot, i) => {
          const sticker = getSticker(slot.stickerId);
          return (
            sticker && (
              <img
                key={i}
                className="sticker-list__current-sticker"
                src={sticker.src}
                alt=""
                style={{ left: `${slot.x * 100}%`, top: `${slot.y * 100}%`, width: `${slot.size * 100}%`, rotate: `${slot.rotate}deg` }}
              />
            )
          );
        })}
      </div>
    </div>
  );
}

/**
 * Every sticker pack, opened from the band of the pack that's up: the
 * current pack floats small above a sheet listing them all, one row each
 * (a thumbnail, the name and its number among packs of that name, a peek at
 * its stickers, how many). Theme chips across the top jump to those packs.
 * A row picks that pack; the dim above, ⌄, Esc or back close it.
 */
export default function StickerPackList({
  sheets,
  current,
  onPick,
  onClose,
}: {
  sheets: StickerSheet[];
  current: number;
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  const groups = useMemo(() => packGroups(sheets), [sheets]);
  const list = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(sheets[current]?.name ?? groups[0]?.name);
  const chips = useRef<HTMLDivElement | null>(null);

  // Open on the pack in use, a little below the top.
  useEffect(() => {
    const row = list.current?.querySelector<HTMLElement>('.sticker-list__row.is-on');
    if (row && list.current) list.current.scrollTop = Math.max(0, row.offsetTop - 96);
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  // The chip of the theme at the top of the list lights up (and scrolls into view).
  const onScroll = () => {
    const box = list.current;
    if (!box) return;
    let name = groups[0]?.name;
    for (const sec of box.querySelectorAll<HTMLElement>('[data-group]')) {
      if (sec.offsetTop - box.scrollTop <= 24) name = sec.dataset.group ?? name;
    }
    if (name && name !== shown) {
      setShown(name);
      chips.current?.querySelector<HTMLElement>(`[data-chip="${CSS.escape(name)}"]`)?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
  };

  const jump = (name: string) => {
    const box = list.current;
    const sec = box?.querySelector<HTMLElement>(`[data-group="${CSS.escape(name)}"]`);
    if (!box || !sec) return;
    setShown(name);
    box.scrollTo({ top: sec.offsetTop, behavior: 'smooth' });
  };

  const pack = sheets[current];
  return (
    // Not modal: it sits in the sticker tool (so taps in it aren't "outside"
    // the tool); open, the back button closes it like any open dialog.
    <dialog
      open
      className="sticker-list"
      aria-label="스티커 팩 목록"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <button className="sticker-list__dim" aria-label="스티커 팩 목록 닫기" onClick={onClose} />
      {pack && <PackPreview sheet={pack} />}
      <div className="sticker-list__sheet">
        <div className="sticker-list__head">
          <h2>STICKER PACKS</h2>
          <span>{sheets.length}개 팩</span>
        </div>
        <div ref={chips} className="sticker-list__chips" data-swipe-keep>
          {groups.map((g) => (
            <button
              key={g.name}
              data-chip={g.name}
              className={g.name === shown ? 'is-on' : ''}
              style={{ '--pack': g.color } as CSSProperties}
              onClick={() => jump(g.name)}
            >
              <i aria-hidden />
              {g.name}
            </button>
          ))}
        </div>
        <div ref={list} className="sticker-list__rows" onScroll={onScroll}>
          {groups.map((g) => (
            <section key={g.name} data-group={g.name}>
              <h3 className="sticker-list__group">{g.name}</h3>
              {g.packs.map(({ sheet, index }, n) => {
                const [first, ...rest] = sheet.slots.map((s) => getSticker(s.stickerId)).filter((s) => !!s);
                const on = index === current;
                return (
                  <button
                    key={sheet.id}
                    className={`sticker-list__row ${on ? 'is-on' : ''}`}
                    aria-label={`${sheet.label ?? sheet.name} ${n + 1}${on ? ', 사용 중' : ''}`}
                    aria-current={on || undefined}
                    onClick={() => onPick(index)}
                  >
                    <span className="sticker-list__thumb" style={{ '--pack': sheet.color } as CSSProperties} aria-hidden>
                      <b />
                      {first && <img src={first.src} alt="" />}
                    </span>
                    <span className="sticker-list__text" aria-hidden>
                      <span className="sticker-list__name">
                        {sheet.name}
                        <small>{n + 1}</small>
                      </span>
                      <span className="sticker-list__peek">
                        {rest.slice(0, 5).map((s, i) => (
                          <img key={i} src={s.src} alt="" />
                        ))}
                      </span>
                    </span>
                    <span className="sticker-list__count" aria-hidden>
                      {on ? '사용 중' : `${sheet.slots.length}장`}
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </dialog>
  );
}
