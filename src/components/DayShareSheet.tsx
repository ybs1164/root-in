import { Download, Link } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { downloadDataUrl, renderDayImage, type DayImageInput } from '../lib/dayImage';

interface DayShareSheetProps extends DayImageInput {
  date: string;
  onClose: () => void;
}

// Shown, not wired yet: sending to each service comes later.
const SNS_TARGETS = ['카카오톡', '인스타그램', 'X', '페이스북'];

/**
 * 📅 → 공유: the day's pings and lines as an image, in a centred popup
 * styled like a macOS window. One row of round buttons: 링크 복사 (which link
 * is still to be decided, so it's inert for now), 이미지 저장, then the SNS
 * targets (placeholders).
 */
export default function DayShareSheet({ date, onClose, ...image }: DayShareSheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    let alive = true;
    renderDayImage(image).then((url) => alive && setSrc(url));
    return () => {
      alive = false;
    };
    // Rendered once per opening: the sheet is modal, so the day can't change underneath.
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="mac-window day-share"
      aria-labelledby="day-share-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      {/* macOS-style title bar with just the red close light. */}
      <div className="mac-window__bar">
        <div className="mac-window__lights">
          <button className="mac-window__light mac-window__light--close" aria-label="닫기" onClick={onClose} />
        </div>
        <h2 id="day-share-title" className="mac-window__title">
          {image.title} 공유
        </h2>
      </div>

      <div className="mac-window__body">
        <div className="day-share__preview">
          {src ? <img src={src} alt={`${image.title}에 다녀온 곳을 잇는 그림`} /> : <span className="hint">이미지 만드는 중…</span>}
        </div>

        <div className="day-share__actions" role="group" aria-label="공유">
          {/* TODO: decide what 링크 복사 copies, then wire it up. */}
          <button className="day-share__action" disabled title="준비 중">
            <span className="day-share__action-dot" aria-hidden>
              <Link size={20} />
            </span>
            링크 복사
          </button>
          <button
            className="day-share__action"
            disabled={!src}
            onClick={() => src && downloadDataUrl(src, `root-in-${date}.png`)}
          >
            <span className="day-share__action-dot day-share__action-dot--primary" aria-hidden>
              <Download size={20} />
            </span>
            이미지 저장
          </button>
          {SNS_TARGETS.map((name) => (
            <button key={name} className="day-share__action" disabled title="준비 중">
              <span className="day-share__action-dot" aria-hidden>
                {name.slice(0, 1)}
              </span>
              {name}
            </button>
          ))}
        </div>
        <p className="hint hint--muted">링크 복사와 SNS 공유는 준비 중이에요.</p>
      </div>
    </dialog>
  );
}
