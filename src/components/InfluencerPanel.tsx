import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { THEME_LABELS } from '../types/course';
import { curatorFeedService, type Curator, type CuratorItem } from '../services/curatorFeedService';

interface InfluencerPanelProps {
  onOpen: (item: CuratorItem) => void;
}

/** 추천 tab (prototype): curated courses and pin sets from a bundled sample feed. */
export default function InfluencerPanel({ onOpen }: InfluencerPanelProps) {
  const [curators, setCurators] = useState<Curator[] | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    curatorFeedService.list().then((list) => {
      if (cancelled) return;
      setCurators(list);
      setActive((a) => a ?? list[0]?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (curators === null) return <p className="diary-empty">불러오는 중…</p>;
  if (curators.length === 0) return <p className="diary-empty">추천 코스를 준비 중이에요.</p>;
  const current = curators.find((c) => c.id === active) ?? curators[0];

  return (
    <div className="feed">
      <div className="curator-row" role="tablist" aria-label="큐레이터">
        {curators.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={c.id === current.id}
            className={`curator ${c.id === current.id ? 'is-on' : ''}`}
            onClick={() => setActive(c.id)}
          >
            <span className="curator__avatar" aria-hidden>
              {c.emoji}
            </span>
            <span className="curator__name">{c.name}</span>
          </button>
        ))}
      </div>
      <p className="feed__bio">{current.bio}</p>
      <ul className="course-list">
        {current.items.map((item) => (
          <li key={item.id}>
            <button className="feed-card" onClick={() => onOpen(item)}>
              <span className="feed-card__main">
                <span className="course-card__badges">
                  {item.kind === 'course' ? (
                    <span className={`badge badge--${item.course.theme}`}>{THEME_LABELS[item.course.theme]} 코스</span>
                  ) : (
                    <span className="badge badge--shared">핀셋</span>
                  )}
                </span>
                <strong className="course-card__title">{item.kind === 'course' ? item.course.title : item.pins.title}</strong>
                <span className="course-card__stops">
                  {item.kind === 'course'
                    ? item.course.stops.map((s) => s.place.name).join(' → ')
                    : item.pins.pins.map((p) => p.place.name).join(' · ')}
                </span>
              </span>
              <ChevronRight size={20} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <p className="hint hint--muted">프로토타입용 예시 큐레이터예요. 실제 인물과 관계없어요.</p>
    </div>
  );
}
