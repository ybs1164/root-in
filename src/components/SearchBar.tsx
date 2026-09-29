import { forwardRef } from 'react';
import type { PlaceRef } from '../types/course';
import Logo from './Logo';

interface SearchBarProps {
  query: string;
  onQuery: (query: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: 'idle' | 'loading' | 'done';
  results: PlaceRef[];
  onPick: (place: PlaceRef) => void;
  providerLabel: string;
}

const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { query, onQuery, open, onOpenChange, status, results, onPick, providerLabel },
  inputRef,
) {
  const showPanel = open && query.trim().length > 0;

  return (
    <div className={`search ${open ? 'search--open' : ''}`}>
      <div className="search__bar">
        {open ? (
          <button className="icon-btn" aria-label="검색 닫기" onClick={() => onOpenChange(false)}>
            ←
          </button>
        ) : (
          <span className="search__logo">
            <Logo />
          </span>
        )}
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          value={query}
          placeholder="장소 검색 (예: 성수 카페)"
          aria-label="장소 검색"
          onFocus={() => onOpenChange(true)}
          onChange={(e) => onQuery(e.target.value)}
        />
        {query && (
          <button className="icon-btn" aria-label="검색어 지우기" onClick={() => onQuery('')}>
            ✕
          </button>
        )}
      </div>

      {showPanel && (
        <div className="search__panel" role="listbox" aria-label="검색 결과">
          {status === 'loading' && results.length === 0 && <p className="search__msg">찾는 중…</p>}
          {status === 'done' && results.length === 0 && (
            <p className="search__msg">결과가 없어요. 다른 이름이나 지역을 함께 입력해 보세요.</p>
          )}
          {results.map((place) => (
            <button key={place.id} role="option" aria-selected={false} className="result" onClick={() => onPick(place)}>
              <span className="result__name">{place.name}</span>
              <span className="result__meta">
                {[place.category, place.address].filter(Boolean).join(' · ')}
              </span>
            </button>
          ))}
          <p className="search__provider">검색: {providerLabel}</p>
        </div>
      )}
    </div>
  );
});

export default SearchBar;
