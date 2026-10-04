import { PenLine, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PRIVACY_LIMITS, type ExcludedPlace } from '../domain/privacy';

interface PrivacySectionProps {
  places: ExcludedPlace[];
  /** Ids whose address is still being looked up. */
  resolving: ReadonlySet<string>;
  /** Shown above the list (e.g. why 공유 sent the user here). */
  notice?: string | null;
  onAddress: (id: string, address: string) => void;
  /** Adds an empty row and returns its id (to start editing it). */
  onAdd: () => string | null;
  onRemove: (id: string) => void;
}

/**
 * 개인 정보 → 제외 주소: addresses that never go out in a share. 집 is the
 * fixed, required first row; up to five more can be added (and removed).
 * Each address shows as text with a small pen; the pen (or a tap on it)
 * edits it in place, Enter or tapping away saves.
 */
export default function PrivacySection({ places, resolving, notice, onAddress, onAdd, onRemove }: PrivacySectionProps) {
  const [editing, setEditingState] = useState<string | null>(null);
  // Mirrors `editing` for the blur that can follow Esc as the input goes away.
  const editingRef = useRef<string | null>(null);
  const setEditing = (id: string | null) => {
    editingRef.current = id;
    setEditingState(id);
  };
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const start = (place: ExcludedPlace) => {
    setDraft(place.address);
    setEditing(place.id);
  };

  const finish = (save: boolean) => {
    const place = places.find((p) => p.id === editingRef.current);
    if (!editingRef.current) return;
    setEditing(null);
    if (!place) return;
    const text = draft.trim();
    // An extra row left empty goes away; 집 stays (it's required).
    if (save && !text && place.kind === 'other') return onRemove(place.id);
    if (save && text !== place.address) onAddress(place.id, text);
    if (!save && !place.address && place.kind === 'other') onRemove(place.id);
  };

  let other = 0;
  return (
    <section id="profile-privacy" className="privacy" aria-label="제외 주소">
      <h3 className="privacy__title">제외 주소</h3>
      <p className="privacy__desc">공유할 때 이 주소에 있는 장소는 자동으로 빠져요.</p>
      {notice && <p className="privacy__notice">{notice}</p>}
      <ul className="privacy__list">
        {places.map((place) => {
          const home = place.kind === 'home';
          const label = home ? '집' : `주소 ${(other += 1)}`;
          const missing = home && !place.address.trim();
          const status = resolving.has(place.id)
            ? '위치 찾는 중…'
            : place.address && !place.center
              ? '위치를 못 찾았어요 · 주소가 같은 장소만 빠져요'
              : '';
          return (
            <li key={place.id} className={`privacy__row ${missing ? 'is-missing' : ''}`}>
              <span className="privacy__label">
                {label}
                {home && <em className="privacy__required">필수</em>}
              </span>
              {editing === place.id ? (
                <input
                  ref={inputRef}
                  className="privacy__input"
                  value={draft}
                  maxLength={PRIVACY_LIMITS.address}
                  placeholder="주소를 입력하세요"
                  aria-label={`${label} 주소`}
                  enterKeyHint="done"
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => finish(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      finish(false);
                    }
                  }}
                />
              ) : (
                <button className={`privacy__address ${place.address ? '' : 'is-empty'}`} aria-label={`${label} 주소 수정`} onClick={() => start(place)}>
                  <span>{place.address || '주소를 입력하세요'}</span>
                  <PenLine size={14} aria-hidden />
                </button>
              )}
              {!home && editing !== place.id && (
                <button className="icon-btn privacy__remove" aria-label={`${label} 삭제`} onClick={() => onRemove(place.id)}>
                  <Trash2 size={18} aria-hidden />
                </button>
              )}
              {status && <span className="privacy__status">{status}</span>}
            </li>
          );
        })}
      </ul>
      {places.length < PRIVACY_LIMITS.maxPlaces && (
        <button
          className="privacy__add"
          onClick={() => {
            const id = onAdd();
            if (id) {
              setDraft('');
              setEditing(id);
            }
          }}
        >
          <Plus size={16} aria-hidden />
          주소 추가
        </button>
      )}
    </section>
  );
}
