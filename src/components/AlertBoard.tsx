import { useEffect, useRef, useState, type ReactNode } from 'react';
import { randomAlerts, toggleAlert, toggleAllAlerts } from '../domain/profile';

interface AlertBoardProps {
  /** The row's name, above the board (and its group's accessible name). */
  label: string;
  steps: readonly { value: number; text: string }[];
  on: readonly number[];
  /** The steps switched on after a cell, 랜덤 or 전체 was pressed. */
  onChange: (on: number[]) => void;
}

/**
 * 알림 설정's row: a 출발 안내판 — one navy board of flip cells, one per step,
 * the lit ones blue. Switching a cell turns it like a split-flap. At the
 * row's right, 랜덤 tosses every cell and 전체 lights them all (or, when all
 * are lit, puts them all out).
 */
export default function AlertBoard({ label, steps, on, onChange }: AlertBoardProps) {
  const values = steps.map((step) => step.value);
  return (
    <div className="alerts__row" role="group" aria-label={label}>
      <div className="alerts__head">
        <span className="alerts__label">{label}</span>
        <button className="alerts__all" aria-label={`${label} 랜덤`} onClick={() => onChange(randomAlerts(on, values))}>
          랜덤
        </button>
        <button className="alerts__all" aria-label={`${label} 전체`} onClick={() => onChange(toggleAllAlerts(on, values))}>
          전체
        </button>
      </div>
      <div className="alerts__hours">
        {steps.map(({ value, text }) => (
          <FlipCell key={value} lit={on.includes(value)} onClick={() => onChange(toggleAlert(on, value, values))}>
            {text}
          </FlipCell>
        ))}
      </div>
    </div>
  );
}

/**
 * One cell of the board (알림 설정's, the gallery's switches): navy, lit
 * blue. Whenever `lit` changes it turns like a split-flap — the top and
 * bottom halves each spin on their own axis, old face out and new face in,
 * the bottom just behind the top.
 */
export function FlipCell({ lit, label, className = '', onClick, children }: { lit: boolean; label?: string; className?: string; onClick(): void; children: ReactNode }) {
  // Mid-flip: the face it flips from, keyed to restart on a quick second tap.
  const [flip, setFlip] = useState<{ from: boolean; key: number } | null>(null);
  const was = useRef(lit);
  useEffect(() => {
    if (was.current === lit) return;
    const from = was.current;
    was.current = lit;
    setFlip((f) => ({ from, key: (f?.key ?? 0) + 1 }));
  }, [lit]);
  return (
    <button className={`alerts__hour ${lit ? 'is-on' : ''} ${className}`} aria-pressed={lit} aria-label={label} onClick={onClick}>
      {children}
      {flip && (
        <span key={flip.key} className="alerts__flip" aria-hidden>
          {(['top', 'bottom'] as const).flatMap((half) => [
            <span key={`${half}-old`} className={`alerts__face alerts__face--${half} alerts__face--out ${flip.from ? 'is-on' : ''}`}>
              {children}
            </span>,
            <span
              key={`${half}-new`}
              className={`alerts__face alerts__face--${half} alerts__face--in ${lit ? 'is-on' : ''}`}
              onAnimationEnd={half === 'bottom' ? () => setFlip((f) => (f?.key === flip.key ? null : f)) : undefined}
            >
              {children}
            </span>,
          ])}
        </span>
      )}
    </button>
  );
}
