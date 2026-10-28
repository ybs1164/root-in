// Builds the web app and copies it into the Android project (or the iOS one with --ios).
// public/korea also holds an old flat layout (detail/city/region/country, ~3GB) that
// no code reads — only korea/base, korea/admin and korea/places are fetched — so keep it out of the APK.
// With VITE_MAP_DATA_URL set the map data is read from that host
// (scripts/publish-map-data.mjs), so none of korea/ goes in.
import { execSync } from 'node:child_process';
import { cpSync, readdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { build, loadEnv } from 'vite';
import { androidBackend, checkAndroidBackend } from './android-config.mjs';
import { xcodeEnv } from './xcode-env.mjs';

const platform = process.argv.includes('--ios') ? 'ios' : 'android';
const run = (cmd, env) => execSync(cmd, { stdio: 'inherit', env });

// Use the same environment precedence and expansion as the Vite build.
const env = loadEnv('production', process.cwd(), 'VITE_');
const backend = androidBackend(env, process.argv.includes('--local-only'));
await checkAndroidBackend(backend);
console.log(backend ? 'Backend connection verified.' : 'Local-only test APK: server features disabled.');
const hosted = env.VITE_MAP_DATA_URL?.trim();
// The WebView page is https://localhost; links made from it would open nowhere.
if (!env.VITE_PUBLIC_APP_URL?.trim()) console.warn('경고: VITE_PUBLIC_APP_URL이 없어 앱에서 만든 공유·초대 링크가 https://localhost를 가리킵니다. .env.production.local에 웹 앱 주소를 넣으세요.');
if (!process.argv.includes('--skip-build')) {
  run('npx tsc -b');
  // Avoid copying gigabytes of map files only to delete them immediately.
  await build({ publicDir: false });
  const out = resolve('dist');
  if (out !== join(process.cwd(), 'dist')) throw new Error('Unexpected build output path.');
  for (const entry of readdirSync('public', { withFileTypes: true })) {
    if (entry.name === 'overture' || (hosted && entry.name === 'korea')) continue;
    cpSync(join('public', entry.name), join(out, entry.name), { recursive: true });
  }
}
const pruned = hosted ? ['korea'] : ['korea/detail', 'korea/city', 'korea/region', 'korea/country', 'korea/manifest.json'];
for (const p of [...pruned, 'overture']) rmSync(`dist/${p}`, { recursive: true, force: true });
console.log(hosted
  ? `Map data from ${hosted} — not bundled.`
  : 'Map data bundled into the APK (set VITE_MAP_DATA_URL to read it from a host instead).');
// The sticker PNGs are ~150MB at full size; shrink the built copies (needs Python + Pillow).
// macOS ships python3 only; Windows installs python.
run(`${process.platform === 'win32' ? 'python' : 'python3'} scripts/shrink-stickers.py dist/stickers`);
run(`npx cap sync ${platform}`, platform === 'ios' ? xcodeEnv() : process.env);
