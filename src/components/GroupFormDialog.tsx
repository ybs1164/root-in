import { useEffect, useRef, useState } from 'react';
import { GROUP_LIMITS } from '../domain/groups';
import { useBackdropTap } from '../hooks/useBackdropTap';
import { inviteUrl } from '../services/groupService';
import { newSlug } from '../services/shareLinkService';
import InviteLinkField from './InviteLinkField';
import CoverPicker from './CoverPicker';
import { showModalQuietly } from '../lib/dialog';

interface GroupFormDialogProps {
  /** Resolves false when it didn't go through (the dialog then stays open with a note). `photo`: a cover photo picked from the gallery. */
  onSubmit(name: string, cover: number, inviteSlug: string, photo: string | null): Promise<boolean>;
  onClose(): void;
}

/**
 * 새 그룹, a boarding pass like the other centre popups (`ticket-dialog`):
 * the name, the tile's cover (a pattern, or a photo from the gallery) and the invite link it will have (tap to copy
 * — it opens once the group is made), then 취소 | 만들기.
 */
export default function GroupFormDialog({ onSubmit, onClose }: GroupFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
  const [name, setName] = useState('');
  const [cover, setCover] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  // The group's invite slug, picked now so its link can be shown (and copied) before 만들기.
  const [slug] = useState(() => newSlug());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // No close() in cleanup: it would fire onClose during StrictMode's check (as ConfirmDialog).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog) showModalQuietly(dialog);
  }, []);

  const canSubmit = name.trim().length > 0 && !busy;
  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    const ok = await onSubmit(name.trim(), cover, slug, photo);
    setBusy(false);
    if (ok) dialogRef.current?.close();
    else setProblem('그룹을 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요.');
  };

  return (
    <dialog
      ref={dialogRef}
      className="group-form ticket-dialog"
      aria-label="새 그룹"
      onClose={(event) => {
        event.stopPropagation();
        onClose();
      }}
      onCancel={(event) => event.stopPropagation()}
      onPointerDown={backdrop.onPointerDown}
      onPointerUp={backdrop.onPointerUp}
      onClick={(event) => {
        event.stopPropagation();
        if (backdrop.isBackdropTap(event.target)) dialogRef.current?.close();
      }}
    >
      <div className="ticket-dialog__main group-form__main">
        <h3 className="group-form__title">새 그룹</h3>
        <label className="group-form__name">
          <input
            value={name}
            maxLength={GROUP_LIMITS.name}
            placeholder="그룹 이름"
            aria-label="그룹 이름"
            onChange={(e) => {
              setName(e.target.value);
              setProblem(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
          <small>
            {[...name].length}/{GROUP_LIMITS.name}
          </small>
        </label>
        <p className="group-form__label">COVER</p>
        <CoverPicker
          cover={cover}
          photo={photo}
          onChange={(c, p) => {
            setCover(c);
            setPhoto(p);
          }}
        />
        <p className="group-form__label">INVITE</p>
        <InviteLinkField url={inviteUrl(slug)} />
        {problem && <p className="group-form__hint">{problem}</p>}
      </div>
      <div className="ticket-dialog__stub ticket-dialog__split">
        <button onClick={() => dialogRef.current?.close()}>취소</button>
        <button className="is-action" disabled={!canSubmit} onClick={() => void submit()}>
          {busy ? '만드는 중…' : '만들기'}
        </button>
      </div>
    </dialog>
  );
}
