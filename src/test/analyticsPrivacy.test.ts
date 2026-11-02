import { describe, expect, it } from 'vitest';
import doc from '../../docs/analytics.md?raw';
import source from '../services/analytics.ts?raw';

// CLAUDE.md: 좌표·주소·장소 이름·메모·닉네임은 이벤트에 넣지 않는다, and a new
// event goes into EventProps and the docs table (docs/plan-maintenance-harness.md MH6).
// Read from the source text: the types are what keep data out, so the test
// checks the types themselves.

const body = /export interface EventProps \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? '';
const events = [...body.matchAll(/^\s*(\w+): \{([^}]*)\};/gm)].map(([, event, props]) => ({
  event,
  props: props
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [name, ...type] = p.split(':');
      return { name: name.trim(), type: type.join(':').trim() };
    }),
}));

/** Type aliases declared in analytics.ts, e.g. `PinSource` → `'search' | …`. */
const aliases = Object.fromEntries([...source.matchAll(/^export type (\w+) = ([^;]+);/gm)].map((m) => [m[1], m[2].trim()]));
const isLiteralUnion = (type: string) => type.split('|').every((part) => /^'[a-z_]+'$/.test(part.trim()));

describe('analytics events carry no personal data', () => {
  it('finds the events', () => {
    expect(events.length).toBeGreaterThan(5);
  });

  it('every property is a boolean, a count, or a fixed set of words — never free text', () => {
    for (const { event, props } of events) {
      for (const { name, type } of props) {
        const resolved = aliases[type] ?? type;
        const ok = resolved === 'boolean' || resolved === 'number' || isLiteralUnion(resolved);
        expect(ok, `${event}.${name}: ${type}`).toBe(true);
      }
    }
  });

  it('no number looks like a position', () => {
    for (const { event, props } of events) {
      for (const { name, type } of props) {
        if (type !== 'number') continue;
        expect(name, `${event}.${name}`).not.toMatch(/lat|lng|lon|coord|center|^x$|^y$|zoom|bearing|meters|_m$/i);
      }
    }
  });
});

describe('docs/analytics.md matches EventProps', () => {
  const rows = [...doc.matchAll(/^\|[^|]*\| `(\w+)` \|([^|]*)\|/gm)].map(([, event, props]) => ({ event, props }));

  it('lists exactly the same events', () => {
    expect(rows.map((r) => r.event).sort()).toEqual(events.map((e) => e.event).sort());
  });

  it('names every property of each event', () => {
    for (const { event, props } of events) {
      const row = rows.find((r) => r.event === event);
      for (const { name } of props) expect(row?.props, `${event}.${name} in the docs table`).toContain(`\`${name}\``);
    }
  });
});
