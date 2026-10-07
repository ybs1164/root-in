import { useEffect, useRef } from 'react';
import { useBackdropTap } from '../hooks/useBackdropTap';
import { ProfileAvatar } from './ProfileSheet';

interface SharedRouteDialogProps {
  /** The sharer's name (공유한 사람). */
  sender: string;
  /** The sharer's profile photo; null shows the person outline. */
  photo: string | null;
  /** How many times the route's link has been opened; unknown for a long #share= link (no line then). */
  shareCount?: number;
  /** 루트 추가: called before the dialog closes. */
  onAdd: () => void;
  /** Closed either way: after 루트 추가, 취소, Esc or a tap outside. */
  onClose: () => void;
}

/**
 * Opened by a shared route link, over whatever screen the app starts on: who
 * shared it, how often it's been shared, and 취소 | 루트 추가 on the stub.
 * The same boarding pass as the delete confirm (`ticket-dialog`), a native
 * modal <dialog> so it sits above every sheet.
 */
export default function SharedRouteDialog({ sender, photo, shareCount, onAdd, onClose }: SharedRouteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
  // No close() in cleanup: it would fire onClose during StrictMode's
  // mount→unmount→mount check; unmounting removes the dialog anyway.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="shared-route-dialog ticket-dialog"
      aria-label={`${sender}님의 루트`}
      onClose={onClose}
      onPointerDown={backdrop.onPointerDown}
      onPointerUp={backdrop.onPointerUp}
      onClick={(event) => {
        if (backdrop.isBackdropTap(event.target)) dialogRef.current?.close();
      }}
    >
      <div className="ticket-dialog__main">
        <span className="shared-route-dialog__avatar">
          <ProfileAvatar photo={photo} size={72} />
        </span>
        <p className="shared-route-dialog__who">
          <b>{sender}</b>님의 루트예요.
        </p>
        {shareCount !== undefined && shareCount > 0 && <p className="shared-route-dialog__count">지금까지 {shareCount}번 공유됐어요.</p>}
      </div>
      <div className="ticket-dialog__stub ticket-dialog__split">
        <button onClick={() => dialogRef.current?.close()}>취소</button>
        <button
          className="is-action"
          onClick={() => {
            onAdd();
            dialogRef.current?.close();
          }}
        >
          루트 추가
        </button>
      </div>
    </dialog>
  );
}
