import { useEffect, useMemo, useRef, useState } from 'react';
import { copyToClipboard } from '../lib/clipboard';
import { getDisplayName, setDisplayName } from '../lib/currentUser';
import { courseShareService, encodeSharedCourse, formatCourseShareText } from '../services/courseShareService';
import { SHARE_LIMITS } from '../services/routeShareService';
import type { CourseDraft, SharedCourse } from '../types/course';
import { defaultTitle } from '../domain/course';

interface ShareSheetProps {
  draft: CourseDraft;
  onClose: () => void;
}

export default function ShareSheet({ draft, onClose }: ShareSheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [sharedBy, setSharedBy] = useState(getDisplayName);
  const [shareUrl, setShareUrl] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const shared = useMemo<SharedCourse>(
    () => ({
      title: draft.title.trim() || defaultTitle(draft.stops),
      theme: draft.theme,
      travelMode: draft.travelMode,
      stops: draft.stops,
      note: draft.note,
      sharedBy,
      sharedAt: new Date().toISOString(),
    }),
    [draft, sharedBy],
  );
  const memosTrimmed = useMemo(() => encodeSharedCourse(shared).memosTrimmed, [shared]);

  // Native <dialog>: focus trap, Esc and backdrop for free. No close() in
  // cleanup — StrictMode's double mount would fire onClose immediately.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    courseShareService.createShareUrl(shared).then((url) => {
      if (!cancelled) setShareUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [shared]);

  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(null), 2200);
    return () => clearTimeout(id);
  }, [feedback]);

  const remember = () => setDisplayName(sharedBy);

  const handleNativeShare = async () => {
    remember();
    try {
      await navigator.share({ title: shared.title, text: formatCourseShareText(shared, '').trim(), url: shareUrl });
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') setFeedback('공유 창을 열지 못했어요. 링크 복사를 이용하세요.');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="share-sheet"
      aria-labelledby="share-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="share-sheet__body">
        <div className="sheet-grip" aria-hidden />
        <div className="share-sheet__head">
          <h2 id="share-title">코스 공유</h2>
          <button className="icon-btn" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="share-sheet__course">
          <strong>{shared.title}</strong>
          <span>{shared.stops.map((s, i) => `${i + 1}. ${s.place.name}`).join('  ')}</span>
        </p>

        <label className="field">
          <span>보내는 사람 (선택)</span>
          <input
            value={sharedBy}
            maxLength={SHARE_LIMITS.sharedBy}
            placeholder="받는 사람에게 보일 이름"
            onChange={(e) => setSharedBy(e.target.value)}
          />
        </label>

        {canNativeShare && (
          <button className="btn btn--primary btn--block" onClick={handleNativeShare} disabled={!shareUrl}>
            카카오톡·메시지로 보내기
          </button>
        )}
        <div className="share-sheet__row">
          <button
            className="btn btn--secondary"
            disabled={!shareUrl}
            onClick={async () => {
              remember();
              setFeedback((await copyToClipboard(shareUrl)) ? '링크를 복사했어요.' : '복사하지 못했어요.');
            }}
          >
            링크 복사
          </button>
          <button
            className="btn btn--secondary"
            disabled={!shareUrl}
            onClick={async () => {
              remember();
              const ok = await copyToClipboard(formatCourseShareText(shared, shareUrl));
              setFeedback(ok ? '공유 문구를 복사했어요.' : '복사하지 못했어요.');
            }}
          >
            문구로 복사
          </button>
        </div>

        {memosTrimmed && <p className="hint">링크가 너무 길어 장소별 메모는 빠졌어요.</p>}
        <p className="hint hint--muted">코스 정보는 링크 안에만 담기고 서버로 전송되지 않아요. 링크가 있으면 누구나 볼 수 있어요.</p>
        <p className="toast-inline" role="status" aria-live="polite">
          {feedback}
        </p>
      </div>
    </dialog>
  );
}
