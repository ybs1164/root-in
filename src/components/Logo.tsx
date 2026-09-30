/**
 * "root-in" wordmark ("rootin"). The i is the app's map-pin icon (Lucide
 * `map-pin`, the same one on the bottom pin button), filled and larger
 * than the letters so it reads as a pin first; its tip sits on the baseline.
 * Icon geometry: Lucide, ISC license.
 */
export default function Logo() {
  return (
    <span className="logo" role="img" aria-label="root-in">
      <span aria-hidden>root</span>
      <span className="logo__in" aria-hidden>
        <svg className="logo__i" viewBox="4 1.5 16 21">
          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
          <circle className="logo__hole" cx="12" cy="10" r="3.2" />
        </svg>
        n
      </span>
    </span>
  );
}
