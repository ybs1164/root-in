import { Bell, ChevronLeft, ChevronRight, FileText, Link, LocateFixed, MapPinOff, Monitor, UserRound, Volume2, VolumeX } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PING_ALERT_HOURS, SHARE_ALERT_COUNTS, shareCountLabel } from '../domain/profile';
import type { Account } from '../hooks/useAccount';
import type { ColorScheme, Profile } from '../services/profileRepository';
import { clearAppData } from '../services/settingsRepository';
import { SWIPE, swipeCommits } from '../domain/appTabs';
import { ADMIN_ATTRIBUTION } from '../map/courseMap';
import AlertBoard from './AlertBoard';
import Logo from './Logo';
import PrivacySection from './PrivacySection';
import LocationSection from './LocationSection';
import AppLinksSection from './AppLinksSection';
import type { MyLocationControl } from '../hooks/useMyLocation';

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

type Page = 'main' | 'location' | 'links' | 'privacy' | 'alerts' | 'display' | 'account' | 'terms';

/** How long a screen takes to slide off to the right, going back (as long as it took coming in, styles.css `settings-in`). */
const PAGE_OUT_MS = 260;
/** A swipe let go too soon: the screen goes back into place. */
const SPRING_BACK_MS = 180;

const stillMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// The same curve the screens come in on.
const slideEase = () => getComputedStyle(document.documentElement).getPropertyValue('--slide-ease').trim() || 'ease-out';

/** Slides `el` from `fromPx` off to the right, then `done`. */
function slideOff(el: HTMLElement, fromPx: number, done: () => void) {
  el.style.translate = '';
  el.animate([{ translate: `${fromPx}px 0` }, { translate: '100% 0' }], { duration: stillMotion() ? 0 : PAGE_OUT_MS, easing: slideEase(), fill: 'forwards' }).finished.then(done, done);
}

const PAGES: { id: Exclude<Page, 'main'>; title: string; icon: ReactNode }[] = [
  { id: 'location', title: '위치 설정', icon: <LocateFixed size={20} aria-hidden /> },
  { id: 'links', title: '초대 링크 연결', icon: <Link size={20} aria-hidden /> },
  { id: 'privacy', title: '제외 주소 설정', icon: <MapPinOff size={20} aria-hidden /> },
  { id: 'alerts', title: '알림 설정', icon: <Bell size={20} aria-hidden /> },
  { id: 'display', title: '디스플레이 및 언어', icon: <Monitor size={20} aria-hidden /> },
  { id: 'account', title: '계정 관리', icon: <UserRound size={20} aria-hidden /> },
  { id: 'terms', title: '약관 및 정책', icon: <FileText size={20} aria-hidden /> },
];

interface SettingsScreenProps {
  location: MyLocationControl;
  profile: Profile;
  onChange: (profile: Profile) => boolean;
  account?: Account;
  /** 제외 주소 설정 (PrivacySection's props), the same as on the profile. */
  privacy: Omit<Parameters<typeof PrivacySection>[0], 'notice'>;
  /** 설정 has slid in and covers the whole screen (the profile under it can go now). */
  onCovered?: () => void;
  onClose: () => void;
}

/**
 * 설정, opened from the profile's ⚙: a full screen of its own over the
 * profile — 소리 as a switch, then a button for each of 제외 주소 설정 (also
 * still on the profile), 알림 설정, 디스플레이 및 언어, 계정 관리 and 약관 및 정책.
 * Each opens its own screen sliding in from the right over the list, and ‹
 * (or the phone's back, or Esc) slides it back out to the right; from the
 * list the same slides 설정 itself off to the right, closed. A left-to-right
 * swipe does the same, the screen following the finger.
 */
