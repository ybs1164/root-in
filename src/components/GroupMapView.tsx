import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Settings } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { memberColor, RAIL_FOLDED_MEMBERS, stepMember, type Group } from '../domain/groups';
import { MemberFace } from './WeNowPage';

/** Matches `pin-rail-out` in styles.css: the unfolded members stay mounted until they've tucked away. */
const OUT_MS = 160;

/** Per-button delay index, capped as on the pin rail. */
const stagger = (i: number): CSSProperties => ({ '--i': Math.min(i, 8) }) as CSSProperties;

interface GroupMapViewProps {
  group: Group;
  /** The member picked on the rail (their pings only, the map on them); null = ALL. */
  picked: string | null;
  onPick(memberId: string | null): void;
  onBack(): void;
  onSettings(): void;
}

/**
 * A group opened from We Now: the map with every member's pings and lines
 * (App draws them), and over it ‹ back, the group's name (and under it who's
 * picked), ⚙ settings with the rail right under it — ALL and the first three
 * members, ↓ for everyone (↑ folds it again) — and `<` `>` at the middle of
 * the screen's sides, one member after another. No place names or times on
 * the map, and no bottom row.
 */
export default function GroupMapView({ group, picked, onPick, onBack, onSettings }: GroupMapViewProps) {
  const pickedMember = group.members.find((m) => m.userId === picked) ?? null;
  const [open, setOpen] = useState(false);
  // Another group starts folded.
  useEffect(() => setOpen(false), [group.id]);
  // The rest trail `open` so they can tuck away (pin-rail-out) before unmounting, as the pin rail's categories do.
  const [extrasShown, setExtrasShown] = useState(open);
  useEffect(() => {
    if (open) return setExtrasShown(true);
    const t = window.setTimeout(() => setExtrasShown(false), OUT_MS);
    return () => window.clearTimeout(t);
  }, [open]);
  const foldable = group.members.length > RAIL_FOLDED_MEMBERS;
  const shown = open || extrasShown || !foldable ? group.members : group.members.slice(0, RAIL_FOLDED_MEMBERS);

  return (
    <div className="group-view">
      <button className="group-view__btn group-view__btn--back" aria-label="그룹 목록으로" onClick={onBack}>
        <ChevronLeft size={24} strokeWidth={2.2} />
      </button>
      <button className="group-view__btn group-view__btn--settings" aria-label="그룹 설정" onClick={onSettings}>
        <Settings size={22} strokeWidth={2} />
      </button>

      <div className="group-view__title">
        <h2 key={group.id}>{group.name}</h2>
        {/* Only who's picked, under the name; nothing with ALL. */}
        {pickedMember && <p>{pickedMember.nickname}</p>}
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

      <div className="group-rail" role="group" aria-label="모임원">
        <button className={`group-rail__all ${picked ? '' : 'is-on'}`} style={stagger(0)} aria-pressed={!picked} onClick={() => onPick(null)}>
          ALL
        </button>
        {shown.map((m, i) => (
          <button
            key={m.userId}
            className={`group-rail__member ${picked === m.userId ? 'is-on' : picked ? 'is-off' : ''} ${foldable && i >= RAIL_FOLDED_MEMBERS && !open ? 'is-leaving' : ''}`}
            aria-pressed={picked === m.userId}
            // The rest drop out after the first three, one after another.
            style={{ '--member': memberColor(m.slot), ...stagger(i >= RAIL_FOLDED_MEMBERS && foldable ? i - RAIL_FOLDED_MEMBERS : i + 1) } as CSSProperties}
            aria-label={m.nickname}
            onClick={() => onPick(picked === m.userId ? null : m.userId)}
          >
            <MemberFace member={m} size={44} />
          </button>
        ))}
        {foldable && (
          <button className="group-rail__more" style={stagger(RAIL_FOLDED_MEMBERS + 1)} aria-label={open ? '모임원 접기' : '모임원 모두 보기'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? <ChevronUp size={22} strokeWidth={2.2} /> : <ChevronDown size={22} strokeWidth={2.2} />}
          </button>
        )}
      </div>
    </div>
  );
}
