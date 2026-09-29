import { useEffect, useRef, useState } from 'react';
import { getDisplayName, setDisplayName } from '../lib/currentUser';
import { formatShareText, routeShareService, SHARE_LIMITS } from '../services/routeShareService';
import type { SharedRoute, TravelRoute } from '../types/travelRoute';

interface RouteShareDialogProps {
  route: TravelRoute;
  onClose: () => void;
}

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API is blocked on insecure origins / some embeds.
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  }
};

export default function RouteShareDialog({ route, onClose }: RouteShareDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [sharedBy, setSharedBy] = useState(getDisplayName);
  const [note, setNote] = useState(route.note ?? '');
  const [shareUrl, setShareUrl] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // Native <dialog> gives focus trapping, Esc-to-close and a backdrop for free.
  // No close() in cleanup: it would fire `onClose` during StrictMode's
  // mount→unmount→mount check; unmounting removes the dialog anyway.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  const buildShared = (): SharedRoute => ({
    origin: route.origin,
    destination: route.destination,
    title: route.title,
    note,
    sharedBy,
    sharedAt: new Date().toISOString(),
  });

  // Link is rebuilt live so what's shown is exactly what gets copied.
  useEffect(() => {
    let cancelled = false;
    routeShareService.createShareUrl(buildShared()).then((url) => {
      if (!cancelled) setShareUrl(url);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, note, sharedBy]);

  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(null), 2200);
    return () => clearTimeout(id);
  }, [feedback]);

  const rememberName = () => setDisplayName(sharedBy);

  const handleCopyLink = async () => {
    rememberName();
    setFeedback((await copyToClipboard(shareUrl)) ? '링크를 복사했습니다.' : '복사하지 못했습니다. 직접 선택해 복사하세요.');
  };

  const handleCopyText = async () => {
    rememberName();
    const text = formatShareText(buildShared(), shareUrl);
    setFeedback((await copyToClipboard(text)) ? '공유 문구를 복사했습니다.' : '복사하지 못했습니다.');
  };

  const handleNativeShare = async () => {
    rememberName();
    const shared = buildShared();
    try {
      await navigator.share({
        title: shared.title,
        text: `${shared.origin.name} → ${shared.destination.name}${shared.note ? `\n${shared.note}` : ''}`,
        url: shareUrl,
      });
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') {
        setFeedback('공유 창을 열지 못했습니다. 링크 복사를 이용하세요.');
      }
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="share-dialog"
      aria-labelledby="share-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        // Click on the backdrop (the dialog element itself) closes it.
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="share-dialog__body">
        <div className="share-dialog__head">
          <div>
            <p className="eyebrow">경로 공유</p>
            <h2 id="share-dialog-title">{route.title}</h2>
            <p className="share-route-line">
              <span className="route-dot route-dot--origin" />
              {route.origin.name}
              <span className="share-route-line__arrow">→</span>
              <span className="route-dot route-dot--destination" />
              {route.destination.name}
            </p>
          </div>
          <button className="icon-button icon-button--plain" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>

        <label className="share-field">
          <span>보내는 사람 (선택)</span>
          <input
            className="route-title-input"
            value={sharedBy}
            maxLength={SHARE_LIMITS.sharedBy}
            onChange={(e) => setSharedBy(e.target.value)}
            placeholder="받는 사람에게 보일 이름"
          />
        </label>

        <label className="share-field">
          <span>
            메모 (선택)
            <em>
              {note.length}/{SHARE_LIMITS.note}
            </em>
          </span>
          <textarea
            className="route-title-input share-note"
            value={note}
            maxLength={SHARE_LIMITS.note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 휴게소는 두 번째 들르는 게 좋아요"
            rows={3}
          />
        </label>

        <div className="share-field">
          <span>공유 링크</span>
          <div className="share-link">
            <input
              readOnly
              value={shareUrl}
              aria-label="공유 링크"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button className="primary" onClick={handleCopyLink} disabled={!shareUrl}>
              복사
            </button>
          </div>
        </div>

        <div className="actions">
          {canNativeShare ? (
            <button className="secondary" onClick={handleNativeShare} disabled={!shareUrl}>
              다른 앱으로 공유
            </button>
          ) : (
            <span />
          )}
          <button className="secondary" onClick={handleCopyText} disabled={!shareUrl}>
            문구로 복사
          </button>
        </div>

        <p className="muted-note share-privacy">
          경로 정보는 링크 안에만 담기며 서버로 전송되지 않습니다. 링크를 가진 사람은 누구나 볼 수 있어요.
        </p>

        <p className="share-feedback" role="status" aria-live="polite">
          {feedback}
        </p>
      </div>
    </dialog>
  );
}
