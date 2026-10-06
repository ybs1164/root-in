import { ChevronDown, PenLine, UserRound, Volume2, VolumeX } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { handleProblem, PING_ALERT_HOURS, PROFILE_LIMITS, sanitizeHandleInput, togglePingAlert } from '../domain/profile';
import { avatarFromFile } from '../lib/avatarImage';
import { getDisplayName, setDisplayName } from '../lib/currentUser';
import type { Profile } from '../services/profileRepository';
import { clearAppData } from '../services/settingsRepository';
import { useBackdropTap } from '../hooks/useBackdropTap';
import PrivacySection from './PrivacySection';

interface ProfileSheetProps {
  profile: Profile;
  onChange: (profile: Profile) => boolean;
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
export default function ProfileSheet({ profile, onChange, privacy, privacyNotice, onClose }: ProfileSheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [nickname, setNickname] = useState(getDisplayName);
  const [note, setNote] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(!!privacyNotice);
  const [alertsOpen, setAlertsOpen] = useState(false);
  // 투데이 알림 cells mid-flip: the face each one flips from, keyed to restart on a quick second tap.
  const [flips, setFlips] = useState<Record<number, { from: boolean; key: number }>>({});

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
  // 알림 설정: which hours a ping reminder may come, each switched on its own.
  const alertsPart = (
    <>
      <button
        className={`profile__account ${alertsOpen ? 'is-open' : ''}`}
        aria-expanded={alertsOpen}
        aria-controls="profile-alerts"
        onClick={() => setAlertsOpen((open) => !open)}
      >
        알림 설정
        <ChevronDown size={18} aria-hidden />
      </button>
      {alertsOpen && (
        <section id="profile-alerts" className="privacy alerts" aria-label="알림 설정">
          <h3 className="privacy__title">알림 설정</h3>
          <p className="privacy__desc">특정 시간대의 알림을 켜거나 끌 수 있어요.</p>
          <div className="alerts__row" role="group" aria-label="투데이 알림">
            <span className="alerts__label">투데이 알림</span>
            <div className="alerts__hours">
              {PING_ALERT_HOURS.map((hour) => {
                const on = profile.pingAlerts.includes(hour);
                const flip = flips[hour];
                return (
                  <button
                    key={hour}
                    className={`alerts__hour ${on ? 'is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() => {
                      setFlips((all) => ({ ...all, [hour]: { from: on, key: (all[hour]?.key ?? 0) + 1 } }));
                      onChange({ ...profile, pingAlerts: togglePingAlert(profile.pingAlerts, hour) });
                    }}
                  >
                    {hour}시
                    {flip && (
                      // The split-flap turn: the top and bottom halves each spin on their own
                      // axis, old face out and new face in, both at once but turning opposite ways.
                      <span key={flip.key} className="alerts__flip" aria-hidden>
                        {(['top', 'bottom'] as const).flatMap((half) => [
                          <span key={`${half}-old`} className={`alerts__face alerts__face--${half} alerts__face--out ${flip.from ? 'is-on' : ''}`}>
                            {hour}시
                          </span>,
                          <span
                            key={`${half}-new`}
                            className={`alerts__face alerts__face--${half} alerts__face--in ${on ? 'is-on' : ''}`}
                            onAnimationEnd={
                              half === 'bottom'
                                ? () =>
                                    setFlips((all) => {
                                      if (all[hour]?.key !== flip.key) return all;
                                      const { [hour]: _done, ...rest } = all;
                                      return rest;
                                    })
                                : undefined
                            }
                          >
                            {hour}시
                          </span>,
                        ])}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </>
  );
  // 로그아웃·탈퇴: folded away by default so they aren't one stray tap from the profile.
  const accountPart = (
    <>
      <button
        className={`profile__account ${accountOpen ? 'is-open' : ''}`}
        aria-expanded={accountOpen}
        aria-controls="profile-account"
        onClick={() => setAccountOpen((open) => !open)}
      >
        로그아웃·탈퇴
        <ChevronDown size={18} aria-hidden />
      </button>
      {accountOpen && (
        <div id="profile-account" className="profile__actions">
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
      )}
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
        {/* Top right: 음소거, an icon that flips on / off. */}
        <div className="profile__switches">
          <button
            className={`profile__switch ${profile.sound ? '' : 'is-off'}`}
            aria-label="음소거"
            aria-pressed={!profile.sound}
            onClick={() => onChange({ ...profile, sound: !profile.sound })}
          >
            {profile.sound ? <Volume2 size={20} aria-hidden /> : <VolumeX size={20} aria-hidden />}
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
      </div>

      {/* Past the tear line: 제외 주소 설정, 알림 설정, then 로그아웃·탈퇴. A toggle
          that's open with another below it is torn off from it by a tear line of its own. */}
      {tornStubs([
        { part: privacyPart, open: privacyOpen },
        { part: alertsPart, open: alertsOpen },
        { part: accountPart, open: accountOpen },
      ])}
    </dialog>
  );
}

/** The stub's toggles, grouped so each open one (but the last) ends its stub with a tear line. */
function tornStubs(parts: { part: ReactNode; open: boolean }[]): ReactNode {
  const stubs: ReactNode[][] = [[]];
  parts.forEach(({ part, open }, i) => {
    stubs[stubs.length - 1].push(part);
    if (open && i < parts.length - 1) stubs.push([]);
  });
  return stubs.map((group, i) => (
    <div key={i} className={`ticket-dialog__stub ${i < stubs.length - 1 ? 'ticket-dialog__stub--mid' : ''} profile__stub`}>
      {group.map((part, j) => (
        <Fragment key={j}>{part}</Fragment>
      ))}
    </div>
  ));
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
