/**
 * Placeholders in the shape of what's coming (a tile, a photo grid, a 대화,
 * a day's card), shown while a first read is out so the screen has its
 * layout at once and only fills in — a softly pulsing grey, no "불러오는 중"
 * text. Screens read before open on their last answer instead (lib/readCache).
 */

/** We Now's group tiles: a cover square with a name and faces under it. */
export function TileSkeleton({ count = 2 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="group-tile skeleton-tile" aria-hidden>
          <span className="skeleton skeleton-tile__cover" />
          <span className="skeleton-tile__body">
            <span className="skeleton skeleton-line" style={{ width: '62%' }} />
            <span className="skeleton-tile__faces">
              <span className="skeleton skeleton-dot" />
              <span className="skeleton skeleton-dot" />
              <span className="skeleton skeleton-dot" />
            </span>
          </span>
        </div>
      ))}
    </>
  );
}

/** The gallery: a day's heading and a grid of squares, twice. */
export function GridSkeleton() {
  return (
    <div className="skeleton-gallery" role="status" aria-label="사진을 불러오는 중">
      {[9, 6].map((n, d) => (
        <section key={d} className="gallery__day" aria-hidden>
          <span className="skeleton skeleton-line skeleton-gallery__date" />
          <div className="gallery__grid">
            {Array.from({ length: n }, (_, i) => (
              <span key={i} className="skeleton skeleton-gallery__cell" style={{ animationDelay: `${(i % 3) * 90}ms` }} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** A 대화: a few bubbles either side. */
export function ChatSkeleton() {
  const lines: { mine: boolean; width: number }[] = [
    { mine: false, width: 58 },
    { mine: false, width: 40 },
    { mine: true, width: 46 },
    { mine: false, width: 66 },
    { mine: true, width: 34 },
  ];
  return (
    <li className="skeleton-chat" role="status" aria-label="대화를 불러오는 중">
      {lines.map((line, i) => (
        <span key={i} className={`skeleton-chat__line ${line.mine ? 'is-mine' : ''}`} aria-hidden>
          {!line.mine && <span className="skeleton skeleton-dot skeleton-chat__face" />}
          <span className="skeleton skeleton-chat__bubble" style={{ width: `${line.width}%` }} />
        </span>
      ))}
    </li>
  );
}

/** A day's card on a calendar: a map strip and a row a member. */
export function CardSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="week-card skeleton-card" role="status" aria-label="그날 사진을 불러오는 중">
      <span className="skeleton skeleton-card__map" aria-hidden />
      <ul className="skeleton-card__lanes" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <li key={i}>
            <span className="skeleton skeleton-dot skeleton-card__face" />
            <span className="skeleton-card__text">
              <span className="skeleton skeleton-line" style={{ width: '38%' }} />
              <span className="skeleton skeleton-line" style={{ width: '72%' }} />
              <span className="skeleton-card__photos">
                <span className="skeleton skeleton-card__photo" />
                <span className="skeleton skeleton-card__photo" />
                <span className="skeleton skeleton-card__photo" />
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
