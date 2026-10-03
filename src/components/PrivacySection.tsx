import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { HOME_ID, homeIsSet, PRIVACY_LIMITS, type ExcludedPlace } from '../domain/privacy';
import { usePlaceSearch } from '../hooks/usePlaceSearch';
import type { PlaceSearchService } from '../services/placeSearch/placeSearchService';
import { loadPrivacy, savePrivacy } from '../services/privacyRepository';

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `x-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * 프로필 → 개인 정보 → 제외 주소: places taken out of anything shared.
 * Home is always there and must be filled in before sharing works.
 */
export default function PrivacySection({ search }: { search: PlaceSearchService | null }) {
  const [places, setPlaces] = useState(() => loadPrivacy().excluded);

  const change = (next: ExcludedPlace[]) => {
    setPlaces(next);
    savePrivacy({ excluded: next });
  };
  const update = (id: string, patch: Partial<ExcludedPlace>) =>
    change(places.map((p) => (p.id === id ? withPatch(p, patch) : p)));

  return (
    <section className="privacy" aria-labelledby="privacy-excluded">
      <h3 id="privacy-excluded" className="privacy__title">
        제외 주소
      </h3>
      <p className="privacy__hint">여기 있는 주소의 장소는 공유할 때 자동으로 빠져요.</p>
      <ul className="privacy__list">
        {places.map((place) => {
          const home = place.id === HOME_ID;
          return (
            <li key={place.id} className="privacy__row">
              {home ? (
                <span className="privacy__label">
                  집<em className="privacy__required">필수</em>
                </span>
              ) : (
                <input
                  className="privacy__label-input"
                  value={place.label}
                  maxLength={PRIVACY_LIMITS.label}
                  placeholder="이름"
                  aria-label="장소 이름"
                  onChange={(e) => update(place.id, { label: e.target.value })}
                />
              )}
              <AddressField
                address={place.address}
                search={search}
                label={home ? '집 주소' : `${place.label || '장소'} 주소`}
                onCommit={(address, center) => update(place.id, { address, center })}
              />
              {!home && (
                <button className="privacy__remove" aria-label="주소 삭제" onClick={() => change(places.filter((p) => p.id !== place.id))}>
                  <X size={16} aria-hidden />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {!homeIsSet(places) && <p className="privacy__hint is-required">집 주소는 꼭 입력해 주세요. 입력하기 전에는 공유할 수 없어요.</p>}
      {places.length < PRIVACY_LIMITS.places && (
        <button className="privacy__add" onClick={() => change([...places, { id: newId(), label: '', address: '' }])}>
          <Plus size={16} aria-hidden />
          주소 추가
        </button>
      )}
    </section>
  );
}

function withPatch(place: ExcludedPlace, patch: Partial<ExcludedPlace>): ExcludedPlace {
  const next = { ...place, ...patch };
  if (!next.center) delete next.center;
  return next;
}

interface AddressFieldProps {
  address: string;
  search: PlaceSearchService | null;
  label: string;
  /** `center` only when picked from the suggestions; typed text alone matches by address. */
  onCommit: (address: string, center?: [number, number]) => void;
}

/** Type an address; suggestions from place search fill in the position too. */
function AddressField({ address, search, label, onCommit }: AddressFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  const { results } = usePlaceSearch(search, editing ? draft : '', () => undefined);

  const commitTyped = () => {
    if (draft === null) return;
    const text = draft.trim().slice(0, PRIVACY_LIMITS.address);
    setDraft(null);
    if (text !== address) onCommit(text);
  };

  return (
    <div className="privacy__address">
      <input
        type="search"
        enterKeyHint="done"
        value={draft ?? address}
        maxLength={PRIVACY_LIMITS.address}
        placeholder="주소 입력"
        aria-label={label}
        onFocus={() => setDraft(address)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitTyped}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      {editing && draft.trim() && results.length > 0 && (
        <ul className="privacy__suggest" role="listbox" aria-label={`${label} 추천`}>
          {results.slice(0, 4).map((place) => (
            <li key={place.id}>
              <button
                role="option"
                aria-selected={false}
                // Keep the field focused until the pick is in, so its blur doesn't save the half-typed text.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  setDraft(null);
                  onCommit((place.address || place.name).slice(0, PRIVACY_LIMITS.address), place.center);
                  (document.activeElement as HTMLElement | null)?.blur();
                }}
              >
                <span className="privacy__suggest-name">{place.name}</span>
                {place.address && <span className="privacy__suggest-meta">{place.address}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
