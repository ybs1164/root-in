import { ChevronLeft, Download, Link, Share2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  canUndo,
  cleanTextStyle,
  DEFAULT_PEN,
  DEFAULT_TEXT_STYLE,
  EMPTY_DECOR,
  EMPTY_HISTORY,
  recordChange,
  redoDecor,
  undoDecor,
  type DayDecor,
  type DecorHistory,
  type DecorTool,
  type PenSettings,
  type TextStyle,
  type ThemeId,
} from '../domain/decor';
import { DEFAULT_LAYOUT, POLAROID_LAYOUTS, SCENE, type PolaroidLayout } from '../domain/polaroid';
import type { ShareSubject } from '../domain/shareSubject';
import type { ShareMethod } from '../services/analytics';
import { canShareImage, dayGround, downloadDataUrl, renderShareImage, shareImage } from '../lib/shareImage';
import DayPattern from './DayPattern';
import DecorLayer, { type TextFocus } from './DecorLayer';
import { DecorRail, DecorTray } from './DecorTools';

/** How long the sheet takes to go down when switching tools (matches `tray-down` in styles.css). */
const TRAY_SWAP_MS = 170;

interface ShareStudioProps {
  subject: ShareSubject;
  /** The card's theme, which the app wears while this screen is up. */
  onTheme: (theme: ThemeId) => void;
  /** 링크 복사 (a route's card): makes the link and copies it; false when that failed. Absent: the button stays off. */
  onCopyLink?: () => Promise<boolean>;
  /** After each of 사진 저장 · SNS 공유 · 링크 복사, whether it went through (for the 공유 funnel). */
  onShared?: (method: ShareMethod, ok: boolean) => void;
  onClose: () => void;
}

/**
 * 꾸미기: a screen of its own for a share card (a calendar day's, or a saved
 * route's). The scene (two polaroids on a backdrop) is drawn once as an
 * image, and the stickers, pen, text, theme and background pattern are laid
 * over all of it here, a little past the cards too (a day's photo is its
 * day screen as it looks there, with its own theme, pattern and pieces;
 * what's chosen here is apart from it); the bottom row
 * saves the finished card, copies its link or hands it to an SNS app.
 * Nothing here is kept: each visit starts from a fresh, blank card (default
 * layout, no title written on it), and leaving throws the decorations away. A day's own
 * 꾸미기 on its day screen is kept as ever and shows in the photo.
 */
