import { ChevronLeft, Images, MapPin, Search, Star, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { dayPosters, filterGallery, galleryDayLabel, galleryTabDays, metDays, placeSuggestions, viewerOrder, type GalleryItem, type GalleryPhoto, type GalleryTab } from '../domain/gallery';
import { memberColor, memberInk, type Group, type GroupMember } from '../domain/groups';
import { centeredScrollLeft } from '../domain/routeFolders';
import { useGalleryDecors, useMetDays, type GalleryState } from '../hooks/useGalleryPhotos';
import { usePhotoMarks } from '../hooks/usePhotoMarks';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { HighFive } from './icons';
import { dateKey } from '../domain/diary';
import { GroupCover, MemberFace } from './WeNowPage';
import PhotoViewer, { PhotoMarkButtons } from './PhotoViewer';
import { DoodleLayers } from './PhotoDoodle';

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
  /** The names of the places I've been (my pings): the search's suggestions. */
  visited: readonly string[];
  /** Open already searched for this place (a place card's gallery button). */
  place?: string | null;
  /** The photo open big, in the viewer's order (oldest first; App holds it, for the back button); null = the grid. */
  seq: number | null;
  onSeq(seq: number | null): void;
  onClose(): void;
}

/** Someone no longer in the group: no face, a neutral name. */
const goneMember = (userId: string): GroupMember => ({ userId, slot: 0, color: 0, nickname: '나간 그룹원', alias: null, photo: null, pings: [] });

/**
 * The camera's photos over the whole screen: ‹ back and GALLERY, then index
 * tabs as on the route folders — MY (TODAY's photos on this phone: every
 * camera shot goes there) and one per group — and under them a heading per day (newest
 * first) over a grid of squares, each with the sender's face in the corner.
 * Tapping one opens it big;
 * there the newest is furthest right and paging back runs on through the
 * days before, the day over the photo.
 *
 * Over the days, two switches (both may be on): 즐겨찾기 — only the photos
 * I starred (★ beside the big photo's caption; mine alone, on this phone) —
 * and 만난 날 — every photo of a day I met someone from a group (any in MY,
 * that one in its tab): we pinged the same place. A
 * heart beside the star (on someone else's photo) tells its sender; how many
 * a photo has is never shown.
 *
 * Before them a 🔍 (every tab): typing a place shows the places I've been
 * with those words in them; picking one, or searching a full name, leaves
 * only the photos taken there.
 */
