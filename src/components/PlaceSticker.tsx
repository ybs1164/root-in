import { useEffect, useState, type CSSProperties } from 'react';
import { poiAppearance } from '../domain/poiAppearance';
import { kindIcon } from '../domain/placeKinds';
import type { PlaceRef } from '../types/course';
import PinGlyph from './PinGlyph';

/**
 * The place as the map draws it: its kind's sticker, with the same per-image
 * scale as the map's POIs so every sticker looks the same size. A kind with no
 * approved artwork (or an image that fails) falls back to the kind's glyph.
 */
export default function PlaceSticker({ place }: { place: PlaceRef }) {
  const appearance = poiAppearance(place);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [appearance.sticker]);

  return (
    <span className="place-sticker" style={{ '--poi-art-scale': appearance.artScale } as CSSProperties} aria-hidden>
      {appearance.sticker && !failed ? (
        <img src={appearance.sticker} alt="" draggable={false} decoding="async" onError={() => setFailed(true)} />
      ) : (
        <PinGlyph icon={kindIcon(place.kind) ?? 'pin'} />
      )}
    </span>
  );
}
