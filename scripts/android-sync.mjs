// Builds the web app and copies it into the Android project.
// public/korea also holds an old flat layout (detail/city/region/country, ~3GB) that
// no code reads — only korea/base, korea/admin and korea/places are fetched — so keep it out of the APK.
// With VITE_MAP_DATA_URL set the map data is read from that host
// (scripts/publish-map-data.mjs), so none of korea/ goes in.
import { execSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

/** The value Vite will build with: the shell first, then .env.local / .env like Vite. */
function mapDataUrl() {
  if (process.env.VITE_MAP_DATA_URL?.trim()) return process.env.VITE_MAP_DATA_URL.trim();
  for (const file of ['.env.production.local', '.env.local', '.env.production', '.env']) {
    try {
      const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => /^\s*VITE_MAP_DATA_URL\s*=/.test(l));
      const value = line?.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (value) return value;
    } catch { /* no such file */ }
  }
  return '';
}

if (!process.argv.includes('--skip-build')) run('npm run build');
const hosted = mapDataUrl();
const pruned = hosted ? ['korea'] : ['korea/detail', 'korea/city', 'korea/region', 'korea/country', 'korea/manifest.json'];
for (const p of [...pruned, 'overture']) rmSync(`dist/${p}`, { recursive: true, force: true });
console.log(hosted
  ? `Map data from ${hosted} — not bundled.`
  : 'Map data bundled into the APK (set VITE_MAP_DATA_URL to read it from a host instead).');
run('npx cap sync android');
