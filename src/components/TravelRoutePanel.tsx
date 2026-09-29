import { useEffect, useState } from 'react';
import type { Place } from '../data/places';
import type { useTravelRoutes } from '../hooks/useTravelRoutes';
import { getPopularRoutes, type RouteRecommendation } from '../services/recommendationService';
import type { PlaceRef, TravelRoute } from '../types/travelRoute';
import RouteShareDialog from './RouteShareDialog';

const toPlaceRef = (place: Place): PlaceRef => ({ id: place.id, name: place.name, center: place.center });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

interface TravelRoutePanelProps {
  places: Place[];
  /** Owned by App so the shared-route card and this list stay in sync. */
  travelRoutes: ReturnType<typeof useTravelRoutes>;
  originId: string | null;
  destinationId: string | null;
  onOriginChange: (id: string | null) => void;
  onDestinationChange: (id: string | null) => void;
  /** Preview a saved route's endpoints on the map without re-saving it. */
  onPreviewRoute: (originId: string, destinationId: string) => void;
}

export default function TravelRoutePanel({
  places,
  travelRoutes,
  originId,
  destinationId,
  onOriginChange,
  onDestinationChange,
  onPreviewRoute,
}: TravelRoutePanelProps) {
  const { routes, isLoading, error, addRoute, removeRoute } = travelRoutes;
  const [sharingRoute, setSharingRoute] = useState<TravelRoute | null>(null);
  const [title, setTitle] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [popularRoutes, setPopularRoutes] = useState<RouteRecommendation[]>([]);

  // Placeholder recommendation surface: recomputed whenever the saved list
  // changes. Only ever reflects this browser's own routes today (see
  // recommendationService.ts) — real cross-user popularity arrives once the
  // repository is backend-backed, with no change needed here.
  useEffect(() => {
    getPopularRoutes().then(setPopularRoutes);
  }, [routes]);

  const handleAddRoute = async () => {
    const originPlace = places.find((place) => place.id === originId);
    const destinationPlace = places.find((place) => place.id === destinationId);

    if (!originPlace || !destinationPlace) {
      setFormError('출발지와 도착지를 모두 선택하세요.');
      return;
    }
    if (originPlace.id === destinationPlace.id) {
      setFormError('출발지와 도착지가 같을 수 없습니다.');
      return;
    }

    setFormError(null);
    const ok = await addRoute({
      origin: toPlaceRef(originPlace),
      destination: toPlaceRef(destinationPlace),
      title,
    });
    if (ok) {
      setTitle('');
    }
  };

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Travel route</h2>
        <span>{routes.length}</span>
      </div>

      <div className="route-selector">
        <label>
          <span>출발지</span>
          <select value={originId || ''} onChange={(e) => onOriginChange(e.target.value || null)}>
            <option value="">— 선택 —</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>도착지</span>
          <select value={destinationId || ''} onChange={(e) => onDestinationChange(e.target.value || null)}>
            <option value="">— 선택 —</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>이름 (선택)</span>
          <input
            className="route-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 여름 휴가"
          />
        </label>
      </div>

      {formError && <p className="form-error">{formError}</p>}

      <div className="actions">
        <button className="primary" onClick={handleAddRoute} disabled={!originId || !destinationId}>
          경로 추가
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="travel-route-list">
        {isLoading && <p className="muted-note">불러오는 중...</p>}
        {!isLoading && routes.length === 0 && <p className="muted-note">아직 저장된 경로가 없습니다.</p>}
        {routes.map((route) => (
          <div key={route.id} className="travel-route-item">
            <button
              className="travel-route-item__main"
              onClick={() => onPreviewRoute(route.origin.id, route.destination.id)}
            >
              <strong>
                {route.title}
                {route.sharedBy !== undefined && (
                  <em className="route-badge">{route.sharedBy ? `${route.sharedBy}님 공유` : '공유받음'}</em>
                )}
              </strong>
              <span>
                {route.origin.name} → {route.destination.name}
              </span>
              {route.note && <span className="travel-route-item__note">{route.note}</span>}
              <span className="travel-route-item__date">{formatDate(route.createdAt)}</span>
            </button>
            <button
              className="icon-button icon-button--share"
              aria-label={`${route.title} 공유`}
              title="공유"
              onClick={() => setSharingRoute(route)}
            >
              ↗
            </button>
            <button
              className="icon-button"
              aria-label={`${route.title} 삭제`}
              onClick={() => removeRoute(route.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {sharingRoute && <RouteShareDialog route={sharingRoute} onClose={() => setSharingRoute(null)} />}

      {popularRoutes.length > 0 && (
        <div className="popular-routes">
          <div className="panel__header">
            <h2>자주 등록된 경로</h2>
          </div>
          <ul>
            {popularRoutes.map((rec) => (
              <li key={`${rec.originId}-${rec.destinationId}`}>
                <button onClick={() => onPreviewRoute(rec.originId, rec.destinationId)}>
                  {rec.originName} → {rec.destinationName}
                  <span> · {rec.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
