import { Images } from 'lucide-react';
import { useRef, useState, type CSSProperties } from 'react';
import { coverTintClass, GROUP_LIMITS } from '../domain/groups';
import { APP_COVER_THEMES, type ThemeId } from '../domain/decor';
import { avatarFromFile } from '../lib/avatarImage';
import { GroupCover } from './WeNowPage';

/** A cover photo's size: square, like the tile's little map. */
const COVER_PX = 512;

/**
 * COVER: its label with a colour row at the right (2026-11-16, one of the
 * four app themes — tints the two patterns' tones, `.cover-tint--<id>`, the
 * same as a member's own MY COVER), the seven patterns, then a square with
 * the gallery icon that picks a photo from the phone's gallery for the cover
 * (the square shows it once picked; pressed again it picks another, and a
 * photo takes the colour's tint off — a photo has its own colours already).
 * `photo` is the picked one (a URL or a data URL), null for a pattern.
 */
export default function CoverPicker({
  title = 'COVER',
  cover,
  photo,
  swatch,
  onChange,
  onSwatch,
}: {
  title?: string;
  cover: number;
  photo: string | null;
  swatch?: ThemeId;
  onChange(cover: number, photo: string | null): void;
  onSwatch(swatch: ThemeId): void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <p className="group-form__label group-form__label--row">
        {title}
        <span className="group-form__colors group-form__swatches" role="radiogroup" aria-label="표지 색">
          {APP_COVER_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              className={!photo && swatch === t.id ? 'is-on' : ''}
              style={{ color: `var(--swatch-${t.id}-accent)` } as CSSProperties}
              aria-checked={!photo && swatch === t.id}
              aria-label={t.label}
              onClick={() => onSwatch(t.id)}
            >
              <span aria-hidden />
            </button>
          ))}
        </span>
      </p>
      <div className={`group-form__covers ${coverTintClass(photo ? undefined : swatch)}`} role="radiogroup" aria-label="표지">
        {Array.from({ length: GROUP_LIMITS.covers }, (_, i) => (
          <button key={i} role="radio" aria-checked={!photo && cover === i} aria-label={`표지 ${i + 1}`} className={!photo && cover === i ? 'is-on' : ''} onClick={() => onChange(i, null)}>
            <svg viewBox="0 0 100 100" aria-hidden>
              <GroupCover cover={i} />
            </svg>
          </button>
        ))}
        <button
          role="radio"
          aria-checked={!!photo}
          aria-label={photo ? '표지 사진 바꾸기' : '갤러리에서 표지 사진 고르기'}
          className={`group-form__cover-photo ${photo ? 'is-on' : ''}`}
          onClick={() => fileRef.current?.click()}
        >
          {photo ? <img src={photo} alt="" draggable={false} /> : <Images size={24} strokeWidth={2} aria-hidden />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // picking the same photo again still fires
            if (!file) return;
            const square = await avatarFromFile(file, COVER_PX);
            setFailed(!square);
            if (square) onChange(cover, square);
          }}
        />
      </div>
      {failed && <p className="group-form__hint">사진을 불러오지 못했어요.</p>}
    </>
  );
}
