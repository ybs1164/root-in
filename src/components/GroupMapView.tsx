import { Camera, ChevronLeft, ChevronRight, Settings, X } from 'lucide-react';
import { useEffect, useRef, type CSSProperties } from 'react';
import { memberColor, passRoute, stepMember, type Group, type GroupMember } from '../domain/groups';
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
  /** The ping tapped on the map (its photo and place in the panel under the title); null = none. */
  place: { member: string; seq: number } | null;
  onPlace(place: { member: string; seq: number } | null): void;
  /** The panel's photo opened big over the whole screen (App holds it, for the back button). */
  photoBig: boolean;
  onPhotoBig(open: boolean): void;
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
 * member's boarding pass rises over the row: photo, name, the day's places
 * in order (the last one stronger), and the count large on the stub. Tapping the
 * picked face again lowers it (back to ALL). A tapped ping (or its photo
 * head) opens the photo panel under the title: the photo sent from there,
 * the place, who, n / N with ‹ › through their day, tied to the ping by a
 * faint thread.
 */
export default function GroupMapView({ group, picked, me, newPings, onPick, place, onPlace, photoBig, onPhotoBig, onBack, onSettings }: GroupMapViewProps) {
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

      {pickedMember && place?.member === pickedMember.userId && pickedMember.pings[place.seq] && (() => {
        const step = (dir: -1 | 1) => onPlace({ member: pickedMember.userId, seq: (place.seq + dir + pickedMember.pings.length) % pickedMember.pings.length });
        return (
          <>
            <PhotoPanel member={pickedMember} seq={place.seq} onStep={step} onOpen={() => onPhotoBig(true)} onClose={() => onPlace(null)} />
            {photoBig && <PhotoViewer member={pickedMember} seq={place.seq} onStep={step} onClose={() => onPhotoBig(false)} />}
          </>
        );
      })()}

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
  const route = passRoute(member.pings.map((p) => placeName(p.name)));
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
          {route.length > 0 ? (
            // The day's places in order, the last (where they are now) stronger.
            <p className="member-pass__route">
              {route.map((name, i) => (
                <span key={i} className={i === route.length - 1 ? 'is-last' : undefined}>
                  {i > 0 && <i aria-hidden>→</i>}
                  {name ?? '…'}
                </span>
              ))}
            </p>
          ) : (
            <p className="member-pass__route">아직 오늘 핑이 없어요</p>
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

/**
 * Under the title: the tapped ping's photo (an empty frame where none was
 * sent), the place, who, and n / N with ‹ › through their day. A faint
 * thread in their colour runs from the panel down to the ping on the map,
 * redrawn every frame from the marker so it follows pans and zooms.
 */
function PhotoPanel({ member, seq, onStep, onOpen, onClose }: { member: GroupMember; seq: number; onStep(dir: -1 | 1): void; onOpen(): void; onClose(): void }) {
  const ping = member.pings[seq];
  const panel = useRef<HTMLElement>(null);
  const thread = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const line = thread.current;
      const box = panel.current?.getBoundingClientRect();
      const marker = document.querySelector<HTMLElement>('.group-ping.is-selected');
      if (line && box && marker) {
        const at = marker.getBoundingClientRect();
        const head = Math.min(at.top, ...[...marker.children].map((c) => c.getBoundingClientRect().top));
        const height = Math.max(0, head - box.bottom - 4);
        line.style.transform = `translate(${Math.round(at.left)}px, ${Math.round(box.bottom)}px)`;
        line.style.height = `${height}px`;
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [member.userId, seq]);
  return (
    <>
      <span ref={thread} className="group-photo-thread" style={{ '--member': memberColor(member.slot) } as CSSProperties} aria-hidden />
      <section ref={panel} className="group-photo-panel" style={{ '--member': memberColor(member.slot) } as CSSProperties} aria-label={`${placeName(ping.name)} 사진`}>
        {ping.photo ? (
          // Tap the photo to see it big.
          <button key={seq} className="group-photo-panel__photo" aria-label="사진 크게 보기" onClick={onOpen}>
            <img src={ping.photo} alt="" draggable={false} />
          </button>
        ) : (
          <div key={seq} className="group-photo-panel__photo is-empty">
            <Camera size={26} strokeWidth={2} aria-hidden />
            <span>아직 사진이 없어요</span>
          </div>
        )}
        <div className="group-photo-panel__text">
          <div className="group-photo-panel__top">
            <span className="group-photo-panel__seq">
              <b>{seq + 1}</b> / {member.pings.length}
            </span>
            <button className="group-photo-panel__close" aria-label="사진 닫기" onClick={onClose}>
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>
          <strong className="group-photo-panel__name">{placeName(ping.name)}</strong>
          <div className="group-photo-panel__foot">
            <span className="group-photo-panel__who">
              <MemberFace member={member} size={22} />
              {member.nickname}
            </span>
            {member.pings.length > 1 && (
              <span className="group-photo-panel__nav">
                <button aria-label="이전 장소" onClick={() => onStep(-1)}>
                  <ChevronLeft size={22} strokeWidth={2.4} />
                </button>
                <button aria-label="다음 장소" onClick={() => onStep(1)}>
                  <ChevronRight size={22} strokeWidth={2.4} />
                </button>
              </span>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * The panel's photo big over the whole screen, on a dark veil: the photo
 * whole (not cropped), and under it the place, who and n / N with ‹ › (an
 * empty frame for a place with no photo). The veil, ✕, Esc or the back
 * button closes it, back to the panel.
 */
function PhotoViewer({ member, seq, onStep, onClose }: { member: GroupMember; seq: number; onStep(dir: -1 | 1): void; onClose(): void }) {
  const ping = member.pings[seq];
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onStep(-1);
      else if (e.key === 'ArrowRight') onStep(1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose, onStep]);
  return (
    <div className="group-photo-viewer" role="dialog" aria-modal="true" aria-label={`${placeName(ping.name)} 사진`} onClick={onClose}>
      <button className="group-photo-viewer__close" aria-label="닫기" onClick={onClose}>
        <X size={22} strokeWidth={2.4} />
      </button>
      <figure className="group-photo-viewer__figure" onClick={(e) => e.stopPropagation()}>
        <div key={seq} className={`group-photo-viewer__photo ${ping.photo ? '' : 'is-empty'}`}>
          {ping.photo ? (
            <img src={ping.photo} alt="" draggable={false} />
          ) : (
            <>
              <Camera size={34} strokeWidth={2} aria-hidden />
              <span>아직 사진이 없어요</span>
            </>
          )}
        </div>
        <figcaption className="group-photo-viewer__caption">
          <MemberFace member={member} size={32} />
          <span className="group-photo-viewer__text">
            <strong>{placeName(ping.name)}</strong>
            <span>
              {member.nickname} · {seq + 1} / {member.pings.length}
            </span>
          </span>
          {member.pings.length > 1 && (
            <span className="group-photo-viewer__nav">
              <button aria-label="이전 장소" onClick={() => onStep(-1)}>
                <ChevronLeft size={26} strokeWidth={2.4} />
              </button>
              <button aria-label="다음 장소" onClick={() => onStep(1)}>
                <ChevronRight size={26} strokeWidth={2.4} />
              </button>
            </span>
          )}
        </figcaption>
      </figure>
    </div>
  );
}
