/**
 * root-in logo (2026-10-21, draft F): a tilted pin with a large hole, an oval ink drop under
 * its tip and a route that doubles back once and runs off the tile's edge.
 *
 * Two parts: the tile (background) and the mark (pin + route). `tile={false}` draws the mark
 * alone; the pin's hole is cut out, so it sits on any background. Colours come from
 * --logo-* and follow the app's light/dark scheme (dark = white pin + blue route on navy, light =
 * navy pin + blue route on cream), not the decoration themes. The search bar uses the mark alone.
 * Static copies of each part are in public/brand/.
 * The pin is drawn last, on top of the route and the drop, and scaled up a little about its tip.
 * Geometry is the 192 icon canvas; the pin is scaled to the adaptive-icon safe zone.
 */
export default function Logo({ tile = true }: { tile?: boolean }) {
  return (
    <svg className={`logo ${tile ? '' : 'logo--mark'}`} viewBox="0 0 192 192" role="img" aria-label="root-in">
      {tile && <rect className="logo__tile" width="192" height="192" />}
      <path
        className="logo__route"
        d="M111.7 140.7C125.7 139.7 143.7 140.7 148.7 145.7C152.7 150.7 142.7 151.7 133.7 153.7C123.7 155.7 110.7 158.7 112.7 162.7C114.7 166.7 155.7 168.7 215.7 174.7"
      />
      <ellipse className="logo__drop" cx="105.7" cy="139.7" rx="11" ry="5.5" />
      <g transform="translate(96 96) scale(0.8059) translate(-96 -100.5) rotate(-12 96 96) translate(96 152) scale(1.12) translate(-96 -152)">
        <path
          className="logo__pin"
          fillRule="evenodd"
          d="M60 86A36 36 0 0 1 132 86C132 113 113 128 96 152C79 128 60 113 60 86ZM80 86a16 16 0 1 0 32 0a16 16 0 1 0-32 0Z"
        />
      </g>
    </svg>
  );
}
