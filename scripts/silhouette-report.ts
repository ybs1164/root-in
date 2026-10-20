// The silhouette sheet without a browser (docs/plan-minimap-silhouette.md S0/S7):
//   npx vite-node scripts/silhouette-report.ts
// reads the map data straight from public/ and writes ui-shots/silhouettes.html
// (open it, or take a picture of it with a headless browser) and the numbers.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { sheetHtml } from './silhouette-sheet';

globalThis.fetch = (async (url: string | URL) => {
  const path = decodeURIComponent(new URL(String(url), 'http://local/').pathname);
  try {
    const body = await readFile(`public${path}`);
    return new Response(body, { status: 200 });
  } catch {
    return new Response('', { status: 404 });
  }
}) as typeof fetch;

const { html, rows } = await sheetHtml();
await mkdir('ui-shots', { recursive: true });
await writeFile('ui-shots/silhouettes.html', `<!doctype html><meta charset="utf-8"><body style="margin:0">${html}</body>`);
const mean = (pick: (r: (typeof rows)[number]) => number) => (rows.reduce((s, r) => s + pick(r), 0) / Math.max(1, rows.length)).toFixed(3);
console.log('name\tms\tsolid\t→\twiggle\t→\tthin\t→\tbites\t→\tpieces');
for (const r of rows) {
  const f = (k: 'solidity' | 'wiggle' | 'thin' | 'bites') => `${r.before[k].toFixed(2)}\t${r.after[k].toFixed(2)}`;
  console.log(`${r.name}\t${r.ms}\t${f('solidity')}\t${f('wiggle')}\t${f('thin')}\t${f('bites')}\t${r.before.pieces}→${r.after.pieces}`);
}
console.log(`mean\t${mean((r) => r.ms)}\t${mean((r) => r.before.solidity)}\t${mean((r) => r.after.solidity)}\t${mean((r) => r.before.wiggle)}\t${mean((r) => r.after.wiggle)}\t${mean((r) => r.before.thin)}\t${mean((r) => r.after.thin)}\t${mean((r) => r.before.bites)}\t${mean((r) => r.after.bites)}`);
