import { Star } from 'lucide-react';

// Icons are Lucide (ISC). Import them per icon from 'lucide-react' so only
// the ones in use end up in the bundle.

/** Wishlist star: outline when off, filled when on. */
export function WishStar({ on, size = 22 }: { on: boolean; size?: number }) {
  return <Star size={size} fill={on ? 'currentColor' : 'none'} aria-hidden />;
}

/**
 * The calendar tab's icon: a calendar page (Lucide `calendar` frame) with
 * today's day of the month written in it.
 */
export function CalendarToday({ day = new Date().getDate() }: { day?: number }) {
  return (
    <svg className="calendar-today" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <text x="12" y="18.2" textAnchor="middle" fill="currentColor" stroke="none" fontSize={day > 9 ? 9.5 : 10.5} fontWeight="800">
        {day}
      </text>
    </svg>
  );
}
