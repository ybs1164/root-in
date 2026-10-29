// Icons are Lucide (ISC). Import them per icon from 'lucide-react' so only
// the ones in use end up in the bundle.

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

/** One open hand, palm out, three fingers up (HighFive's, drawn to read at 18px). */
const HAND = 'M4 14 V8.5 a1.2 1.2 0 0 1 2.4 0 V12 V6.2 a1.2 1.2 0 0 1 2.4 0 V12 V7.2 a1.2 1.2 0 0 1 2.4 0 V14.5 c0 3.4 -1.6 5.5 -4.3 5.5 c-1.9 0 -2.9 -1.6 -2.9 -4 Z';

/**
 * 만난 날 (the gallery): a high five — two open hands leaning in until
 * their fingertips meet, three little lines of the clap over them.
 */
export function HighFive({ size = 24 }: { size?: number }) {
  const hand = (
    <g transform="translate(-3.4 1.4) rotate(14 7.4 20)">
      <path d={HAND} />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {hand}
      <g transform="translate(24 0) scale(-1 1)">{hand}</g>
      <path d="M12 4.2V2.2M9.2 4.4 8.2 3.2M14.8 4.4l1-1.2" />
    </svg>
  );
}
