import { Download, Link, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { downloadDataUrl, renderDayImage, type DayImageInput } from '../lib/dayImage';
import { useBackdropTap } from '../hooks/useBackdropTap';

interface DayShareSheetProps extends DayImageInput {
  date: string;
  onClose: () => void;
}

/**
 * 📅 → 공유: the day's pings and lines as an image, in a centred popup
 * (no title bar or close button: a tap on the space around it closes it). One row of round, icon-only buttons (names
 * in aria-label): 링크 복사 (which link is still to be decided), 이미지 저장,
 * and SNS 공유 (not wired yet). The two unfinished ones are disabled.
 */
export default function DayShareSheet({ date, onClose, ...image }: DayShareSheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
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
      className="day-share ticket-dialog"
      aria-label={`${image.title} 공유`}
      onClose={onClose}
      onPointerDown={backdrop.onPointerDown}
      onPointerUp={backdrop.onPointerUp}
      onClick={(event) => {
        if (backdrop.isBackdropTap(event.target)) onClose();
      }}
    >
      <div className="ticket-dialog__main">
        <div className="day-share__preview">
          {src ? <img src={src} alt={`${image.title}에 다녀온 곳을 잇는 그림`} /> : <span className="hint">이미지 만드는 중…</span>}
        </div>
      </div>

      {/* Past the tear line: what to do with it. */}
      <div className="ticket-dialog__stub">
        <div className="day-share__actions" role="group" aria-label="공유">
          {/* TODO: decide what 링크 복사 copies, then wire it up. */}
          <button className="day-share__action" aria-label="링크 복사" disabled>
            <span className="day-share__action-dot" aria-hidden>
              <Link size={20} />
            </span>
          </button>
          <button
            className="day-share__action"
            aria-label="이미지 저장"
            disabled={!src}
            onClick={() => src && downloadDataUrl(src, `root-in-${date}.png`)}
          >
            <span className="day-share__action-dot day-share__action-dot--primary" aria-hidden>
              <Download size={20} />
            </span>
          </button>
          {/* TODO: one button for every SNS (likely the system share sheet); not wired yet. */}
          <button className="day-share__action" aria-label="SNS 공유" disabled>
            <span className="day-share__action-dot" aria-hidden>
              <Share2 size={20} />
            </span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
