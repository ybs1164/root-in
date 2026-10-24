import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { useEffect, useRef, type CSSProperties } from 'react';
import { memberColor, stepMember, type Group, type GroupMember } from '../domain/groups';
import { MemberFace } from './WeNowPage';
import CameraButton from './CameraButton';

/** Per-button delay index, capped as on the pin rail. */
const stagger = (i: number): CSSProperties => ({ '--i': Math.min(i, 8) }) as CSSProperties;

const placeName = (name: string | undefined) => name || '이름 없는 곳';

interface GroupMapViewProps {
  group: Group;
  /** The member picked on the rail (their pings only, the map on them); null = ALL. */
  picked: string | null;
  /** My user id: my pass reads ME. */
  me: string | null;
  /** A face's badge: their pings since I last picked them (App keeps what was seen). */
  newPings(member: GroupMember): number;
  onPick(memberId: string | null): void;
  onBack(): void;
  onSettings(): void;
}

/**
 * A group opened from We Now: the map with every member's pings and lines
 * (App draws them), and over it ‹ back, the group's name (only the name —
 * the pass says who's picked),
 * ⚙ settings, `<` `>` either side of the pass, one member after another,
 * the camera fixed at the bottom-right, and the member row
 * along the bottom: ALL then every member's face, each its own button with
 * a badge of their new pings since I last picked them, scrolled sideways when they don't fit. The picked
 * member's boarding pass rises over the row: photo, name, the day's first →
 * last place, the last one, and the count large on the stub. Tapping the
 * picked face again lowers it (back to ALL).
 */
export default function GroupMapView({ group, picked, me, newPings, onPick, onBack, onSettings }: GroupMapViewProps) {
  const pickedMember = group.members.find((m) => m.userId === picked) ?? null;
  // The picked face is scrolled into the middle of the row, however it was picked (row, < >, the map).
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = row.current;
    const el = box?.querySelector<HTMLElement>(picked ? `[data-member="${CSS.escape(picked)}"]` : '.group-rail__all');
    if (!box || !el) return;
    box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2, behavior: 'smooth' });
  }, [picked]);

  return (
    <div className={`group-view ${pickedMember ? 'has-pass' : ''}`}>
      <button className="group-view__btn group-view__btn--back" aria-label="그룹 목록으로" onClick={onBack}>
        <ChevronLeft size={24} strokeWidth={2.2} />
      </button>
      <button className="group-view__btn group-view__btn--settings" aria-label="그룹 설정" onClick={onSettings}>
        <Settings size={22} strokeWidth={2} />
      </button>

      <div className="group-view__title">
        <h2 key={group.id}>{group.name}</h2>
      </div>

      {group.members.length > 0 && (
        <>
          <button className="route-step route-step--prev group-view__step" aria-label="이전 그룹원" onClick={() => onPick(stepMember(group, picked, -1))}>
            <ChevronLeft size={34} strokeWidth={2.4} />
          </button>
          <button className="route-step route-step--next group-view__step" aria-label="다음 그룹원" onClick={() => onPick(stepMember(group, picked, 1))}>
            <ChevronRight size={34} strokeWidth={2.4} />
          </button>
        </>
      )}

      <CameraButton className="group-view__camera" />

      {pickedMember && <MemberPass key={pickedMember.userId} member={pickedMember} mine={pickedMember.userId === me} />}

      <div ref={row} className="group-rail" role="group" aria-label="모임원">
        <button className={`group-rail__all ${picked ? '' : 'is-on'}`} style={stagger(0)} aria-pressed={!picked} onClick={() => onPick(null)}>
          ALL
        </button>
        {group.members.map((m, i) => {
          const fresh = newPings(m);
          return (
            <button
              key={m.userId}
              data-member={m.userId}
              className={`group-rail__member ${picked === m.userId ? 'is-on' : ''}`}
              aria-pressed={picked === m.userId}
              style={{ '--member': memberColor(m.slot), ...stagger(i + 1) } as CSSProperties}
              aria-label={fresh ? `${m.nickname}, 새 핑 ${fresh}개` : m.nickname}
              onClick={() => onPick(picked === m.userId ? null : m.userId)}
            >
              <MemberFace member={m} size={46} />
              {fresh > 0 && <span className="group-rail__count">{fresh}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The picked member's boarding pass over the row. */
function MemberPass({ member, mine }: { member: GroupMember; mine: boolean }) {
  const first = member.pings[0];
  const last = member.pings[member.pings.length - 1];
  return (
    <section className="member-pass" style={{ '--member': memberColor(member.slot) } as CSSProperties} aria-label={`${member.nickname}의 오늘`}>
      <div className="member-pass__ticket">
        <div className="member-pass__main">
          <div className="member-pass__who">
            <MemberFace member={member} size={48} />
            <div>
              <span className="member-pass__tag">TODAY · {mine ? 'ME' : 'MEMBER'}</span>
              <strong className="member-pass__name">{member.nickname}</strong>
            </div>
          </div>
          {last ? (
            <>
              <p className="member-pass__route">
                {placeName(first.name)}
                {member.pings.length > 1 && (
                  <>
                    <i aria-hidden>→</i>
                    {placeName(last.name)}
                  </>
                )}
              </p>
              <p className="member-pass__last">
                <small>LAST</small>
                {placeName(last.name)}
              </p>
            </>
          ) : (
            <p className="member-pass__last">아직 오늘 핑이 없어요</p>
          )}
        </div>
        <div className="member-pass__stub">
          <span className="member-pass__count">{member.pings.length}</span>
          <small>PLACES</small>
        </div>
      </div>
    </section>
  );
}
