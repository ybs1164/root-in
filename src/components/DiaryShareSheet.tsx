import { Link, Send, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultDiaryTitle, formatDiaryDate } from '../domain/diary';
import { copyToClipboard } from '../lib/clipboard';
import { getDisplayName } from '../lib/currentUser';
import { diaryShareService, encodeSharedDiary, formatDiaryShareText } from '../services/diaryShareService';
import type { DiaryDraft, SharedDiary } from '../types/diary';

interface DiaryShareSheetProps {
  draft: DiaryDraft;
  onClose: () => void;
}

export default function DiaryShareSheet({ draft, onClose }: DiaryShareSheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const shared = useMemo<SharedDiary>(
    () => ({
      date: draft.date,
      title: draft.title.trim() || defaultDiaryTitle(draft),
      travelMode: draft.travelMode,
      stops: draft.stops,
      // The name set once in course sharing, if any; no extra field here.
      sharedBy: getDisplayName() || undefined,
      sharedAt: new Date().toISOString(),
    }),
    [draft],
  );
  const memosTrimmed = useMemo(() => encodeSharedDiary(shared).trimmed !== 'none', [shared]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    diaryShareService.createShareUrl(shared).then((url) => {
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

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: shared.title, text: formatDiaryShareText(shared, '').trim(), url: shareUrl });
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') setFeedback('링크 복사를 이용하세요.');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="share-sheet"
      aria-label={`${formatDiaryDate(shared.date)} 공유`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="share-sheet__body">
        <div className="sheet-grip" aria-hidden />
        <div className="share-sheet__head">
          <h2>{formatDiaryDate(shared.date)}</h2>
          <button className="icon-btn" aria-label="닫기" onClick={onClose}>
            <X size={22} aria-hidden />
          </button>
        </div>
        <div className={canNativeShare ? 'share-sheet__row' : ''}>
          {canNativeShare && (
            <button className="btn btn--primary" onClick={handleNativeShare} disabled={!shareUrl}>
              <Send size={18} aria-hidden />
              보내기
            </button>
          )}
          <button
            className={`btn ${canNativeShare ? 'btn--secondary' : 'btn--primary btn--block'}`}
            disabled={!shareUrl}
            onClick={async () => setFeedback((await copyToClipboard(shareUrl)) ? '복사했어요.' : '복사하지 못했어요.')}
          >
            <Link size={18} aria-hidden />
            링크 복사
          </button>
        </div>
        {memosTrimmed && <p className="hint">링크가 길어 메모는 빠졌어요.</p>}
        <p className="toast-inline" role="status" aria-live="polite">
          {feedback}
        </p>
      </div>
    </dialog>
  );
}
