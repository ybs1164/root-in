import { dateKey } from '../domain/diary';
import type { StoredPing } from '../domain/dayPings';
import { loadPings, savePings } from '../services/pingRepository';
import { savePingPhoto } from '../services/pingPhotoRepository';

/**
 * Dev only: a few weeks of TODAY pings, so the calendars, TODAY and the
 * gallery can be checked without walking around — days with several pings,
 * days with one, days with none, and pings with a photo next to pings
 * without. Seeded once per browser (a flag, so deleting them sticks; clear
 * `goodroot:demo-pings:v1` to seed again), as local pings (never synced, no
 * pins made from them), ids `demo-…`.
 */
const FLAG = 'goodroot:demo-pings:v1';

const PLACES: Array<[string, [number, number]]> = [
  ['광화문', [126.9769, 37.5759]],
  ['서촌 카페', [126.9707, 37.5794]],
  ['통인시장', [126.97, 37.5809]],
  ['경복궁', [126.977, 37.5796]],
  ['성수 카페거리', [127.056, 37.5446]],
  ['서울숲', [127.0374, 37.5444]],
  ['망원시장', [126.905, 37.556]],
  ['망원 한강공원', [126.896, 37.552]],
  ['명동성당', [126.987, 37.5633]],
  ['남대문시장', [126.9775, 37.5592]],
];

/** Days back from today → the day's pings: [place, time, with a photo]. Missing days have none. */
const PLAN: Record<number, Array<[number, string, boolean]>> = {
  0: [[0, '09:40', true], [1, '12:10', false], [2, '15:30', true]],
  1: [[4, '11:00', true], [5, '14:20', true]],
  3: [[6, '10:30', false], [7, '13:00', true], [8, '16:40', false], [9, '18:10', true]],
  6: [[3, '14:00', false]],
  9: [[8, '12:00', true], [9, '13:30', false], [0, '17:00', true]],
  13: [[4, '15:00', false], [5, '16:30', true]],
  20: [[6, '11:20', true]],
};

export interface DemoPing {
  ping: StoredPing;
  photo: boolean;
}

/** The demo pings for the days around `now`, oldest first. */
export function buildDemoPings(now = new Date()): DemoPing[] {
  const out: DemoPing[] = [];
  for (const back of Object.keys(PLAN).map(Number).sort((a, b) => b - a)) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const day = dateKey(date);
    PLAN[back].forEach(([place, time, photo], i) => {
      const [h, m] = time.split(':').map(Number);
      const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
      const [name, center] = PLACES[place];
      out.push({ ping: { id: `demo-${day}-${i}`, day, at: at.toISOString(), name, center, local: true }, photo });
    });
  }
  return out;
}

/** A small drawn scene (sky, sun, hills) as the square JPEG a TODAY photo is. */
function demoPhoto(seed: number): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 240;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const hue = [205, 25, 140, 330, 45][seed % 5];
  const sky = ctx.createLinearGradient(0, 0, 0, 240);
  sky.addColorStop(0, `hsl(${hue} 70% 78%)`);
  sky.addColorStop(1, `hsl(${hue + 30} 80% 92%)`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 240, 240);
  ctx.fillStyle = 'hsl(45 95% 70%)';
  ctx.beginPath();
  ctx.arc(70 + (seed % 3) * 50, 80, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `hsl(${hue + 90} 35% 52%)`;
  ctx.beginPath();
  ctx.moveTo(0, 184);
  ctx.quadraticCurveTo(60, 128, 120, 176);
  ctx.quadraticCurveTo(180, 150, 240, 160);
  ctx.lineTo(240, 240);
  ctx.lineTo(0, 240);
  ctx.fill();
  return canvas.toDataURL('image/jpeg', 0.8);
}

export function seedDemoPings(): void {
  try {
    if (window.localStorage.getItem(FLAG)) return;
    window.localStorage.setItem(FLAG, '1');
  } catch {
    return;
  }
  const demo = buildDemoPings();
  const kept = loadPings().filter((p) => !p.id.startsWith('demo-'));
  const all = [...kept, ...demo.map((d) => d.ping)];
  savePings(all);
  const alive = new Set(all.map((p) => p.id));
  demo.forEach(({ ping, photo }, i) => {
    const jpeg = photo ? demoPhoto(i) : null;
    if (jpeg) savePingPhoto(ping.id, jpeg, alive);
  });
}
