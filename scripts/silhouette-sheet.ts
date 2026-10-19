// docs/plan-minimap-silhouette.md S0/S7: every example day's 미니맵 outline as it
// was (the 읍면동 lump) and as it is now, black on white (the silhouette test),
// with the numbers. Runs in the dev server's page:
//   await (await import('/scripts/silhouette-sheet.ts')).drawSheet()
// (`npm run shots -- silhouettes` does that and takes the picture.)
import { terrainService } from '../src/services/terrainService';
import { LEG_POWER, lumpAreas, lumpReach, stopProjection, terrainParts, untiltPoint, type MapPoint } from '../src/domain/miniMap';
import { rawOutline, silhouetteStats, type SilhouetteStats } from '../src/domain/silhouette';
import type { LonLat } from '../src/domain/districtMap';

const EXAMPLES: Record<string, LonLat[]> = {
  street: [[127.0582, 37.5447], [127.0571, 37.544], [127.059, 37.5436]],
  river: [[127.0582, 37.5447], [127.0557, 37.5431], [127.0539, 37.5418], [127.0374, 37.5444], [127.0396, 37.5272]],
  one: [[127.0582, 37.5447]],
  row: [0, 1, 2, 3, 4, 5].map((k) => [126.977 + k * 0.009, 37.5705 + k * 0.0004] as LonLat),
  same: [[127.0582, 37.5447], [127.05822, 37.54471]],
};

/** The examples and made-up days around Seoul (seeded, so the same each run). */
export function sheetDays(count = 19): [string, LonLat[]][] {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const days = Object.entries(EXAMPLES);
  for (let k = 0; k < count; k++) {
    const [lng, lat] = [126.86 + rand() * 0.28, 37.48 + rand() * 0.16];
    const n = 1 + Math.floor(rand() * 4);
    days.push([`s${k}`, Array.from({ length: n }, () => [lng + (rand() - 0.5) * 0.02, lat + (rand() - 0.5) * 0.015] as LonLat)]);
  }
  return days;
}

export interface SheetRow {
  name: string;
  ms: number;
  before: SilhouetteStats;
  after: SilhouetteStats;
}

const svg = (rings: MapPoint[][], stops: MapPoint[]) =>
  `<svg viewBox="0 0 1 1" width="110" height="110" style="background:#fff;border:1px solid #ddd"><path fill="#111" fill-rule="evenodd" d="${rings
    .map((r) => `M${r.map((p) => `${p.x},${p.y}`).join('L')}Z`)
    .join('')}"/>${stops.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="0.014" fill="#e33"/>`).join('')}</svg>`;
const num = (s: SilhouetteStats) => `s${s.solidity.toFixed(2)} w${s.wiggle.toFixed(0)} t${(s.thin * 100).toFixed(0)} b${(s.bites * 100).toFixed(0)} p${s.pieces}`;

/** The sheet as HTML, and its numbers. */
export async function sheetHtml(days = sheetDays()): Promise<{ html: string; rows: SheetRow[] }> {
  const rows: SheetRow[] = [];
  const cells: string[] = [];
  for (const [name, centers] of days) {
    const shapes = await terrainService.fetch(centers);
    const lump = lumpAreas(shapes, centers, LEG_POWER);
    if (!lump.length) {
      cells.push(`<div style="font:10px sans-serif">${name}: no data</div>`);
      continue;
    }
    const project = stopProjection(centers, lumpReach(lump));
    const polygons = lump.flatMap((a) => a.polygons.map((rings) => rings.map((r) => r.map(project))));
    const t = performance.now();
    const after = terrainParts(shapes, centers)[0].polys;
    const ms = Math.round(performance.now() - t);
    const flat = (rings: MapPoint[][]) => rings.map((r) => r.map(untiltPoint));
    const row = { name, ms, before: silhouetteStats(rawOutline(polygons.map(flat))), after: silhouetteStats(flat(after)) };
    rows.push(row);
    const stops = centers.map(project);
    cells.push(`<div style="font:10px sans-serif"><b>${name}</b> ${ms}ms<br>${svg(polygons.flat(), stops)}${svg(after, stops)}<br>${num(row.before)}<br>${num(row.after)}</div>`);
  }
  return { html: `<div id="sheet" style="display:grid;grid-template-columns:repeat(4,240px);gap:6px;padding:6px;background:#fff;color:#000">${cells.join('')}</div>`, rows };
}

/** Replaces the page with the sheet; resolves to the numbers. */
export async function drawSheet(days = sheetDays()): Promise<SheetRow[]> {
  const { html, rows } = await sheetHtml(days);
  document.body.innerHTML = html;
  document.documentElement.style.overflow = document.body.style.overflow = 'auto';
  return rows;
}
