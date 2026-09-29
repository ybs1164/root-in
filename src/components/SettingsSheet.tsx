import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getDisplayName, setDisplayName } from '../lib/currentUser';
import { SHARE_LIMITS } from '../services/routeShareService';
import { clearAppData } from '../services/settingsRepository';
import CategoryManager from './CategoryManager';

type CategoryManagerProps = Parameters<typeof CategoryManager>[0];

interface SettingsSheetProps extends CategoryManagerProps {
  providerLabel: string;
  onClose: () => void;
}

export default function SettingsSheet({ providerLabel, onClose, ...categoryProps }: SettingsSheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [name, setName] = useState(getDisplayName);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="share-sheet settings"
      aria-labelledby="settings-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="share-sheet__body">
        <div className="sheet-grip" aria-hidden />
        <div className="share-sheet__head">
          <h2 id="settings-title">설정</h2>
          <button className="icon-btn" aria-label="닫기" onClick={onClose}>
            <X size={22} aria-hidden />
          </button>
        </div>

        <section className="settings__section">
          <h3>핀 카테고리</h3>
          <CategoryManager {...categoryProps} />
        </section>

        <section className="settings__section">
          <h3>공유</h3>
          <label className="field">
            <span>보내는 사람 이름</span>
            <input
              value={name}
              maxLength={SHARE_LIMITS.sharedBy}
              placeholder="받는 사람에게 보일 이름"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setDisplayName(name)}
            />
          </label>
        </section>

        <section className="settings__section">
          <h3>정보</h3>
          <p className="hint hint--muted">지도: {providerLabel}</p>
          <button
            className="btn btn--ghost btn--block settings__danger"
            onClick={() => {
              if (!window.confirm('핀·코스·기록·설정을 이 기기에서 모두 지울까요? 되돌릴 수 없어요.')) return;
              clearAppData();
              window.location.reload();
            }}
          >
            데이터 초기화
          </button>
        </section>
      </div>
    </dialog>
  );
}
