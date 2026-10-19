import { Plus, UserRound, Users } from 'lucide-react';
import { useRef, useState, type CSSProperties } from 'react';
import type { PinIcon, PinTint } from '../types/pin';
import { groupPingCount, memberColor, tilePaths, type Group, type GroupMember } from '../domain/groups';
import { edgeKey, pingKey, type DayPing } from '../domain/dayPings';
import { dateKey } from '../domain/diary';
import { loadDays, saveDays, type DayStore } from '../services/dayRepository';
import DayPings from './DayPings';
import { ProfileAvatar } from './ProfileSheet';
import type { GroupsStatus } from '../hooks/useGroups';

/** A member's round profile photo in their colour's ring (the default picture without one). */
export function MemberFace({ member, size }: { member: GroupMember; size: number }) {
  return (
    <span className={`member-face ${member.photo ? '' : 'member-face--default'}`} style={{ '--member': memberColor(member.slot), width: size, height: size } as CSSProperties}>
      {member.photo ? <img src={member.photo} alt="" /> : <UserRound size={Math.round(size * 0.6)} aria-hidden />}
    </span>
  );
}

const TILE = 100;

/** The tile's background: one of four soft area-map patterns (`Group.cover`). */
export function GroupCover({ cover }: { cover: number }) {
  switch (cover) {
    case 1:
      return <path className="group-cover__water" d="M-5 58 Q30 74 55 60 T105 56 V105 H-5Z" />;
    case 2:
      return (
        <>
          <rect className="group-cover__area" x="6" y="6" width="40" height="40" rx="10" />
          <rect className="group-cover__other" x="54" y="6" width="40" height="88" rx="10" />
          <rect className="group-cover__area" x="6" y="54" width="40" height="40" rx="10" />
        </>
      );
    case 3:
      return <path className="group-cover__other" d="M-5 30 L105 78 V105 H-5Z" />;
    default:
      return (
        <>
          <path className="group-cover__other" d="M-5 30 Q30 20 50 40 T105 35 V-5 H-5Z" />
          <path className="group-cover__area" d="M-5 70 Q40 55 60 80 T105 75 V105 H-5Z" />
        </>
      );
  }
}

function GroupTile({ group, onOpen }: { group: Group; onOpen: () => void }) {
  const paths = tilePaths(group, TILE);
  const pings = groupPingCount(group);
  const shown = group.members.slice(0, 3);
  const more = group.members.length - shown.length;
  return (
    <button className="group-tile" onClick={onOpen} aria-label={`${group.name}, ${group.members.length}명, 오늘 핑 ${pings}`}>
      <svg className="group-tile__map" viewBox={`0 0 ${TILE} ${TILE}`} aria-hidden>
        <GroupCover cover={group.cover} />
        {paths.length === 0 && (
          <text className="group-tile__empty" x="50" y="54" textAnchor="middle">
            아직 오늘 핑 없음
          </text>
        )}
        {paths.map((p, i) => (
          <g key={i} style={{ '--member': p.color } as CSSProperties}>
            {p.points.length > 1 && <polyline className="group-tile__line" points={p.points.map((q) => q.join(',')).join(' ')} />}
            {p.points.map(([x, y], k) => (
              <circle key={k} className="group-tile__dot" cx={x} cy={y} r={k === p.points.length - 1 ? 5 : 3.5} />
            ))}
          </g>
        ))}
      </svg>
      <span className="group-tile__body">
        <span className="group-tile__name">{group.name}</span>
        <span className="group-tile__meta">
          <span className="group-tile__faces">
            {shown.map((m) => (
              <MemberFace key={m.userId} member={m} size={22} />
            ))}
            {more > 0 && <span className="group-tile__more">+{more}</span>}
          </span>
          <span className={`group-tile__count ${pings ? 'is-live' : ''}`}>{pings}</span>
        </span>
      </span>
    </button>
  );
}

/**
 * The TODAY tile over the groups (test build, 2026-10-19): a full-width card,
 * about half the screen, with today's real pings on it — the same drawing as
 * TODAY, and tapping a ping or a line changes its shape or style there and
 * then (saved to the day, as on TODAY). Not a group: a tap anywhere else on
 * the card opens TODAY itself, full screen.
 */
