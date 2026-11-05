import { Images } from 'lucide-react';
import { useRef, useState, type PointerEvent } from 'react';
import type { PlacePhoto } from '../domain/visitedPlaces';

/** How far a finger must slide the photos to turn them. */
const SWIPE_PX = 36;

type Slot = 'center' | 'right' | 'left' | 'hidden';

/**
 * Where a photo sits in the fan, `offset` places after the middle one: the
 * next older on the right, (going round) the one before on the left, the rest
 * waiting hidden behind the middle. Two photos: the other one only on the right.
 */
function slotOf(offset: number, n: number): Slot {
  if (offset === 0) return 'center';
  if (offset === 1) return 'right';
  if (offset === n - 1 && n >= 3) return 'left';
  return 'hidden';
}

const LABELS: Record<Slot, string> = { center: '크게 보기', right: '다음 사진', left: '이전 사진', hidden: '' };

/**
 * The photos I took at a place, above its card, as a fan: the newest in the
 * middle, the next older tucked in behind on the right and the one before on
 * the left, both turned out a little. Tapping a side photo or sliding turns
 * the fan one place — every photo keeps its element and moves to its new
 * slot, so the transitions carry the turn. Tapping the middle one opens it
 * big (`onOpen`, its index in `photos`); the gallery button at the fan's
 * bottom right opens MY searched for this place (`onGallery`).
 */
export default function PlacePhotos({
  photos,
  onOpen,
  onGallery,
}: {
  photos: readonly PlacePhoto[];
  onOpen?: (index: number) => void;
  onGallery?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const down = useRef<{ x: number; y: number } | null>(null);
  // A slide that ended on a photo isn't also a tap on it.
  const slid = useRef(false);
  const n = photos.length;
  if (!n) return null;

  const turn = (step: 1 | -1) => setIndex((i) => (((i + step) % n) + n) % n);

  const onPointerDown = (e: PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = down.current;
    down.current = null;
    slid.current = false;
    if (!start || n < 2) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(e.clientY - start.y)) return;
    slid.current = true;
    // Slid to the left: the right-hand photo comes to the middle.
    turn(dx < 0 ? 1 : -1);
  };
  const tap = (slot: Slot, i: number) => {
    if (slid.current) {
      slid.current = false;
      return;
    }
    if (slot === 'center') onOpen?.(i);
    else if (slot === 'right') turn(1);
    else if (slot === 'left') turn(-1);
  };

  return (
    <div
      className="place-photos"
      role="group"
      aria-label={`이 장소에서 찍은 사진 ${n}장`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (down.current = null)}
    >
      {photos.map((photo, i) => {
        const slot = slotOf((i - index + n) % n, n);
        return (
          <button
            key={photo.id}
            className={`place-photos__photo is-${slot}`}
            aria-label={LABELS[slot] || undefined}
            aria-hidden={slot === 'hidden' || undefined}
            tabIndex={slot === 'hidden' ? -1 : undefined}
            onClick={() => tap(slot, i)}
          >
            <img src={photo.url} alt="" draggable={false} />
          </button>
        );
      })}
      {onGallery && (
        <button className="place-photos__gallery" aria-label="이 장소 사진을 갤러리에서 보기" onClick={onGallery}>
          <Images size={20} strokeWidth={2.2} aria-hidden />
        </button>
      )}
    </div>
  );
}
