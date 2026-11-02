// The faint Korea behind a group's island map (docs/plan-group-atlas.md GA4):
//   node scripts/korea-data/build_atlas_outline.mjs
// reads public/korea/admin/sido.json (built by build_admin.py), keeps each
// 시도's outer rings, simplifies them hard (Douglas–Peucker, ~1.2 km) and drops
// the specks, then writes src/assets/koreaOutline.json. It ships with the app
// (about 30 KB, 12 KB gzipped) so the backdrop doesn't wait on the hosted map data. The 시도 are
// drawn as one fill, so their shared borders never show.
import { readFile, writeFile } from 'node:fs/promises';

const TOLERANCE = 0.012; // degrees (~1.2 km)
const MIN_AREA = 0.001; // square degrees (~10 km²): islets go

const sido = JSON.parse(await readFile('public/korea/admin/sido.json', 'utf8'));

function simplify(ring, tol) {
  const keep = new Array(ring.length).fill(false);
  keep[0] = keep[ring.length - 1] = true;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [p, q] = [ring[a], ring[b]];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    let [far, at] = [0, -1];
    for (let i = a + 1; i < b; i++) {
      const r = ring[i];
      // A closed ring starts and ends on one point: there, distance to that point.
      const d = len ? Math.abs((q[0] - p[0]) * (p[1] - r[1]) - (p[0] - r[0]) * (q[1] - p[1])) / len : Math.hypot(r[0] - p[0], r[1] - p[1]);
      if (d > far) [far, at] = [d, i];
    }
    if (far > tol) {
      keep[at] = true;
      stack.push([a, at], [at, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

const area = (ring) => Math.abs(ring.reduce((s, p, i) => s + (ring[(i + 1) % ring.length][0] - p[0]) * (ring[(i + 1) % ring.length][1] + p[1]), 0) / 2);

const rings = sido.areas
  .flatMap((a) => a.rings.map((polygon) => polygon[0]))
  .filter((ring) => area(ring) >= MIN_AREA)
  .map((ring) => simplify(ring, TOLERANCE))
  .filter((ring) => ring.length >= 4)
  // Flat [lng, lat, lng, lat, …], three decimals (~100 m): small to ship.
  .map((ring) => ring.flatMap(([lng, lat]) => [Math.round(lng * 1000) / 1000, Math.round(lat * 1000) / 1000]));

const out = { attribution: sido.attribution, rings };
await writeFile('src/assets/koreaOutline.json', `${JSON.stringify(out)}\n`);
console.log(`${rings.length} rings, ${rings.reduce((s, r) => s + r.length / 2, 0)} points, ${JSON.stringify(out).length} bytes`);
