import { ChevronLeft, Images } from 'lucide-react';
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { dayPosters, galleryDayLabel, galleryTabDays, viewerOrder, type GalleryItem, type GalleryPhoto, type GalleryTab } from '../domain/gallery';
import { memberColor, type Group, type GroupMember } from '../domain/groups';
import { centeredScrollLeft } from '../domain/routeFolders';
import type { GalleryState } from '../hooks/useGalleryPhotos';
import { dateKey } from '../domain/diary';
import { MemberFace } from './WeNowPage';
import PhotoViewer from './PhotoViewer';

interface PhotoGalleryProps {
  /** Every group I'm in: a tab each, after MY. */
  groups: Group[];
  /** My user id (null: never signed in, so MY is only TODAY's photos on this phone). */
  me: string | null;
  /** My face and name on my own photos. */
  meMember: GroupMember;
  tab: GalleryTab;
  onTab(tab: GalleryTab): void;
  /** The photos sent to all of `groups`. */
  state: GalleryState;
  onRetry(): void;
  /** TODAY's photos kept on this phone, in MY. */
  local: GalleryPhoto[];
  /** The photo open big, in the viewer's order (oldest first; App holds it, for the back button); null = the grid. */
  seq: number | null;
  onSeq(seq: number | null): void;
  onClose(): void;
}

/** Someone no longer in the group: no face, a neutral name. */
const goneMember = (userId: string): GroupMember => ({ userId, slot: 0, nickname: '나간 그룹원', alias: null, photo: null, pings: [] });

/**
 * The camera's photos over the whole screen: ‹ back and GALLERY, then index
 * tabs as on the route folders — MY (what I sent, and TODAY's photos on this
 * phone) and one per group — and under them a heading per day (newest
 * first) over a grid of squares, each with the sender's face in the corner.
 * A photo sent to several groups shows once in MY. Tapping one opens it big;
 * there the newest is furthest right and paging back runs on through the
 * days before, the day over the photo.
 */
export default function PhotoGallery({ groups, me, meMember, tab, onTab, state, onRetry, local, seq, onSeq, onClose }: PhotoGalleryProps) {
  const ready = state.status === 'ready' || tab === 'my';
  const days = useMemo(
    () => galleryTabDays(tab, state.status === 'ready' ? state.photos : [], me, local),
    [tab, state, me, local],
  );
  const viewer = useMemo(() => viewerOrder(days), [days]);
  const byGroup = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const who = (item: GalleryItem): GroupMember => {
    if (item.userId === meMember.userId || (me && item.userId === me)) return meMember;
    for (const id of item.groupIds) {
      const m = byGroup.get(id)?.members.find((x) => x.userId === item.userId);
      if (m) return m;
    }
    return goneMember(item.userId);
  };
  // Where it went: this tab's group, or (MY) every group it was sent to; TODAY for one that stayed on the phone.
  const where = (item: GalleryItem) =>
    tab !== 'my' ? (byGroup.get(tab)?.name ?? '') : item.groupIds.length ? item.groupIds.map((id) => byGroup.get(id)?.name).filter(Boolean).join(', ') : 'TODAY';

  useEffect(() => {
    if (seq !== null) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [seq, onClose]);

  // The open tab comes to the middle of the row (or as near as its ends allow).
  const tabsEl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = tabsEl.current;
    const el = row?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(tab)}"]`);
    if (row && el) row.scrollTo({ left: centeredScrollLeft(el.offsetLeft, el.offsetWidth, row.clientWidth, row.scrollWidth), behavior: 'smooth' });
  }, [tab]);

  const today = dateKey();
  const tabs: { id: GalleryTab; label: string }[] = [{ id: 'my', label: 'MY' }, ...groups.map((g) => ({ id: g.id, label: g.name }))];
  return (
    <div className="gallery" role="dialog" aria-modal="true" aria-label="갤러리">
      <header className="gallery__head">
        <button className="gallery__back" aria-label="닫기" onClick={onClose}>
          <ChevronLeft size={24} strokeWidth={2.2} />
        </button>
        <h2 className="gallery__title">GALLERY</h2>
      </header>

      <div ref={tabsEl} className="route-folders__tabs gallery__tabs" role="tablist" aria-label="갤러리">
        {tabs.map((t) => (
          <button
            key={t.id}
            data-tab={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`route-folders__tab ${tab === t.id ? 'is-on' : ''} ${t.id === 'my' ? 'gallery__tab--my' : ''}`}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="gallery__body" role="tabpanel">
        {!ready && state.status === 'loading' && <p className="gallery__note">사진을 불러오는 중…</p>}
        {!ready && state.status === 'error' && (
          <p className="gallery__note">
            사진을 불러오지 못했어요
            <button className="gallery__retry" onClick={onRetry}>
              다시 시도
            </button>
          </p>
        )}
        {ready && !days.length && (
          <div className="gallery__empty">
            <Images size={34} strokeWidth={1.8} aria-hidden />
            <p>{tab === 'my' ? '아직 내 사진이 없어요' : '아직 주고받은 사진이 없어요'}</p>
            <small>카메라로 찍어 그룹에 보내면 여기에 날짜별로 모여요.</small>
          </div>
        )}
        {days.map((d) => (
          <section key={d.day} className="gallery__day" aria-label={galleryDayLabel(d.day, today)}>
            <h3 className="gallery__date">
              {galleryDayLabel(d.day, today)}
              {/* Who put photos up that day, in place of a count. */}
              <span className="gallery__posters">
                {dayPosters(d.photos).map((id) => {
                  const member = who(d.photos.find((p) => p.userId === id)!);
                  return (
                    <span key={id} className="gallery__poster" title={member.nickname} style={{ '--member': memberColor(member.slot) } as CSSProperties}>
                      <MemberFace member={member} size={24} />
                    </span>
                  );
                })}
              </span>
            </h3>
            <div className="gallery__grid">
              {d.photos.map((p) => {
                const member = who(p);
                return (
                  <button
                    key={p.path}
                    className="gallery__photo"
                    style={{ '--member': memberColor(member.slot) } as CSSProperties}
                    aria-label={`${p.name}, ${member.nickname}`}
                    onClick={() => onSeq(viewer.indexOf(p))}
                  >
                    <img src={p.url} alt="" loading="lazy" draggable={false} />
                    <span className="gallery__face">
                      <MemberFace member={member} size={22} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {seq !== null && viewer[seq] && (
        <PhotoViewer
          items={viewer.map((p) => {
            const member = who(p);
            const to = where(p);
            return {
              photo: p.url,
              name: p.name,
              who: to ? `${member.nickname} | ${to}` : member.nickname,
              face: <MemberFace member={member} size={32} />,
              date: galleryDayLabel(p.day, today),
            };
          })}
          seq={seq}
          onSeq={onSeq}
          onClose={() => onSeq(null)}
          prevLabel="이전 사진"
          nextLabel="다음 사진"
          counted={false}
        />
      )}
    </div>
  );
}

/** The gallery's button at the bottom-left (TODAY's row, a group's map), the camera's twin. */
export function GalleryButton({ className = '', onOpen }: { className?: string; onOpen(): void }) {
  return (
    <button type="button" className={`camera-btn ${className}`} aria-label="갤러리" onClick={onOpen}>
      <Images size={24} strokeWidth={2.2} aria-hidden />
    </button>
  );
}
