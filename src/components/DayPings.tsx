import { layoutPings, type DayPing } from '../domain/dayPings';

const PIN_PATH = 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0';

/**
 * A day's pings drawn without a map: pins at their relative real positions,
 * joined in visiting order. Mounted fresh on each visit so the pins drop in
 * and the line draws itself again.
 */
export default function DayPings({ pings }: { pings: DayPing[] }) {
  const points = layoutPings(pings.map((p) => p.center));
  return (
    <div className="pings" role="list" aria-label={pings.length ? `${pings.length}곳` : '기록 없음'}>
      {points.length > 1 && (
        <svg className="pings__line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polyline pathLength={1} points={points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')} />
        </svg>
      )}
      {pings.map((ping, i) => (
        <div
          key={`${ping.time}-${ping.name}`}
          className="ping"
          role="listitem"
          style={{ left: `${points[i].x * 100}%`, top: `${points[i].y * 100}%`, animationDelay: `${120 + i * 110}ms` }}
        >
          <svg className="ping__pin" viewBox="4 1.5 16 20.5" aria-hidden>
            <path d={PIN_PATH} />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="ping__label">
            {ping.name}
            <small>{ping.time}</small>
          </span>
        </div>
      ))}
    </div>
  );
}
