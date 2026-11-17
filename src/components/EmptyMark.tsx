/**
 * The mark for a screen with nothing on it (draft G3, 2026-11-17): the dashed
 * outline of a pin that isn't there yet, hovering over a tile of land with
 * its shadow. Colours come from the theme (`.empty-mark` in styles.css), so
 * it wears whatever theme the screen around it does.
 */
export default function EmptyMark({ size = 132, label = '아직 아무것도 없어요' }: { size?: number; label?: string }) {
  return (
    // An empty label: the words beside it say it, so the picture stays out of the way of screen readers.
    <svg className="empty-mark" width={size} height={size} viewBox="0 0 160 160" {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      <path className="empty-mark__side" d="M20 108 L80 136 L140 108 V120 L80 148 L20 120Z" />
      <path className="empty-mark__land" d="M80 80 L140 108 L80 136 L20 108Z" />
      <ellipse className="empty-mark__shadow" cx="80" cy="108" rx="14" ry="5" />
      <g transform="translate(80 36) scale(0.92)">
        <path className="empty-mark__pin" d="M-25.5 12.5 A29 29 0 1 1 25.5 12.5 C19 26 7 40 0 54 C-7 40 -19 26 -25.5 12.5 Z" />
        <circle className="empty-mark__pin" cx="0" cy="0" r="10" />
      </g>
    </svg>
  );
}
