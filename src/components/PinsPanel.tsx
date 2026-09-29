import { Check, Route, Share } from 'lucide-react';
import type { CSSProperties } from 'react';
import { COURSE_LIMITS } from '../domain/course';
import { categoryPath, categoryStyle, filterPins } from '../domain/pin';
import type { Pin, PinCategory } from '../types/pin';
import CategoryChips from './CategoryChips';

interface PinsPanelProps {
  pins: Pin[];
  categories: PinCategory[];
  filter: string | null;
  onFilter: (id: string | null) => void;
  guide: boolean;
  onGuide: (on: boolean) => void;
  selecting: boolean;
  onSelecting: (on: boolean) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpenPin: (pin: Pin) => void;
  onConnect: (pins: Pin[]) => void;
  onShare: (pins: Pin[], title: string) => void;
}

export default function PinsPanel({
  pins,
  categories,
  filter,
  onFilter,
  guide,
  onGuide,
  selecting,
  onSelecting,
  selected,
  onToggleSelect,
  onOpenPin,
  onConnect,
  onShare,
}: PinsPanelProps) {
  const shown = filterPins(pins, categories, filter);
  const chosen = shown.filter((p) => selected.has(p.id));
  const filterName = filter ? categoryPath(categories, filter) : '';

  if (pins.length === 0) {
    return (
      <div className="pins">
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden>
            📍
          </span>
          <strong>아직 꽂은 핀이 없어요</strong>
          <span>아래 가운데 핀 버튼을 누르고, 지도를 옮겨 카테고리를 고르면 바로 저장돼요.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pins">
      <CategoryChips
        categories={categories.filter((c) => pins.some((p) => p.categoryId === c.id || categories.some((k) => k.parentId === c.id && k.id === p.categoryId)))}
        selected={filter}
        allLabel={`전체 ${pins.length}`}
        label="카테고리로 보기"
        onPick={(id) => onFilter(id === '' || id === filter ? null : id)}
      />

      <div className="pins__tools">
        <button className={`pill ${selecting ? 'pill--on' : ''}`} aria-pressed={selecting} onClick={() => onSelecting(!selecting)}>
          <Check size={16} aria-hidden />
          {selecting ? '선택 끝' : '선택'}
        </button>
        {filter && !selecting && (
          <>
            <button className={`pill ${guide ? 'pill--on' : ''}`} aria-pressed={guide} disabled={shown.length < 2} onClick={() => onGuide(!guide)}>
              <Route size={16} aria-hidden />
              이 카테고리 잇기
            </button>
            <button className="pill" onClick={() => onShare(shown, filterName)}>
              <Share size={16} aria-hidden />
              공유
            </button>
          </>
        )}
      </div>

      <ul className="pin-list">
        {shown.map((pin) => {
          const style = categoryStyle(categories, pin.categoryId);
          const on = selected.has(pin.id);
          return (
            <li key={pin.id}>
              <button
                className={`pin-row ${selecting && on ? 'pin-row--on' : ''}`}
                aria-pressed={selecting ? on : undefined}
                onClick={() => (selecting ? onToggleSelect(pin.id) : onOpenPin(pin))}
              >
                <span className="pin-badge" style={{ '--pin': `var(--pin-${style.color})` } as CSSProperties} aria-hidden>
                  {selecting && on ? '✓' : style.emoji}
                </span>
                <span className="pin-row__text">
                  <strong>{pin.place.name}</strong>
                  <span>
                    {categoryPath(categories, pin.categoryId)}
                    {pin.memo && ` · ${pin.memo}`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selecting && (
        <div className="action-bar action-bar--two">
          <button className="btn btn--secondary" disabled={chosen.length === 0} onClick={() => onShare(chosen, '')}>
            공유 {chosen.length > 0 && chosen.length}
          </button>
          <button
            className="btn btn--primary"
            disabled={chosen.length < 2 || chosen.length > COURSE_LIMITS.maxStops}
            onClick={() => onConnect(chosen)}
          >
            <Route size={18} aria-hidden />
            {chosen.length > COURSE_LIMITS.maxStops ? `최대 ${COURSE_LIMITS.maxStops}곳` : `선으로 잇기 ${chosen.length || ''}`}
          </button>
        </div>
      )}
    </div>
  );
}