function TodayTile({ pings, pinLookOf, onOpen }: { pings: DayPing[]; pinLookOf: (ping: DayPing) => { icon: PinIcon; color: PinTint }; onOpen: () => void }) {
  const today = dateKey();
  const [days, setDays] = useState<DayStore>(loadDays);
  const change = (next: (d: DayStore) => DayStore) =>
    setDays((d) => {
      const after = next(d);
      saveDays(after);
      return after;
    });
  const decor = days.decor[today];
  // A press on a ping, a line or an open picker (its backdrop too) is the drawing's, not the card's.
  const own = useRef(false);
  return (
    <div
      className="today-tile"
      role="button"
      tabIndex={0}
      aria-label={`TODAY 열기, 오늘 핑 ${pings.length}`}
      onPointerDownCapture={(e) => {
        own.current = !!(e.target as Element).closest('.ping, .pings__hitline, .ping-picker, .ping-picker__backdrop, .ping__delete');
      }}
      onClick={() => {
        if (own.current) return void (own.current = false);
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <svg className="today-tile__map" viewBox={`0 0 ${TILE} ${TILE}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
        <GroupCover cover={0} />
      </svg>
      <span className="today-tile__title" aria-hidden>
        TODAY
      </span>
      {pings.length === 0 ? (
        <span className="today-tile__empty">아직 오늘 핑 없음</span>
      ) : (
        <div className="today-tile__pings">
          <DayPings
            pings={pings}
            shapeOf={(ping) => days.shapes[pingKey(today, ping)] ?? 'pin'}
            onShape={(ping, shape) => change((d) => ({ ...d, shapes: { ...d.shapes, [pingKey(today, ping)]: shape } }))}
            edgeStyleOf={(from, to) => days.edges[edgeKey(today, from, to)] ?? 'solid'}
            onEdgeStyle={(from, to, style) => change((d) => ({ ...d, edges: { ...d.edges, [edgeKey(today, from, to)]: style } }))}
            pinLookOf={pinLookOf}
            pressable={() => true}
            showNames={!decor?.hideNames}
            showTimes={!decor?.hideTimes}
          />
        </div>
      )}
      <span className={`group-tile__count today-tile__count ${pings.length ? 'is-live' : ''}`}>{pings.length}</span>
    </div>
  );
}

interface WeNowPageProps {
  status: GroupsStatus;
  /** My pings today, for the TODAY tile. */
  todayPings: DayPing[];
  /** A ping's own pin icon and colour (its 투명 look). */
  pinLookOf(ping: DayPing): { icon: PinIcon; color: PinTint };
  onToday(): void;
  groups: Group[];
  /** My profile photo, for the profile button top right (as on the map). */
  photo: string | null;
  onProfile(): void;
  onOpen(id: string): void;
  onCreate(): void;
  /** 카카오로 로그인 (only shown when We Now needs a login, VITE_GROUPS_NEED_LOGIN). */
  onSignIn(): void;
  onRetry(): void;
}

/**
 * We Now's first screen: my groups as a two-column grid of tiles, each with
 * a little map of its members' pings today (what opening it shows), and a +
 * tile for a new one. Signed out it asks for a Kakao login — reached only
 * when VITE_GROUPS_NEED_LOGIN is on; otherwise App signs in as a guest first.
 */
export default function WeNowPage({ status, todayPings, pinLookOf, onToday, groups, photo, onProfile, onOpen, onCreate, onSignIn, onRetry }: WeNowPageProps) {
  const empty = (title: string, body: string, action?: { label: string; run: () => void }) => (
    <div className="we-now__empty">
      <span className="we-now__badge" aria-hidden>
        <Users size={30} strokeWidth={2} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && (
        <button className="we-now__cta" onClick={action.run}>
          {action.label}
        </button>
      )}
    </div>
  );

  let content;
  if (status === 'unavailable') content = empty('그룹을 쓸 수 없어요', '이 앱에는 서버 연결이 없어서\n그룹 기능이 꺼져 있어요.');
  else if (status === 'signed-out')
    content = empty('함께 보는 오늘', '로그인하면 그룹을 만들고\n친구들의 오늘 핑을 한 지도에서 볼 수 있어요.', { label: '카카오로 로그인', run: onSignIn });
  else if (status === 'loading') content = <p className="we-now__note">불러오는 중…</p>;
  else if (status === 'error' && groups.length === 0)
    content = empty('그룹을 불러오지 못했어요', '잠시 뒤에 다시 시도해 주세요.', { label: '다시 시도', run: onRetry });
  // No groups yet: the same grid, with only its + tile.
  else
    content = (
      <div className="we-now__grid">
        {groups.map((g) => (
          <GroupTile key={g.id} group={g} onOpen={() => onOpen(g.id)} />
        ))}
        <button className="group-tile group-tile--new" onClick={onCreate}>
          <span className="group-tile__plus" aria-hidden>
            <Plus size={26} strokeWidth={2.4} />
          </span>
          새 그룹
        </button>
      </div>
    );

  return (
    <>
      <button className="corner-btn corner-btn--profile" aria-label="프로필" onClick={onProfile}>
        <ProfileAvatar photo={photo} size={52} />
      </button>
      <div className="we-now">
        <div className="we-now__today">
          <TodayTile pings={todayPings} pinLookOf={pinLookOf} onOpen={onToday} />
        </div>
        {content}
      </div>
    </>
  );
}
