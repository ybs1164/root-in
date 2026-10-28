// Builds the web app and copies it into the native project: `node scripts/native-sync.mjs android|ios`.
// public/korea also holds an old flat layout (detail/city/region/country, ~3GB) that
// no code reads — only korea/base and korea/admin are fetched — so keep it out of the app.
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { xcodeEnv } from './xcode-env.mjs';

const platform = process.argv[2];
if (platform !== 'android' && platform !== 'ios') throw new Error('usage: native-sync.mjs android|ios [--skip-build]');

const run = (cmd, env) => execSync(cmd, { stdio: 'inherit', env });
if (!process.argv.includes('--skip-build')) run('npm run build');
for (const p of ['korea/detail', 'korea/city', 'korea/region', 'korea/country', 'korea/manifest.json', 'overture']) {
  rmSync(`dist/${p}`, { recursive: true, force: true });
}
run(`npx cap sync ${platform}`, platform === 'ios' ? xcodeEnv() : process.env);
