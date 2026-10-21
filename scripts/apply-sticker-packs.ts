/**
 * Puts a pack file from the sticker pack editor into the app:
 *   npx vite-node scripts/apply-sticker-packs.ts <sticker-packs.json>
 * The file is checked the way the app reads it (readPacks); it's refused if
 * nothing usable is left, and anything dropped is listed. The app's old file
 * is kept in output/sticker-packs/backups/ first.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STICKERS } from '../src/domain/decor';
import { packsDocument, readPacks } from '../src/domain/stickerSheets';

const source = process.argv[2];
if (!source) {
  console.error('사용법: npx vite-node scripts/apply-sticker-packs.ts <sticker-packs.json>');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(resolve(source), 'utf8'));
const packs = readPacks(raw);
if (!packs.length) {
  console.error('적용할 스티커팩이 없어요. 파일을 확인해 주세요.');
  process.exit(1);
}

const given: { name?: string; slots?: unknown[] }[] = Array.isArray(raw?.packs) ? raw.packs : [];
if (given.length !== packs.length) console.warn(`형식이 맞지 않는 팩 ${given.length - packs.length}개를 뺐어요.`);
const slotsGiven = given.reduce((n, p) => n + (Array.isArray(p?.slots) ? p.slots.length : 0), 0);
const slotsKept = packs.reduce((n, p) => n + p.slots.length, 0);
if (slotsGiven !== slotsKept) console.warn(`모르는 스티커이거나 형식이 맞지 않는 자리 ${slotsGiven - slotsKept}개를 뺐어요.`);

const target = resolve('src/domain/stickerPacks.json');
const backups = resolve('output/sticker-packs/backups');
mkdirSync(backups, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
copyFileSync(target, `${backups}/stickerPacks-${stamp}.json`);
writeFileSync(target, `${JSON.stringify(packsDocument(packs), null, 2)}\n`);

const used = new Set(packs.flatMap((p) => p.slots.map((s) => s.stickerId)));
const unused = STICKERS.filter((s) => !used.has(s.id));
console.log(`스티커팩 ${packs.length}개, 스티커 자리 ${slotsKept}개를 적용했어요. (이전 파일: output/sticker-packs/backups/)`);
if (unused.length) console.log(`어느 팩에도 없는 스티커 ${unused.length}개: ${unused.map((s) => s.label).join(', ')}`);