export default function SettingsScreen({ profile, onChange, account, privacy, location, onCovered, onClose }: SettingsScreenProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [page, setPage] = useState<Page>('main');
  // The detail screen drawn over the list: it stays while it slides back out
  // to the right (`leaving`), then goes.
  const [shown, setShown] = useState<Exclude<Page, 'main'> | null>(null);
  const leaving = shown !== null && page === 'main';
  const detailRef = useRef<HTMLDivElement | null>(null);
  const closing = useRef(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    // Without the slide-in there's nothing to wait for.
    if (stillMotion()) onCovered?.();
  }, []);

  const open = (next: Exclude<Page, 'main'>) => {
    setPage(next);
    setShown(next);
  };
  // Going back, the screen on top slides off to the right from wherever it is
  // (`fromPx`: where a swipe let go of it): a detail page uncovers the list,
  // the list closes 설정.
  const leaveDetail = (fromPx = 0) => {
    const id = shown;
    setPage('main');
    const el = detailRef.current;
    if (!el) return setShown(null);
    slideOff(el, fromPx, () => setShown((s) => (s === id ? null : s)));
  };
  const close = (fromPx = 0) => {
    const dialog = dialogRef.current;
    if (!dialog || closing.current) return;
    closing.current = true;
    slideOff(dialog, fromPx, () => dialog.close());
  };
  const back = (fromPx = 0) => (page === 'main' ? close(fromPx) : leaveDetail(fromPx));

  // A left-to-right swipe anywhere: the top screen follows the finger, and let
  // go far or fast enough it goes back (as ‹), otherwise it springs back.
  const swipe = useRef<{ id: number; x: number; y: number; dx: number; v: number; at: number; el: HTMLElement | null } | null>(null);
  const swallowClick = useRef(false);
  const swipeStart = (e: ReactPointerEvent) => {
    if (!e.isPrimary || closing.current) return;
    swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, v: 0, at: performance.now(), el: null };
  };
  const swipeMove = (e: ReactPointerEvent) => {
    const sw = swipe.current;
    if (!sw || sw.id !== e.pointerId) return;
    const [dx, dy] = [e.clientX - sw.x, e.clientY - sw.y];
    if (!sw.el) {
      // A scroll (or a move left) isn't a swipe.
      if (Math.abs(dy) > SWIPE.startPx && Math.abs(dy) >= Math.abs(dx)) swipe.current = null;
      if (dx < SWIPE.startPx || Math.abs(dx) < Math.abs(dy)) return;
      sw.el = (page !== 'main' && detailRef.current) || dialogRef.current;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Not a live pointer: moves still come while over the screen.
      }
    }
    const now = performance.now();
    const next = Math.max(0, dx);
    sw.v = (next - sw.dx) / Math.max(1, now - sw.at);
    sw.dx = next;
    sw.at = now;
    if (sw.el) sw.el.style.translate = `${next}px 0`;
  };
  const swipeEnd = () => {
    const sw = swipe.current;
    swipe.current = null;
    if (!sw?.el) return;
    swallowClick.current = true;
    const el = sw.el;
    el.style.translate = '';
    if (swipeCommits(1, sw.dx, el.getBoundingClientRect().width || window.innerWidth, sw.v)) return back(sw.dx);
    el.animate([{ translate: `${sw.dx}px 0` }, { translate: '0px 0' }], { duration: stillMotion() ? 0 : SPRING_BACK_MS, easing: slideEase() });
  };
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
          {PAGES.filter((p) => p.id !== 'links' || Capacitor.getPlatform() === 'android').map((p) => (
            <li key={p.id}>
              <button className="settings__row" onClick={() => open(p.id)}>
                <span className="settings__icon">{p.icon}</span>
                <span className="settings__label">{p.title}</span>
                <ChevronRight size={20} className="settings__chevron" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      );
    } else if (page === 'location') {
      body = <LocationSection location={location} />;
    } else if (page === 'links') {
      body = <AppLinksSection />;
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
                {/* That mode's app icon (tile + mark) in its own logo colours. */}
                <span className={`display__swatch display__swatch--${id}`} aria-hidden>
                  <Logo />
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
      // Room kept for 개인정보처리방침 and the like. The map's data credit
      // lives here since the map itself no longer shows one.
      body = (
        <section className="terms" aria-label="약관 및 정책">
          <h3 className="privacy__title">지도 출처</h3>
          <p className="terms__credit">{ADMIN_ATTRIBUTION}</p>
        </section>
      );
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

  // In the body, a full screen over the whole app.
  return createPortal(
    <dialog
      ref={dialogRef}
      className="settings"
      aria-label={current?.title ?? '설정'}
      // React passes a dialog's close / cancel up through its component tree:
      // stop them here, so they don't reach another dialog of the app's.
      onClose={(event) => {
        event.stopPropagation();
        onClose();
      }}
      // Taps here mustn't reach the app under it (React bubbles them through the portal).
      onClick={(event) => event.stopPropagation()}
      // The click a finished swipe would end in doesn't press what's under the finger.
      onClickCapture={(event) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        swallowClick.current = false;
        swipeStart(event);
      }}
      onPointerMove={swipeMove}
      onPointerUp={(event) => {
        event.stopPropagation();
        swipeEnd();
      }}
      onPointerCancel={swipeEnd}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === 'settings-in') onCovered?.();
      }}
      onCancel={(event) => {
        event.stopPropagation();
        // Esc / the phone's back: one step back, sliding (a detail page to the list, the list closed).
        event.preventDefault();
        back();
      }}
    >
      {/* The list stays underneath; a detail screen comes in over it. */}
      <div className="settings__screen" inert={shown !== null && !leaving}>
        <header className="settings__head">
          <button className="settings__back" aria-label="닫기" onClick={() => back()}>
            <ChevronLeft size={26} strokeWidth={2.2} />
          </button>
          <h2>설정</h2>
        </header>
        <div className="settings__page">{bodyOf('main')}</div>
      </div>
      {detail && (
        <div key={detail.id} ref={detailRef} className={`settings__screen settings__screen--detail ${leaving ? 'is-leaving' : ''}`} inert={leaving}>
          <header className="settings__head">
            <button className="settings__back" aria-label="설정으로" onClick={() => back()}>
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
