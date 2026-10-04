import { Share } from 'lucide-react';
import type { ReactNode } from 'react';

interface TagButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
  /** What's printed on the tag (공유's glyph unless given). */
  icon?: ReactNode;
  /** A white tag (a lesser action beside 공유) instead of the accent one. */
  light?: boolean;
}

/**
 * 공유, as an upright luggage tag: clipped top corners, an eyelet near the
 * top, the share glyph on its face. The tag is one SVG path (the eyelet cut
 * out with evenodd) so its shadow follows the outline. Also comes small and
 * white for the route's 수정 beside it.
 */
export default function ShareTagButton({ label, onClick, className = '', icon, light = false }: TagButtonProps) {
  return (
    <button className={`share-tag ${light ? 'share-tag--light' : ''} ${className}`} aria-label={label} onClick={onClick}>
      <svg className="share-tag__shape" viewBox="0 0 60 76" aria-hidden>
        <path
          fillRule="evenodd"
          d="M19 2h22a4 4 0 0 1 2.8 1.2l13 13A4 4 0 0 1 58 19v51a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V19a4 4 0 0 1 1.2-2.8l13-13A4 4 0 0 1 19 2Zm11 10a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
        />
      </svg>
      <span className="share-tag__icon" aria-hidden>
        {icon ?? <Share size={24} strokeWidth={2.2} />}
      </span>
    </button>
  );
}
