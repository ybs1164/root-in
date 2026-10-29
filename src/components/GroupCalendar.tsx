import { ChevronLeft } from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import { dayPingers, isGroupBirthday, withMyPingDays, type Group } from '../domain/groups';
import { dateKey } from '../domain/diary';
import { useGroupPingDays } from '../hooks/useGroups';
import type { AuthUser } from '../services/authService';
import MonthCalendar from './MonthCalendar';
import { MemberFace } from './WeNowPage';

/** Faces under a day at most; more read +n. */
const FACES = 3;
const NO_COUNTS = new Map<string, number>();
const NO_PLANS = new Set<string>();

const pad = (n: number) => String(n).padStart(2, '0');

interface GroupCalendarProps {
  group: Group;
  user: AuthUser | null;
  /** My id and the days this phone has pings of mine on (fresher than the server's copy). */
  me: string | null;
  myDays: ReadonlySet<string>;
  /** The day the map shows (its month opens first). */
  day: string;
  /** A day picked: the map goes to it. */
  onPick(day: string): void;
  /** The year tapped: back to the map, on today (as TODAY's year goes back to TODAY). */
  onToday(): void;
  onClose(): void;
}

/**
 * A group's calendar, from the ⚙'s calendar button on its map: TODAY's month
 * view (‹ top-left, the year big where TODAY stands, the month grid centred
 * under it; the group's name under the year — tapping the year goes back to
 * the map on today), but under each day the faces of the members who
 * pinged that day (slightly overlapping, +n past three) instead of the ping
 * dots. A day up to today opens the map on it; the days to come can't.
 */
export default function GroupCalendar({ group, user, me, myDays, day, onPick, onToday, onClose }: GroupCalendarProps) {
  const [view, setView] = useState(() => {
    const [y, m] = day.split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  const from = `${view.year}-${pad(view.month + 1)}-01`;
  const to = `${view.year}-${pad(view.month + 1)}-${pad(new Date(view.year, view.month + 1, 0).getDate())}`;
  // The grid shows a few days either side: ask from a week before to a week after.
  const span = useMemo(() => {
    const at = (key: string, delta: number) => {
      const [y, m, d] = key.split('-').map(Number);
      return dateKey(new Date(y, m - 1, d + delta));
    };
    return { from: at(from, -7), to: at(to, 7) };
  }, [from, to]);
  const asked = useGroupPingDays(user, group.id, span.from, span.to);
  const days = useMemo(() => (me ? withMyPingDays(asked.days, me, [...myDays].filter((d) => d >= span.from && d <= span.to)) : asked.days), [asked.days, me, myDays, span]);
  const today = dateKey();

  return (
    <div className="group-calendar" role="dialog" aria-label={`${group.name} 달력`}>
      <button className="today-back" aria-label="닫기" onClick={onClose}>
        <ChevronLeft size={24} strokeWidth={2.2} aria-hidden />
      </button>
      <header className="group-calendar__head">
        <button className="cal-zoom__title group-calendar__year" aria-label="오늘로" onClick={onToday}>
          {view.year}
        </button>
        <p className="group-calendar__name">{group.name}</p>
      </header>
      <div className="group-calendar__month">
        <MonthCalendar
          counts={NO_COUNTS}
          plans={NO_PLANS}
          view={view}
          onView={setView}
          isDisabled={(key) => key > today}
          starred={(key) => (isGroupBirthday(key, group.createdAt) ? '그룹이 생긴 날' : null)}
          onPick={(key) => key <= today && onPick(key)}
          marks={(key) => {
            const faces = dayPingers(group, days[key]);
            if (!faces.length) return null;
            const more = faces.length - FACES;
            return {
              label: faces.map((m) => m.nickname).join(', '),
              node: (
                <>
                  {faces.slice(0, more > 0 ? FACES - 1 : FACES).map((m, i) => (
                    <span key={m.userId} className="calendar__face" style={{ '--i': i } as CSSProperties}>
                      <MemberFace member={m} size={18} />
                    </span>
                  ))}
                  {more > 0 && <span className="calendar__more">+{more + 1}</span>}
                </>
              ),
            };
          }}
        />
        {asked.status === 'error' && <p className="group-calendar__note">달력을 불러오지 못했어요.</p>}
      </div>
    </div>
  );
}
