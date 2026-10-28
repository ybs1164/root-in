import { useEffect, useRef, useState, type ReactNode } from 'react';
import { APP_LINK_FALLBACK, appLaunchUrl, incomingLinkHash, mobilePlatform } from '../lib/deepLink';
import { isNativeApp } from '../lib/native';
import Logo from './Logo';

/** Hold browser-side joins/resolution until the visitor chooses where to open the link. */
export default function AppLinkEntry({ children }: { children: ReactNode }) {
  const platform = isNativeApp() ? null : mobilePlatform(navigator.userAgent, navigator.maxTouchPoints);
  const [link, setLink] = useState(() => platform && incomingLinkHash(window.location.href) ? window.location.href : null);
  const [webLink, setWebLink] = useState<string | null>(null);
  const attempted = useRef<string | null>(null);
  const showEntry = !!link && link !== webLink;
  const launch = link && platform ? appLaunchUrl(link, platform) : null;

  useEffect(() => {
    if (!platform) return;
    const check = () => setLink(incomingLinkHash(window.location.href) ? window.location.href : null);
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, [platform]);

  useEffect(() => {
    if (!showEntry || !link || !launch || attempted.current === link) return;
    attempted.current = link;
    const current = new URL(link);
    if (current.searchParams.has(APP_LINK_FALLBACK)) return;
    // Persist the guard before leaving, including when the browser rejects the attempt.
    current.searchParams.set(APP_LINK_FALLBACK, '1');
    window.history.replaceState(window.history.state, '', current.href);
    try { window.location.assign(launch); } catch { /* The open button remains available. */ }
  }, [showEntry, link, launch]);

  if (!showEntry || !launch) return children;

  return (
    <main className="app-link-entry">
      <section className="app-link-entry__card" aria-labelledby="app-link-title">
        <Logo />
        <h1 id="app-link-title">root-in에서 이어 보기</h1>
        <p>공유받은 내용을 앱에서 바로 열어보세요.</p>
        <a className="app-link-entry__open" href={launch}>앱에서 열기</a>
        <button type="button" onClick={() => {
          // The app's existing URL readers receive the original fragment on mount.
          setWebLink(link);
        }}>웹에서 계속</button>
        <small>앱이 설치되어 있지 않다면 웹에서 계속할 수 있어요.</small>
        {platform === 'android' && <small>계속 웹으로 열린다면 기기 설정 → 앱 → root-in → 기본으로 열기에서 ‘지원되는 링크 열기’를 켜 주세요.</small>}
      </section>
    </main>
  );
}
