import { ChevronLeft, Heart, Images, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { dayPosters, filterGallery, galleryDayLabel, galleryTabDays, metDays, viewerOrder, type GalleryItem, type GalleryPhoto, type GalleryTab } from '../domain/gallery';
import { memberColor, type Group, type GroupMember } from '../domain/groups';
import { centeredScrollLeft } from '../domain/routeFolders';
import { useMetDays, type GalleryState } from '../hooks/useGalleryPhotos';
import { groupService } from '../services/groupService';
import { loadGalleryStars, saveGalleryStars } from '../services/galleryStarRepository';
import { HighFive } from './icons';
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
const goneMember = (userId: string): GroupMember => ({ userId, slot: 0, color: 0, nickname: '나간 그룹원', alias: null, photo: null, pings: [] });

/**
 * The camera's photos over the whole screen: ‹ back and GALLERY, then index
 * tabs as on the route folders — MY (what I sent, and TODAY's photos on this
 * phone) and one per group — and under them a heading per day (newest
 * first) over a grid of squares, each with the sender's face in the corner.
 * A photo sent to several groups shows once in MY. Tapping one opens it big;
 * there the newest is furthest right and paging back runs on through the
 * days before, the day over the photo.
 *
 * Over the days, two switches (both may be on): 즐겨찾기 — only the photos
 * I starred (★ beside the big photo's caption; mine alone, on this phone) —
 * and 만난 날 — every photo of a day I met someone from a group (any in MY,
 * that one in its tab): we pinged the same place. A
 * heart beside the star (on someone else's photo) tells its sender; how many
 * a photo has is never shown.
 */
export default function PhotoGallery({ groups, me, meMember, tab, onTab, state, onRetry, local, seq, onSeq, onClose }: PhotoGalleryProps) {
  const ready = state.status === 'ready' || tab === 'my';
  const allDays = useMemo(
    () => galleryTabDays(tab, state.status === 'ready' ? state.photos : [], me, local),
    [tab, state, me, local],
  );
  const [starsOn, setStarsOn] = useState(false);
  const [metOn, setMetOn] = useState(false);
  const [stars, setStars] = useState(() => new Set(loadGalleryStars()));
  const toggleStar = (path: string) =>
    setStars((now) => {
      const next = new Set(now);
      if (!next.delete(path)) next.add(path);
      saveGalleryStars([...next]);
      return next;
    });
  // Hearts: on other people's photos, telling the sender (no count shown anywhere).
  const [hearts, setHearts] = useState<Set<string>>(new Set());
  useEffect(() => {
    let live = true;
    void groupService.hearted().then((paths) => live && paths !== 'error' && setHearts(new Set(paths)));
    return () => {
      live = false;
    };
  }, []);
  const toggleHeart = (path: string) => {
    const on = !hearts.has(path);
    const flip = (want: boolean) =>
      setHearts((now) => {
        const next = new Set(now);
        if (want) next.add(path);
        else next.delete(path);
        return next;
      });
    flip(on);
    // Didn't go through: back as it was.
    void groupService.heart(path, on).then((ok) => ok || flip(!on));
  };
  // While a photo is open big, 즐겨찾기 keeps what it showed when it opened:
  // taking a star off doesn't pull the photo out from under the finger.
  const [viewStars, setViewStars] = useState<Set<string> | null>(null);
  useEffect(() => setViewStars((v) => (seq === null ? null : (v ?? stars))), [seq, stars]);
  const groupIds = useMemo(() => groups.map((g) => g.id), [groups]);
  const met = useMetDays(
    groupIds,
    useMemo(() => allDays.map((d) => d.day), [allDays]),
    metOn,
  );
  const metSet = useMemo(() => (metOn ? metDays(met.pairs, tab, me) : undefined), [metOn, met.pairs, tab, me]);
  const days = useMemo(
    () => filterGallery(allDays, { stars: starsOn ? (viewStars ?? stars) : undefined, met: metOn ? metSet : undefined }),
    [allDays, starsOn, viewStars, stars, metOn, metSet],
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
        {ready && allDays.length > 0 && (
          <div className="gallery__tools">
            {/* Icons only; switched on, the accent. */}
            <button className={`gallery__filter ${starsOn ? 'is-on' : ''}`} aria-label="즐겨찾기" aria-pressed={starsOn} onClick={() => setStarsOn((on) => !on)}>
              <Star size={18} strokeWidth={2.2} aria-hidden />
            </button>
            <button className={`gallery__filter ${metOn ? 'is-on' : ''}`} aria-label="만난 날" aria-pressed={metOn} onClick={() => setMetOn((on) => !on)}>
              <HighFive size={21} />
            </button>
          </div>
        )}
        {ready && allDays.length > 0 && !days.length && (
          <p className="gallery__note">
            {metOn && met.status === 'loading'
              ? '만난 날을 찾는 중…'
              : metOn && met.status === 'error'
                ? '만난 날을 불러오지 못했어요.'
                : starsOn && metOn
                  ? '만난 날에 즐겨찾기한 사진이 없어요.'
                  : starsOn
                    ? '즐겨찾기한 사진이 없어요. 큰 사진의 ☆를 눌러 보세요.'
                    : '아직 만난 날이 없어요. 같은 곳에서 핑을 찍으면 만난 날이 돼요.'}
          </p>
        )}
        {ready && !allDays.length && (
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
                    <span key={id} className="gallery__poster" title={member.nickname} style={{ '--member': memberColor(member.color) } as CSSProperties}>
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
                    style={{ '--member': memberColor(member.color) } as CSSProperties}
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
            // Who sent it, by name only — not the group it went to.
            return {
              photo: p.url,
              name: p.name,
              who: member.nickname,
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
          side={
            <span className="gallery__marks">
              {/* Hearts go to someone else's photo sent to a group: never mine, nor one that stayed on this phone. */}
              {viewer[seq].userId !== me && viewer[seq].userId !== meMember.userId && viewer[seq].groupIds.length > 0 && (
                <button
                  className={`gallery__mark gallery__heart ${hearts.has(viewer[seq].path) ? 'is-on' : ''}`}
                  aria-label="하트"
                  aria-pressed={hearts.has(viewer[seq].path)}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHeart(viewer[seq].path);
                  }}
                >
                  <Heart size={27} strokeWidth={2} aria-hidden />
                </button>
              )}
              <button
                className={`gallery__mark gallery__star ${stars.has(viewer[seq].path) ? 'is-on' : ''}`}
                aria-label="즐겨찾기"
                aria-pressed={stars.has(viewer[seq].path)}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStar(viewer[seq].path);
                }}
              >
                <Star size={28} strokeWidth={2} aria-hidden />
              </button>
            </span>
          }
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
