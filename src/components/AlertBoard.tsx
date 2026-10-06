import { useState } from 'react';

interface AlertBoardProps {
  /** The row's name, above the board (and its group's accessible name). */
  label: string;
  steps: readonly { value: number; text: string }[];
  on: readonly number[];
  onToggle: (value: number) => void;
}

/**
 * 알림 설정's row: a 출발 안내판 — one navy board of flip cells, one per step,
 * the lit ones blue. Switching a cell turns it like a split-flap.
 */
export default function AlertBoard({ label, steps, on, onToggle }: AlertBoardProps) {
  // Cells mid-flip: the face each one flips from, keyed to restart on a quick second tap.
  const [flips, setFlips] = useState<Record<number, { from: boolean; key: number }>>({});

  return (
    <div className="alerts__row" role="group" aria-label={label}>
      <span className="alerts__label">{label}</span>
      <div className="alerts__hours">
        {steps.map(({ value, text }) => {
          const lit = on.includes(value);
          const flip = flips[value];
          return (
            <button
              key={value}
              className={`alerts__hour ${lit ? 'is-on' : ''}`}
              aria-pressed={lit}
              onClick={() => {
                setFlips((all) => ({ ...all, [value]: { from: lit, key: (all[value]?.key ?? 0) + 1 } }));
                onToggle(value);
              }}
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
