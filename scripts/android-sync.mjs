// Builds the web app and copies it into the Android project.
// public/korea also holds an old flat layout (detail/city/region/country, ~3GB) that
// no code reads — only korea/base and korea/admin are fetched — so keep it out of the APK.
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
if (!process.argv.includes('--skip-build')) run('npm run build');
for (const p of ['korea/detail', 'korea/city', 'korea/region', 'korea/country', 'korea/manifest.json', 'overture']) {
  rmSync(`dist/${p}`, { recursive: true, force: true });
}
run('npx cap sync android');
