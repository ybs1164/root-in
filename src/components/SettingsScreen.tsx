import { Bell, ChevronLeft, ChevronRight, FileText, MapPinOff, Monitor, UserRound, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PING_ALERT_HOURS, SHARE_ALERT_COUNTS, shareCountLabel } from '../domain/profile';
import type { Account } from '../hooks/useAccount';
import type { ColorScheme, Profile } from '../services/profileRepository';
import { clearAppData } from '../services/settingsRepository';
import AlertBoard from './AlertBoard';
import PinGlyph from './PinGlyph';
import PrivacySection from './PrivacySection';

/** 알림 설정's two boards: 투데이 알림 by hour, 공유수 알림 by share count. */
const PING_STEPS = PING_ALERT_HOURS.map((hour) => ({ value: hour, text: `${hour}:00` }));
const SHARE_STEPS = SHARE_ALERT_COUNTS.map((count) => ({ value: count, text: shareCountLabel(count) }));

/** 디스플레이 및 언어 → 디스플레이's two choices. */
const SCHEMES: { id: ColorScheme; label: string }[] = [
  { id: 'light', label: '기본' },
  { id: 'dark', label: '다크' },
];

/** The scheme on screen: the one picked, or the phone's own until then. */
function shownScheme(picked: ColorScheme | null): ColorScheme {
  if (picked) return picked;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

type Page = 'main' | 'privacy' | 'alerts' | 'display' | 'account' | 'terms';

/** How long a detail screen takes to slide back out to the right (styles.css `settings-screen-out`). */
const PAGE_OUT_MS = 260;

const PAGES: { id: Exclude<Page, 'main'>; title: string; icon: ReactNode }[] = [
  { id: 'privacy', title: '제외 주소 설정', icon: <MapPinOff size={20} aria-hidden /> },
  { id: 'alerts', title: '알림 설정', icon: <Bell size={20} aria-hidden /> },
  { id: 'display', title: '디스플레이 및 언어', icon: <Monitor size={20} aria-hidden /> },
  { id: 'account', title: '계정 관리', icon: <UserRound size={20} aria-hidden /> },
  { id: 'terms', title: '약관 및 정책', icon: <FileText size={20} aria-hidden /> },
];

interface SettingsScreenProps {
  profile: Profile;
  onChange: (profile: Profile) => boolean;
  account?: Account;
  /** 제외 주소 설정 (PrivacySection's props), the same as on the profile. */
  privacy: Omit<Parameters<typeof PrivacySection>[0], 'notice'>;
  onClose: () => void;
}

/**
 * 설정, opened from the profile's ⚙: a full screen of its own over the
 * profile — 소리 as a switch, then a button for each of 제외 주소 설정 (also
 * still on the profile), 알림 설정, 디스플레이 및 언어, 계정 관리 and 약관 및 정책.
 * Each opens its own screen sliding in from the right over the list, and ‹
 * (or the phone's back, or Esc) slides it back out to the right; from the
 * list ‹ closes it and the profile under it.
 */
export default function SettingsScreen({ profile, onChange, account, privacy, onClose }: SettingsScreenProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [page, setPage] = useState<Page>('main');
  // The detail screen drawn over the list: it stays a moment after going back,
  // sliding out to the right (`leaving`), before it goes.
  const [shown, setShown] = useState<Exclude<Page, 'main'> | null>(null);
  const leaving = shown !== null && page === 'main';
  const leaveTimer = useRef(0);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => window.clearTimeout(leaveTimer.current);
  }, []);

  const go = (next: Page) => {
    window.clearTimeout(leaveTimer.current);
    setPage(next);
    if (next !== 'main') return setShown(next);
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    leaveTimer.current = window.setTimeout(() => setShown(null), still ? 0 : PAGE_OUT_MS);
  };
  const back = () => (page === 'main' ? dialogRef.current?.close() : go('main'));
  const current = PAGES.find((p) => p.id === page);
  const scheme = shownScheme(profile.scheme);

  const bodyOf = (page: Page): ReactNode => {
    let body: ReactNode;
    if (page === 'main') {
      body = (
        <ul className="settings__list">
          <li>
            <button className="settings__row" aria-pressed={!profile.sound} onClick={() => onChange({ ...profile, sound: !profile.sound })}>
              <span className={`settings__icon ${profile.sound ? '' : 'is-off'}`}>{profile.sound ? <Volume2 size={20} aria-hidden /> : <VolumeX size={20} aria-hidden />}</span>
              <span className="settings__label">소리</span>
              <span className={`settings__switch ${profile.sound ? 'is-on' : ''}`} aria-hidden />
            </button>
          </li>
          {PAGES.map((p) => (
            <li key={p.id}>
              <button className="settings__row" onClick={() => go(p.id)}>
                <span className="settings__icon">{p.icon}</span>
                <span className="settings__label">{p.title}</span>
                <ChevronRight size={20} className="settings__chevron" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      );
    } else if (page === 'privacy') {
      body = <PrivacySection {...privacy} />;
    } else if (page === 'alerts') {
      body = (
        <section className="privacy alerts" aria-label="알림 설정">
          <AlertBoard label="투데이 알림" steps={PING_STEPS} on={profile.pingAlerts} onChange={(pingAlerts) => onChange({ ...profile, pingAlerts })} />
          <AlertBoard
            label="공유수 알림"
            steps={SHARE_STEPS}
            on={profile.shareAlerts}
            random={false}
            onChange={(shareAlerts) => onChange({ ...profile, shareAlerts })}
          />
        </section>
      );
    } else if (page === 'display') {
      body = (
        <section className="privacy display" aria-label="디스플레이 및 언어">
          <h3 className="privacy__title">디스플레이</h3>
          <div className="display__schemes" role="group" aria-label="디스플레이">
            {SCHEMES.map(({ id, label }) => (
              <button key={id} className={`display__scheme ${scheme === id ? 'is-on' : ''}`} aria-pressed={scheme === id} onClick={() => onChange({ ...profile, scheme: id })}>
                {/* A small sample of that mode: its page colour, a pin and a bar in its accent. */}
                <span className={`display__swatch display__swatch--${id}`} aria-hidden>
                  <PinGlyph icon="pin" />
                  <i />
                </span>
                {label}
              </button>
            ))}
          </div>
          <div className="display__lang">
            <h3 className="privacy__title">언어</h3>
            <button className="display__lang-btn" aria-label="언어: 한국어">
              한국어
            </button>
          </div>
        </section>
      );
    } else if (page === 'terms') {
      // Room kept for 개인정보처리방침 and the like.
      body = <section className="terms" aria-label="약관 및 정책" />;
    } else {
      // 계정 관리: 로그인 (or 로그아웃) and 탈퇴.
      body = (
        <div className="settings__account">
          <div className="profile__actions">
            {/* A guest (We Now without Kakao) logs in to keep the same account. */}
            {account?.available && (!account.user || account.user.anonymous) ? (
              <button className="btn btn--secondary" disabled={account.busy} onClick={account.signIn}>
                카카오로 로그인
              </button>
            ) : (
              // Without an account (no Supabase keys) there's nothing to log out of.
              <button className="btn btn--secondary" disabled={!account?.user || account.busy} onClick={account?.signOut}>
                로그아웃
              </button>
            )}
            <button
              className="btn btn--ghost profile__leave"
              disabled={account?.busy}
              onClick={async () => {
                const signedIn = !!account?.user;
                const warning = signedIn
                  ? '탈퇴하면 계정과 이 기기의 프로필·핀·코스·기록이 모두 지워져요. 되돌릴 수 없어요.'
                  : '탈퇴하면 이 기기의 프로필·핀·코스·기록이 모두 지워져요. 되돌릴 수 없어요.';
                if (!window.confirm(warning)) return;
                // The account goes first: if that fails, this device keeps its data too.
                if (signedIn && !(await account.deleteAccount())) return;
                clearAppData();
                window.location.reload();
              }}
            >
              탈퇴
            </button>
          </div>
          {account?.user && (
            <p className="profile__account-note">
              {account.user.anonymous ? '로그인 없이 쓰는 중이에요. 카카오로 로그인하면 지금 계정에 이어져요.' : '카카오 계정으로 로그인했어요.'}
            </p>
          )}
          {account?.note && <p className="profile__note">{account.note}</p>}
        </div>
      );
    }
    return body;
  };
  const detail = PAGES.find((p) => p.id === shown);

  // In the body, not inside the profile's dialog (its mask and drop shadow would clip a full screen).
  return createPortal(
    <dialog
      ref={dialogRef}
      className="settings"
      aria-label={current?.title ?? '설정'}
      // React passes a dialog's close / cancel up through its component tree:
      // stop them here, or closing this would close the profile under it.
      onClose={(event) => {
        event.stopPropagation();
        onClose();
      }}
      // Taps here mustn't reach the profile under it (React bubbles them through the portal).
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onCancel={(event) => {
        event.stopPropagation();
        // Esc / the phone's back on a detail page goes back to the list instead.
        if (page !== 'main') {
          event.preventDefault();
          go('main');
        }
      }}
    >
      {/* The list stays underneath; a detail screen comes in over it. */}
      <div className="settings__screen" inert={shown !== null && !leaving}>
        <header className="settings__head">
          <button className="settings__back" aria-label="닫기" onClick={back}>
            <ChevronLeft size={26} strokeWidth={2.2} />
          </button>
          <h2>설정</h2>
        </header>
        <div className="settings__page">{bodyOf('main')}</div>
      </div>
      {detail && (
        <div key={detail.id} className={`settings__screen settings__screen--detail ${leaving ? 'is-leaving' : ''}`} inert={leaving}>
          <header className="settings__head">
            <button className="settings__back" aria-label="설정으로" onClick={back}>
              <ChevronLeft size={26} strokeWidth={2.2} />
            </button>
            <h2>{detail.title}</h2>
          </header>
          <div className="settings__page">{bodyOf(detail.id)}</div>
        </div>
      )}
    </dialog>,
    document.body,
  );
}
