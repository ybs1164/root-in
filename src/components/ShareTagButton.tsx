import { Share } from 'lucide-react';

/**
 * 공유, as an upright luggage tag: clipped top corners, an eyelet near the
 * top, the share glyph on its face. The tag is one SVG path (the eyelet cut
 * out with evenodd) so its shadow follows the outline.
 */
export default function ShareTagButton({ label, onClick, className = '' }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button className={`share-tag ${className}`} aria-label={label} onClick={onClick}>
      <svg className="share-tag__shape" viewBox="0 0 60 92" aria-hidden>
        <path
          fillRule="evenodd"
          d="M19 2h22a4 4 0 0 1 2.8 1.2l13 13A4 4 0 0 1 58 19v67a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V19a4 4 0 0 1 1.2-2.8l13-13A4 4 0 0 1 19 2Zm11 10a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
        />
      </svg>
      <Share className="share-tag__icon" size={24} strokeWidth={2.2} aria-hidden />
    </button>
  );
}
