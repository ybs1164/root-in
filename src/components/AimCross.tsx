/** The crosshair at the map's middle while it is dragged (hooks/usePanAim), the place under it named above. */
export default function AimCross({ on, name }: { on: boolean; name: string | null }) {
  return (
    <div className={`aim ${on ? 'is-on' : ''}`} aria-hidden>
      <div className="aim__mark">
        {name && (
          <span className="aim__name">
            <span>{name}</span>
          </span>
        )}
        <svg className="aim__cross" viewBox="0 0 48 48" aria-hidden>
          <circle cx="24" cy="24" r="13" />
          <path d="M24 2v12M24 34v12M2 24h12M34 24h12" />
          <circle className="aim__dot" cx="24" cy="24" r="2.6" />
        </svg>
      </div>
    </div>
  );
}