export default function ShareStudio({ subject, onTheme, onCopyLink, onShared, onClose }: ShareStudioProps) {
  const [decor, setDecor] = useState<DayDecor>(EMPTY_DECOR);

  // Undo / redo, for this visit only.
  const [history, setHistory] = useState<DecorHistory>(EMPTY_HISTORY);
  const changeDecor = (next: DayDecor) => {
    setHistory((h) => recordChange(h, decor));
    setDecor(next);
  };
  const step = (result: { history: DecorHistory; decor: DayDecor } | null) => {
    if (!result) return;
    setHistory(result.history);
    setDecor(result.decor);
  };

  const [tool, setTool] = useState<DecorTool | null>(null);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const [armed, setArmed] = useState<string | null>(null);
  const [pen, setPen] = useState<PenSettings>(DEFAULT_PEN);
  // Text tool: the box picked or being typed in, and how the next new box looks.
  const [textFocus, setTextFocus] = useState<TextFocus>(null);
  const [textStyle, setTextStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  // A sticker or text box is being dragged: the tool sheet steps aside for the trash.
  const [draggingPiece, setDraggingPiece] = useState(false);

  // The page wears the card's theme while this screen is up (the image
  // reads its colours from it). Put on here before the card is drawn, rather
  // than waiting for the app's own pass; the app is told too, for the
  // browser bars, and puts back the screen underneath's theme on closing.
  const theme = decor.theme ?? 'default';
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (theme === 'default') delete root.dataset.theme;
    else root.dataset.theme = theme;
    onTheme(theme);
  }, [theme]);

  // The card without its pieces (those are laid over it live), drawn again
  // when its theme or pattern changes.
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    renderShareImage({ ...subject, decor: { ...EMPTY_DECOR, layout: decor.layout }, withoutPieces: true, withoutGround: true }).then(
      (url) => alive && setBase(url),
    );
    return () => {
      alive = false;
    };
  }, [theme, decor.layout]);

  // The 폴라로이드 sheet's cards: this card drawn small in every layout (with
  // its theme and pattern, without pieces), once the sheet is opened.
  const [layoutPreviews, setLayoutPreviews] = useState<Partial<Record<PolaroidLayout, string>>>({});
  const wantsPreviews = tool === 'polaroid';
  useEffect(() => {
    if (!wantsPreviews) return;
    let alive = true;
    setLayoutPreviews({});
    (async () => {
      for (const { id } of POLAROID_LAYOUTS) {
        const url = await renderShareImage({ ...subject, decor: { ...EMPTY_DECOR, pattern: decor.pattern, layout: id }, withoutPieces: true, scale: 0.12 });
        if (!alive) return;
        setLayoutPreviews((prev) => ({ ...prev, [id]: url }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [wantsPreviews, theme, decor.pattern]);

  // The text tool's toolbar is for a written box that's been picked: it
  // stays down while nothing is picked, and while typing (the keyboard is up).
  const pickedText = textFocus && !textFocus.editing ? (decor.texts ?? []).find((t) => t.id === textFocus.id) : undefined;
  const sheetTool = tool === 'text' && !pickedText ? null : tool;
  const sheetTextStyle: TextStyle = pickedText ?? textStyle;
  const changeTextStyle = (patch: Partial<TextStyle>) => {
    const next = cleanTextStyle({ ...sheetTextStyle, ...patch });
    setTextStyle(next);
    if (pickedText) {
      const { id } = pickedText;
      const texts = (decor.texts ?? []).map((t) => {
        if (t.id !== id) return t;
        const { bold: _b, italic: _i, underline: _u, strike: _s, ...rest } = t;
        return { ...rest, ...next };
      });
      changeDecor({ ...decor, texts });
    }
  };

  // The sheet shows `trayTool`, which trails `tool`: switching tools sends the
  // open sheet down first, then the new one comes up.
  const [trayTool, setTrayTool] = useState<DecorTool | null>(null);
  const [trayLeaving, setTrayLeaving] = useState(false);
  // Putting a tool away (its button again, or a touch outside) sends the sheet
  // down too, and the buttons below only come back once it's gone. A sheet
  // pulled down by its edge has already slid away itself: it just goes.
  const trayPulledAway = useRef(false);
  useEffect(() => {
    if (!trayTool) {
      setTrayTool(sheetTool);
      setTrayLeaving(false);
      return;
    }
    if (sheetTool === trayTool) {
      setTrayLeaving(false);
      return;
    }
    if (!sheetTool && trayPulledAway.current) {
      trayPulledAway.current = false;
      setTrayTool(null);
      setTrayLeaving(false);
      return;
    }
    setTrayLeaving(true);
    const swap = window.setTimeout(() => {
      setTrayTool(sheetTool);
      setTrayLeaving(false);
    }, TRAY_SWAP_MS);
    return () => window.clearTimeout(swap);
  }, [sheetTool]);

  // Touching anywhere but the card's drawing or the tools puts the tool
  // away, and the share buttons come back.
  useEffect(() => {
    if (!tool) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest('.decor, .decor-tray, .decor-rail, .color-picker')) return;
      setTool(null);
      // That touch only closes: its click shouldn't also press what's under it. Dropped if no click follows.
      const swallow = (c: MouseEvent) => {
        c.stopPropagation();
        c.preventDefault();
      };
      document.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 500);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [tool]);

  // Esc goes back (unless a tool is out: then it's the tool's).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !toolRef.current) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dayOver = useMemo(
    () => ((decor.layout ?? DEFAULT_LAYOUT) === 'bare' && subject.photo ? dayGround(subject.photo) : null),
    [decor.layout, subject.photo],
  );

  const [busy, setBusy] = useState(false);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const finished = () => renderShareImage({ ...subject, decor });
  const fileName = `${subject.fileName}.png`;
  const canShare = canShareImage();

  return (
    <div className={`studio ${tool ? 'is-tooling' : ''}`} role="dialog" aria-modal="true" aria-label={`${subject.title} 꾸미기`}>
      {/* The ground (theme colour and pattern) runs under the whole screen;
          the shared area is only outlined. The saved image paints the same ground. */}
      {/* 없음 on a day's card: the day's own ground (colour, pattern) covers this
          card's, which stays chosen for the other layouts. */}
      {dayOver ? (
        <div className="studio__day-ground" style={{ background: dayOver.page }}>
          <DayPattern pattern={subject.photo?.pattern ?? 'none'} accent={dayOver.accent} />
        </div>
      ) : (
        <DayPattern pattern={decor.pattern ?? 'none'} />
      )}
      <button className="studio__back" aria-label="닫기" onClick={onClose}>
        <ChevronLeft size={26} strokeWidth={2.2} aria-hidden />
      </button>

      <DecorRail
        row
        tool={tool}
        onTool={(next) => {
          setTool(next);
          setArmed(null);
          setTextFocus(null);
        }}
      />

      <div className="studio__stage">
        <div className="studio__card" style={{ aspectRatio: `${SCENE.w} / ${SCENE.h}` }}>
          {base ? (
            <img className="studio__image" src={base} alt={`${subject.title} 카드`} draggable={false} />
          ) : (
            <span className="studio__loading hint">카드 만드는 중…</span>
          )}
          <div className="studio__box">
            <DecorLayer
              aspect={SCENE.h / SCENE.w}
              decor={decor}
              tool={tool}
              armed={armed}
              pen={pen}
              onChange={changeDecor}
              textFocus={textFocus}
              onTextFocus={setTextFocus}
              textStyle={textStyle}
              onDragging={setDraggingPiece}
            />
          </div>
        </div>
        {subject.removed > 0 && <p className="studio__note">제외 주소에 있는 {subject.removed}곳은 빠졌어요.</p>}
        {linkNote && (
          <p className="studio__note" role="status">
            {linkNote}
          </p>
        )}
      </div>

      {/* Where the tab buttons sit elsewhere: what to do with the finished card. */}
      {/* The share buttons come back once the tool's sheet has gone down. */}
      <div className={`studio__actions ${tool || trayTool ? 'is-away' : ''}`} role="group" aria-label="공유" inert={!!(tool || trayTool)}>
        <button
          className="studio__action"
          aria-label="사진 저장"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              downloadDataUrl(await finished(), fileName);
              onShared?.('save_image', true);
            } catch {
              onShared?.('save_image', false);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download size={22} aria-hidden />
        </button>
        {/* The big one in the middle: the system share sheet, where there is one (one button for every SNS). */}
        <button
          className="studio__action studio__action--primary"
          aria-label="SNS 공유"
          disabled={busy || !canShare}
          onClick={async () => {
            setBusy(true);
            try {
              onShared?.('system_share', await shareImage(await finished(), fileName, subject.title));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Share2 size={30} aria-hidden />
        </button>
        {/* A route's link (short, with a share count, when signed in); a day has no link yet (docs/todo.md). */}
        <button
          className="studio__action"
          aria-label="링크 복사"
          disabled={busy || !onCopyLink}
          onClick={async () => {
            if (!onCopyLink) return;
            setBusy(true);
            try {
              const ok = await onCopyLink();
              onShared?.('copy_link', ok);
              setLinkNote(ok ? '링크를 복사했어요.' : '링크를 복사하지 못했어요.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <Link size={22} aria-hidden />
        </button>
      </div>

      {trayTool && (
        <DecorTray
          key={trayTool}
          leaving={trayLeaving}
          away={draggingPiece}
          tool={trayTool}
          armed={armed}
          onArm={setArmed}
          pen={pen}
          onPen={setPen}
          canUndo={canUndo(history, decor)}
          onUndo={() => step(undoDecor(history, decor))}
          canRedo={history.future.length > 0}
          onRedo={() => step(redoDecor(history, decor))}
          canClear={decor.strokes.length > 0}
          onClear={() => changeDecor({ ...decor, strokes: [] })}
          theme={theme}
          onTheme={(next) => setDecor({ ...decor, theme: next === 'default' ? undefined : next })}
          pattern={decor.pattern ?? 'none'}
          onPattern={(next) => setDecor({ ...decor, pattern: next === 'none' ? undefined : next })}
          textStyle={sheetTextStyle}
          onTextStyle={changeTextStyle}
          onClose={() => {
            trayPulledAway.current = true;
            setTool(null);
          }}
          layout={decor.layout ?? DEFAULT_LAYOUT}
          onLayout={(next) => next !== (decor.layout ?? DEFAULT_LAYOUT) && changeDecor({ ...decor, layout: next })}
          layoutPreviews={layoutPreviews}
        />
      )}
    </div>
  );
}
