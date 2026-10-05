import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { hexToHsv, hsvToHex, normalizeHex } from '../domain/decor';

/**
 * The palette: a round wheel of every hue (saturation grows from the white
 * centre to the rim), a brightness slider, and a box for a colour code.
 * Every change is applied straight away. Taps outside close it, except on
 * the button that opened it (`data-palette-toggle`), which toggles it itself.
 * Shared by the 꾸미기 pen/text trays and the pin category form.
 */
export default function ColorPicker({ color, onPick, onClose }: { color: string; onPick: (hex: string) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement | null>(null);
  // HSV is kept here rather than derived from the hex, so turning the
  // brightness all the way down and back up doesn't lose the hue.
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const [code, setCode] = useState(color);
  const wheel = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const away = (e: globalThis.PointerEvent) => {
      const t = e.target as Element | null;
      if (box.current?.contains(t) || t?.closest('[data-palette-toggle]')) return;
      onClose();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);

  const apply = (next: { h: number; s: number; v: number }) => {
    setHsv(next);
    const hex = hsvToHex(next.h, next.s, next.v);
    setCode(hex);
    onPick(hex);
  };

  const pickAt = (e: PointerEvent) => {
    const r = wheel.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    // Hue runs clockwise from the top, as the conic gradient draws it.
    const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    const s = Math.min(1, Math.hypot(dx, dy) / (r.width / 2));
    // Picking on a black wheel would show nothing: bring the light back.
    apply({ h, s, v: hsv.v < 0.15 ? 1 : hsv.v });
  };

  const rad = (hsv.h * Math.PI) / 180;
  const marker = { left: `${50 + Math.sin(rad) * hsv.s * 50}%`, top: `${50 - Math.cos(rad) * hsv.s * 50}%` };
  const current = hsvToHex(hsv.h, hsv.s, hsv.v);

  return (
    <div ref={box} className="color-picker" role="dialog" aria-label="팔레트">
      <div
        ref={wheel}
        className="color-picker__wheel"
        role="slider"
        aria-label="색상"
        aria-valuenow={Math.round(hsv.h)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragging.current = true;
          pickAt(e);
        }}
        onPointerMove={(e) => dragging.current && pickAt(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <span className="color-picker__shade" style={{ opacity: 1 - hsv.v }} aria-hidden />
        <span className="color-picker__marker" style={{ ...marker, background: current }} aria-hidden />
      </div>
      <div className="color-picker__side">
        <input
          className="color-picker__value"
          type="range"
          min={0}
          max={100}
          aria-label="밝기"
          value={Math.round(hsv.v * 100)}
          style={{ '--picker-top': hsvToHex(hsv.h, hsv.s, 1) } as CSSProperties}
          onChange={(e) => apply({ ...hsv, v: Number(e.target.value) / 100 })}
        />
        <label className="color-picker__code">
          <span className="color-picker__chip" style={{ background: current }} aria-hidden />
          <input
            type="text"
            inputMode="text"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            maxLength={7}
            aria-label="색상 코드"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              const hex = normalizeHex(e.target.value);
              if (hex) {
                setHsv(hexToHsv(hex));
                onPick(hex);
              }
            }}
            onBlur={() => setCode(current)}
          />
        </label>
      </div>
    </div>
  );
}
