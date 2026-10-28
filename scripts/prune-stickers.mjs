// Takes the stickers no pack uses out of a built copy (dist/stickers): the
// app can't pick them (only a pack's stickers are offered), so they'd only
// weigh down the web deploy and the APK. public/stickers keeps them all, for
// the sticker pack editor. A day that already has one of them shows it
// hidden, and keeps it in its data in case it comes back to a pack.
//
//   node scripts/prune-stickers.mjs [dir]   (default dist/stickers)
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'dist/stickers';
const packs = JSON.parse(readFileSync('src/domain/stickerPacks.json', 'utf8')).packs ?? [];
const used = new Set(packs.flatMap((p) => (p.slots ?? []).map((s) => s.stickerId)));
let count = 0;
let bytes = 0;
for (const name of readdirSync(dir)) {
  if (!name.endsWith('.png') || used.has(name.slice(0, -4))) continue;
  const file = join(dir, name);
  bytes += statSync(file).size;
  rmSync(file);
  count += 1;
}
console.log(`Stickers: left out ${count} no pack uses (${(bytes / 1e6).toFixed(1)}MB); ${used.size} kept.`);
