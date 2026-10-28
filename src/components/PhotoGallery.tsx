import { ChevronLeft, Images } from 'lucide-react';
import { useEffect, useMemo, type CSSProperties } from 'react';
import { galleryDayLabel, galleryDays, type GalleryItem } from '../domain/gallery';
import { memberColor, type Group, type GroupMember } from '../domain/groups';
import type { GalleryState } from '../hooks/useGalleryPhotos';
import { dateKey } from '../domain/diary';
import { MemberFace } from './WeNowPage';
import PhotoViewer from './PhotoViewer';

interface PhotoGalleryProps {
  /** Whose photos: one group's, or (TODAY) every group I'm in. */
  groups: Group[];
  /** The one group's name under the title; null = all my groups (TODAY). */
  groupName: string | null;
  state: GalleryState;
  onRetry(): void;
  /** The photo open big (App holds it, for the back button); null = the grid. */
  seq: number | null;
  onSeq(seq: number | null): void;
  onClose(): void;
}

/** Someone no longer in the group: no face, a neutral name. */
const goneMember = (userId: string): GroupMember => ({ userId, slot: 0, nickname: '나간 그룹원', alias: null, photo: null, pings: [] });

/**
 * The photos sent to a group from the camera (or, from TODAY, to any of my
 * groups), over the whole screen: ‹ back, GALLERY and whose, then a heading
 * per day (newest first) over a grid of square thumbnails, each with the
 * sender's face in the corner. A photo sent to several groups shows once.
 * Tapping one opens it big, paging through every photo in the gallery's order.
 */
export default function PhotoGallery({ groups, groupName, state, onRetry, seq, onSeq, onClose }: PhotoGalleryProps) {
  const days = useMemo(() => (state.status === 'ready' ? galleryDays(state.photos) : []), [state]);
  const flat = useMemo(() => days.flatMap((d) => d.photos), [days]);
  const who = useMemo(() => {
    const byGroup = new Map(groups.map((g) => [g.id, g]));
    return (item: GalleryItem): GroupMember => {
      for (const id of item.groupIds) {
        const m = byGroup.get(id)?.members.find((x) => x.userId === item.userId);
        if (m) return m;
      }
      return goneMember(item.userId);
    };
  }, [groups]);
  const groupNames = (item: GalleryItem) =>
    item.groupIds.map((id) => groups.find((g) => g.id === id)?.name).filter((n): n is string => !!n).join(', ');

  useEffect(() => {
    if (seq !== null) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [seq, onClose]);

  const today = dateKey();
  let index = 0;
  return (
    <div className="gallery" role="dialog" aria-modal="true" aria-label={groupName ? `${groupName} 갤러리` : '갤러리'}>
      <header className="gallery__head">
        <button className="gallery__back" aria-label="닫기" onClick={onClose}>
          <ChevronLeft size={24} strokeWidth={2.2} />
        </button>
        <div className="gallery__title">
          <h2>GALLERY</h2>
          <span>{groupName ?? '모든 그룹'}</span>
        </div>
      </header>

      <div className="gallery__body">
        {state.status === 'loading' && <p className="gallery__note">사진을 불러오는 중…</p>}
        {state.status === 'error' && (
          <p className="gallery__note">
            사진을 불러오지 못했어요
            <button className="gallery__retry" onClick={onRetry}>
              다시 시도
            </button>
          </p>
        )}
        {state.status === 'ready' && !flat.length && (
          <div className="gallery__empty">
            <Images size={34} strokeWidth={1.8} aria-hidden />
            <p>아직 주고받은 사진이 없어요</p>
            <small>카메라로 찍어 그룹에 보내면 여기에 날짜별로 모여요.</small>
          </div>
        )}
        {days.map((d) => (
          <section key={d.day} className="gallery__day" aria-label={galleryDayLabel(d.day, today)}>
            <h3 className="gallery__date">
              {galleryDayLabel(d.day, today)}
              <small>{d.photos.length}</small>
            </h3>
            <div className="gallery__grid">
              {d.photos.map((p) => {
                const at = index++;
                const member = who(p);
                return (
                  <button
                    key={p.path}
                    className="gallery__photo"
                    style={{ '--member': memberColor(member.slot) } as CSSProperties}
                    aria-label={`${p.name}, ${member.nickname}`}
                    onClick={() => onSeq(at)}
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

      {seq !== null && flat[seq] && (
        <PhotoViewer
          items={flat.map((p) => {
            const member = who(p);
            const where = groupName ? galleryDayLabel(p.day, today) : groupNames(p);
            return { photo: p.url, name: p.name, who: where ? `${member.nickname} · ${where}` : member.nickname, face: <MemberFace member={member} size={32} /> };
          })}
          seq={seq}
          onSeq={onSeq}
          onClose={() => onSeq(null)}
          prevLabel="이전 사진"
          nextLabel="다음 사진"
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