export default function PhotoGallery({ groups, me, meMember, tab, onTab, state, onRetry, local, visited, place, seq, onSeq, onClose }: PhotoGalleryProps) {
  // Left to right takes the gallery back (a big photo over it has its own swipes).
  const swipeBack = useSwipeBack(onClose, seq === null);
  const ready = state.status === 'ready' || tab === 'my';
  const allDays = useMemo(
    () => galleryTabDays(tab, state.status === 'ready' ? state.photos : [], local),
    [tab, state, local],
  );
  const [starsOn, setStarsOn] = useState(false);
  const [metOn, setMetOn] = useState(false);
  // MY has no 만난 날 switch: going there turns it off.
  useEffect(() => {
    if (tab === 'my') setMetOn(false);
  }, [tab]);
  // The place search: the words typed, and the full name searched (the filter).
  const [searchOpen, setSearchOpen] = useState(!!place);
  const [query, setQuery] = useState(place ?? '');
  const [searched, setSearched] = useState<string | null>(place ?? null);
  useEffect(() => {
    if (!place) return;
    setSearchOpen(true);
    setQuery(place);
    setSearched(place);
  }, [place]);
  const searchInput = useRef<HTMLInputElement>(null);
  // Where I've been: my pings, and the photos I sent to groups.
  const placeNames = useMemo(
    () => [...visited, ...(state.status === 'ready' ? state.photos.filter((p) => p.userId === me).map((p) => p.name) : [])],
    [visited, state, me],
  );
  const suggestions = useMemo(() => (query === searched ? [] : placeSuggestions(placeNames, query)), [placeNames, query, searched]);
  const search = (name: string) => {
    const full = name.trim();
    setQuery(full);
    setSearched(full || null);
    searchInput.current?.blur();
  };
  const clearSearch = () => {
    setQuery('');
    setSearched(null);
  };
  const marks = usePhotoMarks();
  const { stars } = marks;
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
    () =>
      filterGallery(allDays, {
        stars: starsOn ? (viewStars ?? stars) : undefined,
        met: metOn ? metSet : undefined,
        place: searched ?? undefined,
      }),
    [allDays, starsOn, viewStars, stars, metOn, metSet, searched],
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
  // Each square wears its photo's doodles, every doodler in their colour now
  // — in the groups the photo went to first, else any group we share.
  const decors = useGalleryDecors(
    useMemo(() => days.flatMap((d) => d.photos.map((p) => p.path).filter((path) => !path.startsWith('ping:'))), [days]),
    seq === null,
  );
  const inkIn = useCallback(
    (item: GalleryItem) => (userId: string) =>
      memberInk(item.groupIds.flatMap((id) => byGroup.get(id) ?? []), userId) ?? memberInk(groups, userId),
    [byGroup, groups],
  );
  const viewerInk = useMemo(() => (seq !== null && viewer[seq] ? inkIn(viewer[seq]) : undefined), [seq, viewer, inkIn]);
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

  // 🔍: opens the field; with words in it, searches; empty, closes it. No animation.
  const searchButton = (
    <button
      type="button"
      className={`gallery__filter gallery__filter--search ${searchOpen ? 'is-inside' : ''}`}
      aria-label={searchOpen && query.trim() ? '검색' : '장소 검색'}
      aria-expanded={searchOpen}
      onClick={() => {
        if (!searchOpen) {
          setSearchOpen(true);
          // Straight to the keyboard (after the field is there).
          requestAnimationFrame(() => searchInput.current?.focus());
        } else if (query.trim()) {
          search(query);
        } else {
          setSearchOpen(false);
          clearSearch();
        }
      }}
    >
      <Search size={22} strokeWidth={2.2} aria-hidden />
    </button>
  );

  const today = dateKey();
  const tabs: { id: GalleryTab; label: string }[] = [{ id: 'my', label: 'MY' }, ...groups.map((g) => ({ id: g.id, label: g.name }))];
  return (
    <div className="gallery" role="dialog" aria-modal="true" aria-label="갤러리" {...swipeBack}>
      <header className="gallery__head">
        <button className="gallery__back" aria-label="닫기" onClick={onClose}>
          <ChevronLeft size={24} strokeWidth={2.2} />
        </button>
        <h2 className="gallery__title">GALLERY</h2>
      </header>

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
          <div className={`gallery__tools ${searchOpen ? 'is-searching' : ''}`}>
            {/* 🔍 opens the field across the row, 🔍 then inside its right end. */}
            {searchOpen && (
              <form
                className="gallery__search"
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  search(query);
                }}
              >
                <input
                  ref={searchInput}
                  className="gallery__search-input"
                  type="search"
                  enterKeyHint="search"
                  aria-label="장소 이름"
                  placeholder="장소 이름을 입력하세요"
                  value={query}
                  maxLength={80}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button type="button" className="gallery__search-clear" aria-label="지우기" onClick={clearSearch}>
                    <X size={16} strokeWidth={2.4} aria-hidden />
                  </button>
                )}
                {searchButton}
                {suggestions.length > 0 && (
                  <ul className="gallery__suggest" aria-label="추천 검색어">
                    {suggestions.map((name) => (
                      <li key={name}>
                        <button type="button" onClick={() => search(name)}>
                          <MapPin size={15} strokeWidth={2.2} aria-hidden />
                          <Marked text={name} words={query} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </form>
            )}
            {/* Closed, 🔍 sits in the row; open, it's inside the field's right end (searchIcon). */}
            {!searchOpen && searchButton}
            {/* Icons only, no outline; switched on, they fill and pop like the big photo's ♥ ★. */}
            <button className={`gallery__filter gallery__filter--star ${starsOn ? 'is-on' : ''}`} aria-label="즐겨찾기" aria-pressed={starsOn} onClick={() => setStarsOn((on) => !on)}>
              <Star size={22} strokeWidth={2.2} aria-hidden />
            </button>
            {/* 만난 날 is a group's: not in MY. */}
            {tab !== 'my' && (
              <button className={`gallery__filter ${metOn ? 'is-on' : ''}`} aria-label="만난 날" aria-pressed={metOn} onClick={() => setMetOn((on) => !on)}>
                <HighFive size={25} />
              </button>
            )}
          </div>
        )}
        {/* Nothing left by a switch: no explaining, the grid is just empty (a search, or 만난 날 still loading, still says so). */}
        {ready && allDays.length > 0 && !days.length && (searched || (metOn && met.status !== 'ready')) && (
          <p className="gallery__note">
            {searched
              ? `'${searched}'에서 찍은 사진이 없어요.`
              : met.status === 'loading'
                ? '만난 날을 찾는 중…'
                : '만난 날을 불러오지 못했어요.'}
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
                    {decors.get(p.path) && <DoodleLayers layers={decors.get(p.path)!} inkOf={inkIn(p)} />}
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

      <div className="gallery__rule" aria-hidden />
      {/* At the bottom (2026-11-09): the tabs are the groups' covers (MY: my photo), the open one a little bigger. */}
      <div ref={tabsEl} className="gallery__covers" role="tablist" aria-label="갤러리" data-swipe-keep>
        {tabs.map((t) => {
          const group = groups.find((g) => g.id === t.id);
          return (
            <button
              key={t.id}
              data-tab={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`gallery__cover-tab ${tab === t.id ? 'is-on' : ''} ${t.id === 'my' ? 'gallery__cover-tab--my' : ''}`}
              onClick={() => onTab(t.id)}
            >
              <span className="gallery__cover" aria-hidden>
                {group ? (
                  <svg viewBox="0 0 100 100">
                    <GroupCover cover={group.cover} photo={group.coverPhoto} />
                  </svg>
                ) : (
                  meMember.photo && <img src={meMember.photo} alt="" draggable={false} />
                )}
              </span>
              <span className="gallery__cover-name">{t.label}</span>
            </button>
          );
        })}
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
          commentPath={viewer[seq].path}
          // The doodles show here, but aren't drawn on (that's on the group's map or 대화).
          decorPath={viewer[seq].path.startsWith('ping:') ? null : viewer[seq].path}
          inkOf={viewerInk}
          side={
            // Hearts go to someone else's photo sent to a group: never mine, nor one that stayed on this phone.
            <PhotoMarkButtons
              path={viewer[seq].path}
              heart={viewer[seq].userId !== me && viewer[seq].userId !== meMember.userId && viewer[seq].groupIds.length > 0}
              marks={marks}
            />
          }
        />
      )}
    </div>
  );
}

/** A suggestion with the typed words in bold. */
function Marked({ text, words }: { text: string; words: string }) {
  const at = text.toLowerCase().indexOf(words.trim().toLowerCase());
  if (at < 0 || !words.trim()) return <span>{text}</span>;
  const end = at + words.trim().length;
  return (
    <span>
      {text.slice(0, at)}
      <b>{text.slice(at, end)}</b>
      {text.slice(end)}
    </span>
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
