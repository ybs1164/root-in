import { Link, Send, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { copyToClipboard } from '../lib/clipboard';
import { getDisplayName, setDisplayName } from '../lib/currentUser';
import { SHARE_LIMITS } from '../services/routeShareService';
import { planShare, type ShareTarget } from '../services/shareTargets';

interface ShareSheetProps {
  target: ShareTarget;
  onClose: () => void;
}

/** The one share sheet for courses, days and pin sets (plan P5). */
export default function ShareSheet({ target, onClose }: ShareSheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [sharedBy, setSharedBy] = useState(getDisplayName);
  const [shareUrl, setShareUrl] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const plan = useMemo(() => planShare(target, sharedBy), [target, sharedBy]);

  // Native <dialog>: focus trap, Esc and backdrop for free. No close() in
  // cleanup — StrictMode's double mount would fire onClose immediately.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    plan.createUrl().then((url) => {
      if (!cancelled) setShareUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [plan]);

  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(null), 2200);
    return () => clearTimeout(id);
  }, [feedback]);

  const remember = () => setDisplayName(sharedBy);

  const handleNativeShare = async () => {
    remember();
    try {
      await navigator.share({ title: plan.title, text: plan.text('').trim(), url: shareUrl });
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') setFeedback('공유 창을 열지 못했어요. 링크 복사를 이용하세요.');
    }
  };

  const copy = async (text: string, done: string) => {
    remember();
    setFeedback((await copyToClipboard(text)) ? done : '복사하지 못했어요.');
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
          <h2 id="share-title">{plan.heading}</h2>
          <button className="icon-btn" aria-label="닫기" onClick={onClose}>
            <X size={22} aria-hidden />
          </button>
        </div>
        <p className="share-sheet__course">
          <strong>{plan.title}</strong>
          <span>{plan.summary}</span>
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
            <Send size={18} aria-hidden />
            카카오톡·메시지로 보내기
          </button>
        )}
        <div className="share-sheet__row">
          <button className="btn btn--secondary" disabled={!shareUrl} onClick={() => copy(shareUrl, '링크를 복사했어요.')}>
            <Link size={18} aria-hidden />
            링크 복사
          </button>
          <button className="btn btn--secondary" disabled={!shareUrl} onClick={() => copy(plan.text(shareUrl), '공유 문구를 복사했어요.')}>
            문구로 복사
          </button>
        </div>

        {plan.notice && <p className="hint">{plan.notice}</p>}
        <p className="hint hint--muted">정보는 링크 안에만 담기고 서버로 전송되지 않아요. 링크가 있으면 누구나 볼 수 있어요.</p>
        <p className="toast-inline" role="status" aria-live="polite">
          {feedback}
        </p>
      </div>
    </dialog>
  );
}
