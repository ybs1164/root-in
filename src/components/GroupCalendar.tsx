import { ChevronLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { dayPingers, GROUP_LIMITS, isGroupBirthday, memberColor, memberInk, photoKey, photoPlaces, pingPhotos, withMyPingDays, type Group, type GroupMember } from '../domain/groups';
import { dateKey } from '../domain/diary';
import { useGroupPingDays, useGroupsOnDay } from '../hooks/useGroups';
import type { AuthUser } from '../services/authService';
import WeekCalendar, { cardRoute, weekCardDay, type CalendarPhoto, type CalendarPhotos } from './WeekCalendar';
import GroupDayMap from './GroupDayMap';
import { galleryDayLabel } from '../domain/gallery';
import { MemberFace } from './WeNowPage';
import { useSwipeBack } from '../hooks/useSwipeBack';

/** Faces under a day at most; more read +n. */
const FACES = 2;
/** Photos on a member's row at most. */
const ROW_PHOTOS = 3;
/** How long the calendar takes to fade away when going to a day (`group-calendar-out` in styles.css). */
const LEAVE_MS = 240;

interface GroupCalendarProps {
  group: Group;
  user: AuthUser | null;
  /** My id and the days this phone has pings of mine on (fresher than the server's copy). */
  me: string | null;
  myDays: ReadonlySet<string>;
  /** The day the map shows (picked first). */
  day: string;
  /** A day opened: the map goes to it. */
  onPick(day: string): void;
  onClose(): void;
  /** The calendars the name beside the title switches between (MY first, then my groups). */
  calendars?: readonly { id: string; name: string }[];
  onCalendar?(id: string): void;
  /** A photo on the card tapped: the app opens it big (♥ ★ 💬 and doodles, as on the group's map). */
  onPhotos?(open: CalendarPhotos): void;
}

/**
 * A group's calendar, from the ⚙'s calendar button on its map — calendar H
 * like TODAY's: the week as a strip with the faces of who sent the group a
 * photo each day (+n past two), the picked day's card under it with a row
 * per member (face, name, where, their photos). A face over the card leaves
 * that member alone on it. The card opens the map on that day; the days to
 * come can't be picked.
 */
export default function GroupCalendar({ group, user, me, myDays, day, onPick, onClose, calendars, onCalendar, onPhotos }: GroupCalendarProps) {
  const today = dateKey();
  const [pick, setPick] = useState(day);
  const [only, setOnly] = useState<string | null>(null);
  // Who pinged when: the month around the picked day, with a week either side (the open month shows a few days of its neighbours).
  const span = useMemo(() => {
    const [y, m] = pick.split('-').map(Number);
    return { from: dateKey(new Date(y, m - 1, 1 - 7)), to: dateKey(new Date(y, m, 7)) };
  }, [pick.slice(0, 7)]);
  const asked = useGroupPingDays(user, group.id, span.from, span.to);
  const days = useMemo(() => (me ? withMyPingDays(asked.days, me, [...myDays].filter((d) => d >= span.from && d <= span.to)) : asked.days), [asked.days, me, myDays, span]);
  // The picked day itself: each member's places and photos (my_groups(day)).
  const onDay = useGroupsOnDay(user, pick);
  const rows = useMemo(() => {
    const shown = onDay.groups.find((g) => g.id === group.id);
    if (!shown) return [];
    return shown.members
      .map((member) => ({ member, places: photoPlaces(member.pings) }))
      .filter((row) => row.places.length)
      .sort((a, b) => (a.places[0].at < b.places[0].at ? -1 : 1));
  }, [onDay.groups, group.id]);
  // Every photo of the day, member by member (the card's order): what a tapped photo pages through.
  const items = useMemo(
    () =>
      rows.flatMap(({ member, places }) =>
        places.flatMap((place) =>
          pingPhotos(place).map((photo): CalendarPhoto & { key: string } => ({
            key: member.userId,
            photo,
            name: place.name ?? '이름 없는 곳',
            who: member.nickname,
            face: <MemberFace member={member} size={32} />,
            date: galleryDayLabel(pick, today),
            path: photoKey(photo),
            // ♥ on someone else's photo only, as on the group's map.
            heart: member.userId !== me,
          })),
        ),
      ),
    [rows, pick, today, me],
  );
  // Doodles in my colour in this group; each doodler's in theirs now.
  const mine = group.members.find((m) => m.userId === me);
  const decorColor = mine ? `member-${mine.color % GROUP_LIMITS.members}` : null;
  const inkOf = useCallback((userId: string) => memberInk([group], userId), [group]);
  const openPhoto = (seq: number) => onPhotos?.({ seq, photos: items.map(({ key: _k, ...item }) => item), group: { decorColor, inkOf } });
  // Going to a day: the calendar fades and swells away over the map first, then the map is on that day.
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);
  const goTo = (key: string) => {
    if (leaving) return;
    setLeaving(true);
    leaveTimer.current = window.setTimeout(() => onPick(key), LEAVE_MS);
  };
  // A left-to-right swipe takes it back to the group's map, as the chat and gallery do.
  const swipeBack = useSwipeBack(onClose);

  const faces = (members: GroupMember[]) => {
    const more = members.length - FACES;
    return (
      <>
        {members.slice(0, more > 0 ? FACES - 1 : FACES).map((m, i) => (
          <span key={m.userId} className="calendar__face" style={{ '--i': i } as CSSProperties}>
            <MemberFace member={m} size={16} />
          </span>
        ))}
        {more > 0 && <span className="calendar__more">+{more + 1}</span>}
      </>
    );
  };

  return (
    <div className={`group-calendar ${leaving ? 'is-leaving' : ''}`} role="dialog" aria-label={`${group.name} 달력`} {...swipeBack}>
      <button className="today-back" aria-label="닫기" onClick={onClose}>
        <ChevronLeft size={24} strokeWidth={2.2} aria-hidden />
      </button>
      <WeekCalendar
        day={pick}
        today={today}
        onSelect={(next) => setPick(next)}
        onOpen={goTo}
        calendars={calendars}
        calendar={group.id}
        onCalendar={onCalendar}
        isDisabled={(key) => key > today}
        starred={(key) => (isGroupBirthday(key, group.createdAt) ? '그룹이 생긴 날' : null)}
        mark={(key) => {
          const who = dayPingers(group, days[key]);
          return who.length ? { node: <span className="calendar__marks">{faces(who)}</span>, label: who.map((m) => m.nickname).join(', ') } : null;
        }}
      >
        {rows.length > 1 && (
          <div className="week-card__who" data-swipe-keep>
            <button type="button" className={`week-card__all ${only ? '' : 'is-on'}`} onClick={() => setOnly(null)}>
              ALL
            </button>
            {rows.map(({ member }) => (
              <button
                key={member.userId}
                type="button"
                className={`week-card__face ${only === member.userId ? 'is-on' : ''}`}
                style={{ '--member': memberColor(member.color) } as CSSProperties}
                aria-label={member.nickname}
                aria-pressed={only === member.userId}
                onClick={() => setOnly((o) => (o === member.userId ? null : member.userId))}
              >
                <MemberFace member={member} size={30} />
              </button>
            ))}
          </div>
        )}
        {rows.length ? (
          <div className="week-card">
            {/* Only the map goes to the day (its group map); the photos open big. */}
            <div className="week-card__map" role="button" tabIndex={0} aria-label={`${weekCardDay(pick, today)} 지도 보기`} onClick={() => goTo(pick)} onKeyDown={(e) => e.key === 'Enter' && goTo(pick)}>
              <GroupDayMap lanes={rows} only={only} />
            </div>
            <div className="week-card__meta">
              <p className="week-card__label">
                {weekCardDay(pick, today)} · {rows.length}명 · {items.length} PHOTOS
              </p>
            </div>
            <ul className="week-card__lanes">
              {rows.map(({ member, places }) => {
                const first = items.findIndex((it) => it.key === member.userId);
                const photos = places.flatMap(pingPhotos);
                return (
                  <li key={member.userId} className={`week-card__lane ${only && only !== member.userId ? 'is-dim' : ''}`}>
                    <MemberFace member={member} size={30} />
                    <div className="week-card__who-text">
                      <b>{member.userId === me ? `${member.nickname} (나)` : member.nickname}</b>
                      <span>{cardRoute(places.map((p) => p.name ?? '이름 없는 곳'))}</span>
                    </div>
                    <div className="week-card__stack">
                      {photos.slice(0, ROW_PHOTOS).map((src, i) => (
                        <button key={i} type="button" className="week-card__photo" aria-label={`${member.nickname}의 사진 크게 보기`} onClick={() => openPhoto(first + i)}>
                          <img src={src} alt="" />
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className={`week-card week-card--empty ${onDay.status === 'loading' ? 'is-loading' : ''}`}>
            {onDay.status === 'error' ? '그날 사진을 불러오지 못했어요.' : onDay.status === 'loading' ? '' : '이날은 아무도 사진을 보내지 않았어요.'}
          </div>
        )}
        {asked.status === 'error' && <p className="group-calendar__note">달력을 불러오지 못했어요.</p>}
      </WeekCalendar>
    </div>
  );
}
