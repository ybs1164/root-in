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
  onName: (id: string, name: string) => void;
  /** Adds an empty row and returns its id (to start editing it). */
  onAdd: () => string | null;
  onRemove: (id: string) => void;
}

type Field = 'name' | 'address';

/**
 * 개인 정보 → 제외 주소: addresses that never go out in a share. 집 is the
 * fixed, required first row; up to five more can be added (and removed),
 * each with a name of its own. Name and address each show as text with a
 * small pen; a tap edits it in place, Enter or tapping away saves.
 */
export default function PrivacySection({ places, resolving, notice, onAddress, onName, onAdd, onRemove }: PrivacySectionProps) {
  const [editing, setEditingState] = useState<{ id: string; field: Field } | null>(null);
  // Mirrors `editing` for the blur that can follow Esc as the input goes away.
  const editingRef = useRef(editing);
  const setEditing = (next: { id: string; field: Field } | null) => {
    editingRef.current = next;
    setEditingState(next);
  };
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const start = (place: ExcludedPlace, field: Field) => {
    setDraft(field === 'name' ? (place.name ?? '') : place.address);
    setEditing({ id: place.id, field });
  };

  /** `next`: Enter on a new place's name goes straight on to its address. */
  const finish = (save: boolean, next = false) => {
    const current = editingRef.current;
    if (!current) return;
    setEditing(null);
    const place = places.find((p) => p.id === current.id);
    if (!place) return;
    const text = draft.trim();
    if (current.field === 'name') {
      if (save && text !== (place.name ?? '')) onName(place.id, text);
      if (next && !place.address) {
        setDraft('');
        setEditing({ id: place.id, field: 'address' });
      }
      return;
    }
    // An extra row with no address goes away; 집 stays (it's required).
    if (place.kind === 'other' && !(save ? text : place.address)) return onRemove(place.id);
    if (save && text !== place.address) onAddress(place.id, text);
  };

  const input = (label: string, maxLength: number, placeholder: string, className: string) => (
    <input
      ref={inputRef}
      className={`privacy__input ${className}`}
      value={draft}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={label}
      enterKeyHint="done"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(true, true);
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          finish(false);
        }
      }}
    />
  );

  let other = 0;
  return (
    <section id="profile-privacy" className="privacy" aria-label="제외 주소">
      <h3 className="privacy__title">제외 주소</h3>
      <p className="privacy__desc">공유할 때 이 주소에 있는 장소는 자동으로 빠져요.</p>
      {notice && <p className="privacy__notice">{notice}</p>}
      <ul className="privacy__list">
        {places.map((place) => {
          const home = place.kind === 'home';
          // Unnamed extras read as 주소 1, 주소 2… in the order they're listed.
          const fallback = home ? '집' : `주소 ${(other += 1)}`;
          const label = home ? '집' : place.name || fallback;
          const missing = home && !place.address.trim();
          const status = resolving.has(place.id)
            ? '위치 찾는 중…'
            : place.address && !place.center
              ? '위치를 못 찾았어요 · 주소가 같은 장소만 빠져요'
              : '';
          const editingName = editing?.id === place.id && editing.field === 'name';
          const editingAddress = editing?.id === place.id && editing.field === 'address';
          return (
            <li key={place.id} className={`privacy__row ${missing ? 'is-missing' : ''}`}>
              <div className="privacy__name">
                {home ? (
                  <span className="privacy__label">
                    집<em className="privacy__required">필수</em>
                  </span>
                ) : editingName ? (
                  input(`${label} 이름`, PRIVACY_LIMITS.name, fallback, 'privacy__input--name')
                ) : (
                  <button className="privacy__label privacy__label--edit" aria-label={`${label} 이름 바꾸기`} onClick={() => start(place, 'name')}>
                    <span>{label}</span>
                    <PenLine size={13} aria-hidden />
                  </button>
                )}
              </div>
              {editingAddress ? (
                input(`${label} 주소`, PRIVACY_LIMITS.address, '주소를 입력하세요', '')
              ) : (
                <button
                  className={`privacy__address ${place.address ? '' : 'is-empty'}`}
                  aria-label={`${label} 주소 수정`}
                  onClick={() => start(place, 'address')}
                >
                  <span>{place.address || '주소를 입력하세요'}</span>
                  <PenLine size={14} aria-hidden />
                </button>
              )}
              {!home && !editing && (
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
            if (!id) return;
            // A new place starts with its name, then its address.
            setDraft('');
            setEditing({ id, field: 'name' });
          }}
        >
          <Plus size={16} aria-hidden />
          주소 추가
        </button>
      )}
    </section>
  );
}
