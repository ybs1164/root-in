import { ChevronDown, PenLine, Settings, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { handleProblem, PROFILE_LIMITS, sanitizeHandleInput } from '../domain/profile';
import { avatarFromFile } from '../lib/avatarImage';
import { getDisplayName, setDisplayName } from '../lib/currentUser';
import type { Profile } from '../services/profileRepository';
import type { Account } from '../hooks/useAccount';
import { useBackdropTap } from '../hooks/useBackdropTap';
import PrivacySection from './PrivacySection';
import SettingsScreen from './SettingsScreen';

interface ProfileSheetProps {
  profile: Profile;
  onChange: (profile: Profile) => boolean;
  /** The nickname was changed (it's saved on this device already). */
  onNickname?: (nickname: string) => void;
  /** 로그인 state; absent or unavailable, 로그아웃 stays disabled as before accounts. */
  account?: Account;
  /** 제외 주소 설정 (PrivacySection's props). */
  privacy: Omit<Parameters<typeof PrivacySection>[0], 'notice'>;
  /** Opened by 공유 before 집 was set: 제외 주소 설정 starts open, with this line in it. */
  privacyNotice?: string | null;
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
export default function ProfileSheet({ profile, onChange, onNickname, account, privacy, privacyNotice, onClose }: ProfileSheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [nickname, setNickname] = useState(getDisplayName);
  const [note, setNote] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(!!privacyNotice);
  // ⚙ (top right): 설정 as its own screen over the profile.
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  // 제외 주소 설정: places never shared, folded away like 로그아웃·탈퇴.
  const privacyPart = (
    <>
      <button
        className={`profile__account ${privacyOpen ? 'is-open' : ''}`}
        aria-expanded={privacyOpen}
        aria-controls="profile-privacy"
        onClick={() => setPrivacyOpen((open) => !open)}
      >
        제외 주소 설정
        <ChevronDown size={18} aria-hidden />
      </button>
      {privacyOpen && <PrivacySection {...privacy} notice={privacyNotice} />}
    </>
  );

  return (
    <dialog
      ref={dialogRef}
      className="profile-sheet ticket-dialog"
      aria-label="프로필"
      onClose={onClose}
      onPointerDown={backdrop.onPointerDown}
      onPointerUp={backdrop.onPointerUp}
      onClick={(event) => {
        if (backdrop.isBackdropTap(event.target)) onClose();
      }}
    >
      <div className="profile ticket-dialog__main">
        {/* Top right: ⚙ → 설정 (소리, 알림, 디스플레이 및 언어, 계정 관리, 약관 및 정책 moved there). */}
        <div className="profile__switches">
          <button className="profile__switch" aria-label="설정" onClick={() => setSettingsOpen(true)}>
            <Settings size={20} aria-hidden />
          </button>
        </div>
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
            onNickname?.(trimmed);
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

        {(note ?? account?.note) && <p className="profile__note">{note ?? account?.note}</p>}
      </div>

      {/* Past the tear line: 제외 주소 설정 (the rest of the settings are behind ⚙). */}
      <div className="ticket-dialog__stub profile__stub">{privacyPart}</div>
      {/* Leaving 설정 (‹ on its list, Esc, the phone's back) closes the profile too, back to where it was opened. */}
      {settingsOpen && (
        <SettingsScreen
          profile={profile}
          onChange={onChange}
          account={account}
          privacy={privacy}
          onClose={() => {
            setSettingsOpen(false);
            onClose();
          }}
        />
      )}
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
