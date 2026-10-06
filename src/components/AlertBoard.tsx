import { useState } from 'react';
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
  // Cells mid-flip: the face each one flips from, keyed to restart on a quick second tap.
  const [flips, setFlips] = useState<Record<number, { from: boolean; key: number }>>({});
  const values = steps.map((step) => step.value);

  /** Saves `next`, turning over every cell it changes. */
  const apply = (next: number[]) => {
    const changed = values.filter((v) => on.includes(v) !== next.includes(v));
    setFlips((all) => {
      const flipped = { ...all };
      for (const v of changed) flipped[v] = { from: on.includes(v), key: (all[v]?.key ?? 0) + 1 };
      return flipped;
    });
    onChange(next);
  };

  return (
    <div className="alerts__row" role="group" aria-label={label}>
      <div className="alerts__head">
        <span className="alerts__label">{label}</span>
        <button className="alerts__all" aria-label={`${label} 랜덤`} onClick={() => apply(randomAlerts(on, values))}>
          랜덤
        </button>
        <button className="alerts__all" aria-label={`${label} 전체`} onClick={() => apply(toggleAllAlerts(on, values))}>
          전체
        </button>
      </div>
      <div className="alerts__hours">
        {steps.map(({ value, text }) => {
          const lit = on.includes(value);
          const flip = flips[value];
          return (
            <button
              key={value}
              className={`alerts__hour ${lit ? 'is-on' : ''}`}
              aria-pressed={lit}
              onClick={() => apply(toggleAlert(on, value, values))}
            >
              {text}
              {flip && (
                // The split-flap turn: the top and bottom halves each spin on their own
                // axis, old face out and new face in, the bottom just behind the top.
                <span key={flip.key} className="alerts__flip" aria-hidden>
                  {(['top', 'bottom'] as const).flatMap((half) => [
                    <span key={`${half}-old`} className={`alerts__face alerts__face--${half} alerts__face--out ${flip.from ? 'is-on' : ''}`}>
                      {text}
                    </span>,
                    <span
                      key={`${half}-new`}
                      className={`alerts__face alerts__face--${half} alerts__face--in ${lit ? 'is-on' : ''}`}
                      onAnimationEnd={
                        half === 'bottom'
                          ? () =>
                              setFlips((all) => {
                                if (all[value]?.key !== flip.key) return all;
                                const { [value]: _done, ...rest } = all;
                                return rest;
                              })
                          : undefined
                      }
                    >
                      {text}
                    </span>,
                  ])}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
