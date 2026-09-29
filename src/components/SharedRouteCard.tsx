import { useState } from 'react';
import type { SharedRoute } from '../types/travelRoute';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

interface SharedRouteCardProps {
  /** null renders the "broken link" variant. */
  route: SharedRoute | null;
  /** Whether both endpoints exist in this app's place catalog (needed to draw it). */
  isSupported: boolean;
  alreadySaved: boolean;
  onPreview: () => void;
  onSave: () => Promise<boolean>;
  onDismiss: () => void;
}

export default function SharedRouteCard({
  route,
  isSupported,
  alreadySaved,
  onPreview,
  onSave,
  onDismiss,
}: SharedRouteCardProps) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  if (!route) {
    return (
      <section className="shared-card shared-card--invalid" role="alert">
        <div className="shared-card__head">
          <p className="eyebrow">공유된 경로</p>
          <button className="icon-button icon-button--plain" aria-label="닫기" onClick={onDismiss}>
            ✕
          </button>
        </div>
        <p className="shared-card__message">링크가 손상되었거나 지원하지 않는 형식이라 경로를 열 수 없습니다.</p>
      </section>
    );
  }

  const handleSave = async () => {
    setSaveState('saving');
    setSaveState((await onSave()) ? 'saved' : 'error');
  };

  const saved = alreadySaved || saveState === 'saved';

  return (
    <section className="shared-card" aria-label="공유받은 경로">
      <div className="shared-card__head">
        <p className="eyebrow">{route.sharedBy ? `${route.sharedBy}님이 공유한 경로` : '공유받은 경로'}</p>
        <button className="icon-button icon-button--plain" aria-label="닫기" onClick={onDismiss}>
          ✕
        </button>
      </div>

      <h3 className="shared-card__title">{route.title}</h3>
      <p className="share-route-line">
        <span className="route-dot route-dot--origin" />
        {route.origin.name}
        <span className="share-route-line__arrow">→</span>
        <span className="route-dot route-dot--destination" />
        {route.destination.name}
      </p>

      {route.note && <blockquote className="shared-card__note">{route.note}</blockquote>}
      <p className="shared-card__date">{formatDate(route.sharedAt)} 공유</p>

      {!isSupported && <p className="form-error">이 앱의 장소 목록에 없는 장소가 포함되어 지도에 표시할 수 없습니다.</p>}
      {saveState === 'error' && <p className="form-error">저장하지 못했습니다.</p>}

      <div className="actions">
        <button className="secondary" onClick={onPreview} disabled={!isSupported}>
          지도에서 보기
        </button>
        <button className="primary" onClick={handleSave} disabled={!isSupported || saved || saveState === 'saving'}>
          {saved ? '저장됨 ✓' : saveState === 'saving' ? '저장 중...' : '내 경로에 저장'}
        </button>
      </div>
    </section>
  );
}
