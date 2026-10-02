import { Ban } from 'lucide-react';
import { ROUTE_ICONS } from '../domain/course';

/**
 * The choices for a route's icon: 없음 first (the default — a route needs
 * no icon), then the icons. Shared by the new-route dialog and the edit sheet.
 */
export function RouteIconOptions({ value, onPick }: { value: string | undefined; onPick: (icon: string | undefined) => void }) {
  return (
    <>
      <button
        type="button"
        className={`folder-picker__opt folder-picker__opt--none ${!value ? 'is-on' : ''}`}
        aria-label="아이콘 없음"
        aria-pressed={!value}
        onClick={() => onPick(undefined)}
      >
        <Ban size={20} aria-hidden />
      </button>
      {ROUTE_ICONS.map((i) => (
        <button key={i} type="button" className={`folder-picker__opt ${value === i ? 'is-on' : ''}`} aria-pressed={value === i} onClick={() => onPick(i)}>
          {i}
        </button>
      ))}
    </>
  );
}

/** What a route's icon button shows: its icon, or a quiet "none" mark. */
export function RouteIconFace({ icon }: { icon: string | undefined }) {
  return icon ? <>{icon}</> : <Ban size={18} aria-hidden />;
}
