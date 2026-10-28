// xcodebuild refuses to run when xcode-select points at the Command Line Tools,
// and switching it needs sudo — so point DEVELOPER_DIR at Xcode.app for our commands only.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export function xcodeEnv() {
  const env = { ...process.env };
  if (env.DEVELOPER_DIR || process.platform !== 'darwin') return env;
  let selected = '';
  try {
    selected = execSync('xcode-select -p', { encoding: 'utf8' }).trim();
  } catch {
    // no developer directory selected at all
  }
  const xcode = '/Applications/Xcode.app/Contents/Developer';
  if (!selected.includes('Xcode') && existsSync(xcode)) env.DEVELOPER_DIR = xcode;
  return env;
}
