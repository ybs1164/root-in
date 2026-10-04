import { ChevronLeft, Download, Link, Share2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { SCENE } from '../domain/polaroid';
import { withCardTitle, type ShareSubject } from '../domain/shareSubject';
import { canShareImage, downloadDataUrl, renderShareImage, shareImage } from '../lib/shareImage';
import { loadDecor, saveDecor, type DecorStore } from '../services/decorRepository';
import DecorLayer, { type TextFocus } from './DecorLayer';
import { DecorRail, DecorTray } from './DecorTools';

/** How long the sheet takes to go down when switching tools (matches `tray-down` in styles.css). */
const TRAY_SWAP_MS = 170;

interface ShareStudioProps {
  subject: ShareSubject;
  /** The card's theme, which the app wears while this screen is up. */
  onTheme: (theme: ThemeId) => void;
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
 * Decorations are kept per card, so it opens again the way it was left.
 */
export default function ShareStudio({ subject, onTheme, onClose }: ShareStudioProps) {
  const { key } = subject;
  // The title is a text box like any other (it can be edited or thrown away);
  // a card gets it once, the first time it's opened.
  const [store, setStore] = useState<DecorStore>(() => {
    const loaded = loadDecor();
    return { ...loaded, [key]: withCardTitle(loaded[key] ?? EMPTY_DECOR, subject.title) };
  });
  const loaded = useRef(true);
  useEffect(() => {
    if (loaded.current) {
      loaded.current = false;
      return;
    }
    saveDecor(store);
  }, [store]);
  const decor = store[key] ?? EMPTY_DECOR;
  const setDecor = (next: DayDecor) => setStore((s) => ({ ...s, [key]: next }));

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
    renderShareImage({ ...subject, decor: { ...EMPTY_DECOR, pattern: decor.pattern }, withoutPieces: true }).then(
      (url) => alive && setBase(url),
    );
    return () => {
      alive = false;
    };
  }, [theme, decor.pattern]);

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
  useEffect(() => {
    if (!sheetTool || !trayTool) {
      setTrayTool(sheetTool);
      setTrayLeaving(false);
      return;
    }
    if (sheetTool === trayTool) return;
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

  const [busy, setBusy] = useState(false);
  const finished = () => renderShareImage({ ...subject, decor });
  const fileName = `${subject.fileName}.png`;
  const canShare = canShareImage();

  return (
    <div className={`studio ${tool ? 'is-tooling' : ''}`} role="dialog" aria-modal="true" aria-label={`${subject.title} 꾸미기`}>
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
      </div>

      {/* Where the tab buttons sit elsewhere: what to do with the finished card. */}
      <div className={`studio__actions ${tool ? 'is-away' : ''}`} role="group" aria-label="공유" inert={!!tool}>
        <button
          className="studio__action studio__action--primary"
          aria-label="사진 저장"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              downloadDataUrl(await finished(), fileName);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download size={22} aria-hidden />
        </button>
        {/* TODO: decide what 링크 복사 copies, then wire it up. */}
        <button className="studio__action" aria-label="링크 복사" disabled>
          <Link size={22} aria-hidden />
        </button>
        {/* One button for every SNS: the system share sheet, where there is one. */}
        <button
          className="studio__action"
          aria-label="SNS 공유"
          disabled={busy || !canShare}
          onClick={async () => {
            setBusy(true);
            try {
              await shareImage(await finished(), fileName, subject.title);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Share2 size={22} aria-hidden />
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
        />
      )}
    </div>
  );
}
