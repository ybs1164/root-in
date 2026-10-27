import { useEffect, useRef, type CSSProperties } from 'react';
import { pinColorCss } from '../domain/pin';
import { useBackdropTap } from '../hooks/useBackdropTap';
import type { SharedPinCategory } from '../types/pin';
import PinGlyph from './PinGlyph';
import { ProfileAvatar } from './ProfileSheet';

interface SharedCategoryDialogProps {
  /** The sharer's name. */
  sender: string;
  /** The sharer's profile photo; null shows the person outline. */
  photo: string | null;
  category: SharedPinCategory;
  places: number;
  /** Already following this link: the button reads 확인 and only closes. */
  already: boolean;
  /** 구독: called before the dialog closes. */
  onSubscribe: () => void;
  /** Closed either way: after 구독, 취소, Esc or a tap outside. */
  onClose: () => void;
}

/**
 * Opened by a shared category link (#c=…): whose category it is, what's in
 * it, and 취소 | 구독 — the same boarding pass as a received route.
 */
export default function SharedCategoryDialog({ sender, photo, category, places, already, onSubscribe, onClose }: SharedCategoryDialogProps) {
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
      aria-label={`${sender}님의 카테고리`}
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
          <b>{sender}</b>님의 카테고리예요.
        </p>
        <p className="shared-category__name">
          <span className="pin-badge" style={{ '--pin': pinColorCss(category.color) } as CSSProperties} aria-hidden>
            <PinGlyph icon={category.icon} />
          </span>
          {category.name}
          <span className="shared-category__count">{places}곳</span>
        </p>
        <p className="shared-route-dialog__count">
          {already ? '이미 구독 중이에요. 최신 목록으로 맞췄어요.' : '구독하면 장소가 바뀔 때마다 내 지도에도 바로 반영돼요.'}
        </p>
      </div>
      <div className="ticket-dialog__stub ticket-dialog__split">
        <button onClick={() => dialogRef.current?.close()}>취소</button>
        <button
          className="is-action"
          onClick={() => {
            if (!already) onSubscribe();
            dialogRef.current?.close();
          }}
        >
          {already ? '확인' : '구독'}
        </button>
      </div>
    </dialog>
  );
}
