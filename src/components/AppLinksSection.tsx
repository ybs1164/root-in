import { Capacitor, registerPlugin } from '@capacitor/core';
import { useEffect, useState } from 'react';
import { publicAppUrl } from '../lib/appUrl';
import { onAppVisibility } from '../lib/native';

const AppLinks = registerPlugin<{
  status(options: { host: string }): Promise<{ enabled: boolean | null }>;
  openSettings(): Promise<void>;
}>('AppLinks');

/** Existing installs can retain a failed verification even after the website is fixed. */
export default function AppLinksSection({ compact = false }: { compact?: boolean }) {
  const android = Capacitor.getPlatform() === 'android';
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const host = new URL(publicAppUrl()).hostname;

  useEffect(() => {
    if (!android) return;
    let revision = 0;
    const stop = onAppVisibility((active) => {
      const asked = ++revision;
      if (!active) return;
      void AppLinks.status({ host }).then((status) => {
        if (asked === revision) setEnabled(status.enabled);
      }).catch(() => { /* Older APKs may not have this plugin yet. */ });
    });
    return () => { revision += 1; stop(); };
  }, [android, host]);

  if (!android || (compact && enabled !== false)) return null;

  const open = async () => {
    try {
      await AppLinks.openSettings();
      setNote(null);
    } catch {
      setNote('기기 설정 → 앱 → root-in → 기본으로 열기에서 설정할 수 있어요.');
    }
  };

  return (
    <section className={compact ? 'app-links-notice' : 'privacy'} aria-label="초대 링크 연결">
      <p className="location-settings__note">
        {enabled ? '초대·공유 링크가 이 앱으로 연결돼요.' : '초대 링크를 이 앱의 계정으로 열려면 앱 연결을 켜 주세요.'}
      </p>
      {enabled !== true && <p className="location-settings__note">‘지원되는 링크 열기’를 켜고 {host}을 선택해 주세요.</p>}
      <button className="btn btn--secondary" onClick={() => void open()}>앱 링크 설정 열기</button>
      {note && <p className="location-settings__note" role="status">{note}</p>}
    </section>
  );
}
