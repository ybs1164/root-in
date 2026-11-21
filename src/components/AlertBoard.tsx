import type { CSSProperties, ReactNode } from 'react';
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
 * 알림 설정's row of hours: the day's hours along one line, morning to night. A lit hour has a pin standing on its dot, and the stretch
 * between two neighbouring lit hours lights up. At the
 * row's right, 랜덤 tosses every hour and 전체 lights them all (or, when all
 * are lit, puts them all out).
 */
export default function AlertBoard({ label, steps, on, onChange }: AlertBoardProps) {
  const values = steps.map((step) => step.value);
  // One line, the hours evenly spaced along it.
  const lines = [steps];
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
      {lines.map((line, n) => {
        // Where an hour sits on its line (0..1).
        const at = (i: number) => (line.length > 1 ? i / (line.length - 1) : 0.5);
        return (
          <div key={n} className="alerts__line">
            {/* The stretch between two neighbouring lit hours lights up too. */}
            {line.slice(1).map((step, i) =>
              on.includes(step.value) && on.includes(line[i].value) ? (
                <span key={step.value} className="alerts__edge" style={{ '--from': at(i), '--to': at(i + 1) } as CSSProperties} aria-hidden />
              ) : null,
            )}
            {line.map(({ value, text }, i) => {
              const lit = on.includes(value);
              return (
                <button
                  key={value}
                  className={`alerts__tick ${lit ? 'is-on' : ''}`}
                  style={{ '--at': at(i) } as CSSProperties}
                  aria-pressed={lit}
                  onClick={() => onChange(toggleAlert(on, value, values))}
                >
                  <svg className="alerts__pin" viewBox="0 0 26 34" aria-hidden>
                    <path d="M13 33S2 21 2 13a11 11 0 0 1 22 0c0 8-11 20-11 20z" />
                    <circle cx="13" cy="13" r="4" />
                  </svg>
                  <span className="alerts__dot" aria-hidden />
                  <span className="alerts__time">{text}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** One switch tile of a row (a group's alert kinds): an icon over its name; lit, it's raised on the accent's two-tone base. */
export function AlertTile({ lit, label, icon, onClick, children }: { lit: boolean; label?: string; icon: ReactNode; onClick(): void; children: ReactNode }) {
  return (
    <button className={`alerts__tile ${lit ? 'is-on' : ''}`} aria-pressed={lit} aria-label={label} onClick={onClick}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
