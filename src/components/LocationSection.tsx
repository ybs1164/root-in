import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { MyLocationControl } from '../hooks/useMyLocation';
import { LOCATION_MESSAGES } from '../lib/geolocation';
import { onAppVisibility, openLocationSettings } from '../lib/native';

export default function LocationSection({ location }: { location: MyLocationControl }) {
  const [note, setNote] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    if (!returning) return;
    let leftApp = false;
    return onAppVisibility((active) => {
      if (!active) { leftApp = true; return; }
      if (!leftApp) return;
      setReturning(false);
      void location.enable();
    });
  }, [returning, location.enable]);

  const openSettings = async () => {
    setReturning(true);
    if (!await openLocationSettings(location.error === 'denied' ? 'permission' : 'services')) {
      setReturning(false);
      setNote('설정을 열지 못했어요. 기기의 설정에서 위치 권한과 위치 기능을 확인해 주세요.');
    }
  };
  const on = location.enabled;
  return (
    <section className="location-settings" aria-label="위치 설정">
      <button className="settings__row" role="switch" aria-label="위치 기능" aria-checked={on} disabled={location.busy} onClick={() => on ? location.disable() : void location.enable()}>
        <span className="settings__label">위치 기능</span>
        <span className={`settings__switch ${on ? 'is-on' : ''}`} aria-hidden />
      </button>
      <p className="location-settings__note" role="status">
        {location.busy ? '내 위치를 찾고 있어요…' : location.error ? LOCATION_MESSAGES[location.error] : on ? '위치 기능이 켜져 있어요.' : '내 위치를 지도에 표시하고 가까운 장소를 찾을 수 있어요.'}
      </p>
      <p className="location-settings__note">앱을 사용하는 동안만 위치를 확인해요.</p>
      {location.error && (
        <div className="location-settings__actions">
          <button className="btn btn--secondary" disabled={location.busy} onClick={() => void location.enable()}>다시 시도</button>
          {(location.error === 'denied' || location.error === 'disabled') && Capacitor.getPlatform() === 'android' && (
            <button className="btn btn--secondary" onClick={() => void openSettings()}>{location.error === 'denied' ? '권한 설정 열기' : '기기 위치 켜기'}</button>
          )}
          {location.error === 'denied' && Capacitor.getPlatform() === 'web' && <p className="location-settings__note">브라우저의 사이트 설정에서 위치 권한을 허용한 뒤 다시 시도해 주세요.</p>}
        </div>
      )}
      {note && <p className="location-settings__note" role="status">{note}</p>}
    </section>
  );
}
