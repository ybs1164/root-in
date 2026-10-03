import { PenLine, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { handleProblem, PROFILE_LIMITS, sanitizeHandleInput } from '../domain/profile';
import { avatarFromFile } from '../lib/avatarImage';
import { getDisplayName, setDisplayName } from '../lib/currentUser';
import type { Profile } from '../services/profileRepository';
import { clearAppData } from '../services/settingsRepository';

interface ProfileSheetProps {
  profile: Profile;
  onChange: (profile: Profile) => boolean;
  onClose: () => void;
}

/** The profile button's photo, or a person outline before one is set. */
export function ProfileAvatar({ photo, size }: { photo: string | null; size: number }) {
  return photo ? (
    <img className="profile-avatar" src={photo} alt="" width={size} height={size} />
  ) : (
    <UserRound size={Math.round(size * 0.6)} aria-hidden />
  );
}

/**
 * 프로필 팝업: centred, no close button — a tap on the empty space around it closes it.
 * Photo, nickname and @id each change in place behind their own small pen.
 */
export default function ProfileSheet({ profile, onChange, onClose }: ProfileSheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [nickname, setNickname] = useState(getDisplayName);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    const photo = await avatarFromFile(file);
    if (!photo) return setNote('사진을 불러오지 못했어요.');
    setNote(onChange({ ...profile, photo }) ? null : '사진이 너무 커서 저장하지 못했어요.');
  };

  return (
    <dialog
      ref={dialogRef}
      className="profile-sheet"
      aria-label="프로필"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="profile">
        <div className="profile__photo">
          <button className="profile__avatar" aria-label="프로필 사진 바꾸기" onClick={() => fileRef.current?.click()}>
            <ProfileAvatar photo={profile.photo} size={96} />
          </button>
          <button className="profile__photo-pen" aria-label="프로필 사진 바꾸기" onClick={() => fileRef.current?.click()}>
            <PenLine size={16} aria-hidden />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void pickPhoto(e.target.files?.[0]);
              e.target.value = ''; // picking the same photo again still fires
            }}
          />
        </div>

        <EditLine
          label="닉네임"
          value={nickname}
          maxLength={PROFILE_LIMITS.nickname}
          className="profile__nick"
          placeholder="닉네임"
          onCommit={(text) => {
            const trimmed = text.trim();
            setNickname(trimmed);
            setDisplayName(trimmed);
            return true;
          }}
        />

        <EditLine
          label="아이디"
          value={profile.handle}
          maxLength={PROFILE_LIMITS.handleMax}
          className="profile__handle"
          prefix="@"
          sanitize={sanitizeHandleInput}
          inputMode="url"
          hint="영문 소문자·숫자·. _ - 로 3~20자"
          refusal={(text) => (handleProblem(text) === 'too-short' ? '3자 이상이어야 해요' : '처음과 끝은 영문·숫자여야 해요')}
          onCommit={(text) => {
            if (handleProblem(text)) return false;
            if (text !== profile.handle) onChange({ ...profile, handle: text });
            return true;
          }}
        />

        {note && <p className="profile__note">{note}</p>}

        <div className="profile__actions">
          {/* No accounts yet (everything lives on this device), so there's nothing to log out of. */}
          <button className="btn btn--secondary" disabled>
            로그아웃
          </button>
          <button
            className="btn btn--ghost profile__leave"
            onClick={() => {
              if (!window.confirm('탈퇴하면 이 기기의 프로필·핀·코스·기록이 모두 지워져요. 되돌릴 수 없어요.')) return;
              clearAppData();
              window.location.reload();
            }}
          >
            탈퇴
          </button>
        </div>
      </div>
    </dialog>
  );
}

interface EditLineProps {
  label: string;
  value: string;
  maxLength: number;
  className: string;
  placeholder?: string;
  prefix?: ReactNode;
  sanitize?: (text: string) => string;
  inputMode?: 'text' | 'url';
  /** Shown under the field while editing. */
  hint?: string;
  /** Why a commit was refused, shown in red in the hint's place. */
  refusal?: (text: string) => string;
  /** False keeps the field open (Enter) or puts the old value back (tapping away). */
  onCommit: (text: string) => boolean;
}

/** A centred line of text with a small pen at its lower right: pen → edit; pen, Enter or tapping away → done. */
function EditLine({ label, value, maxLength, className, placeholder, prefix, sanitize, inputMode, hint, refusal, onCommit }: EditLineProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const editing = draft !== null;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const finish = (keepOpenIfRefused: boolean) => {
    if (draft === null) return;
    if (onCommit(draft)) {
      setDraft(null);
      setRefused(false);
    } else if (keepOpenIfRefused) {
      setRefused(true);
    } else {
      setDraft(null);
      setRefused(false);
    }
  };

  return (
    <div className={`profile__field ${className}`}>
      <div className="profile__line">
        <span />
        {editing ? (
          <span className="profile__edit">
            {prefix}
            <input
              ref={inputRef}
              value={draft}
              maxLength={maxLength}
              aria-label={label}
              inputMode={inputMode}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              onChange={(e) => {
                setDraft(sanitize ? sanitize(e.target.value) : e.target.value);
                setRefused(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  finish(true);
                }
              }}
              onBlur={() => finish(false)}
            />
          </span>
        ) : (
          <span className={`profile__text ${value ? '' : 'is-empty'}`}>
            {prefix}
            {value || placeholder}
          </span>
        )}
        <button
          className="profile__pen"
          aria-label={editing ? `${label} 저장` : `${label} 수정`}
          // Keep the field focused so this tap, not a blur, decides.
          onPointerDown={(e) => editing && e.preventDefault()}
          onClick={() => (editing ? finish(true) : setDraft(value))}
        >
          <PenLine size={13} aria-hidden />
        </button>
      </div>
      {editing && refused && refusal ? (
        <p className="profile__hint is-refused" role="alert">
          {refusal(draft)}
        </p>
      ) : (
        editing && hint && <p className="profile__hint">{hint}</p>
      )}
    </div>
  );
}
