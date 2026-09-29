import { X } from 'lucide-react';
import type { PinCategory } from '../types/pin';
import CategoryChips from './CategoryChips';

interface PinDropTrayProps {
  categories: PinCategory[];
  recent: string[];
  busy: boolean;
  onPick: (categoryId: string) => void;
  onCancel: () => void;
}

/**
 * Pin mode: the map centre is the aim (a fixed pin drawn over the map), and
 * one tap on a category saves it — no confirm step; the toast offers undo.
 */
export default function PinDropTray({ categories, recent, busy, onPick, onCancel }: PinDropTrayProps) {
  return (
    <>
      <div className="aim" aria-hidden>
        <span className="aim__pin">📍</span>
        <span className="aim__shadow" />
      </div>
      <section className="drop-tray" aria-label="핀 꽂기">
        <div className="drop-tray__head">
          <strong>{busy ? '위치 확인 중…' : '지도를 옮겨 위치를 맞추고 카테고리를 고르세요'}</strong>
          <button className="icon-btn" aria-label="핀 꽂기 취소" onClick={onCancel}>
            <X size={22} aria-hidden />
          </button>
        </div>
        <CategoryChips categories={categories} recent={recent} label="카테고리" onPick={(id) => !busy && onPick(id)} />
      </section>
    </>
  );
}
