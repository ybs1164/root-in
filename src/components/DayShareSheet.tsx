import { Download, Link, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { HOME_REQUIRED_MESSAGE, excludedNotice, homeIsSet, withoutExcluded } from '../domain/privacy';
import { downloadDataUrl, renderDayImage, type DayImageInput } from '../lib/dayImage';
import { loadPrivacy } from '../services/privacyRepository';

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
  const [src, setSrc] = useState<string | null>(null);
  // 제외 주소: pings near them are left out of the picture (pings carry only a position).
  const [privacy] = useState(() => {
    const { excluded } = loadPrivacy();
    const { kept, removed } = withoutExcluded(image.pings, (p) => ({ center: p.center }), excluded);
    return { blocked: !homeIsSet(excluded), pings: kept, removed };
  });

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (privacy.blocked) return;
    let alive = true;
    renderDayImage({ ...image, pings: privacy.pings }).then((url) => alive && setSrc(url));
    return () => {
      alive = false;
    };
    // Rendered once per opening: the sheet is modal, so the day can't change underneath.
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="mac-window day-share"
      aria-label={`${image.title} 공유`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="mac-window__body">
        <div className="day-share__preview">
          {privacy.blocked ? (
            <span className="hint share-sheet__blocked" role="alert">
              {HOME_REQUIRED_MESSAGE}
            </span>
          ) : src ? (
            <img src={src} alt={`${image.title}에 다녀온 곳을 잇는 그림`} />
          ) : (
            <span className="hint">이미지 만드는 중…</span>
          )}
        </div>

        {excludedNotice(privacy.removed) && <p className="hint day-share__notice">{excludedNotice(privacy.removed)}</p>}

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
