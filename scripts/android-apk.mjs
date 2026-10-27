// Builds the debug APK with the Gradle wrapper for this OS (gradlew.bat only runs on Windows; gradlew is run through sh since Git may not keep its exec bit).
// On a Mac without JAVA_HOME, falls back to Homebrew's openjdk@21 — Capacitor 8 needs JDK 21.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { loadEnv } from 'vite';
import { androidBackend, checkAndroidBackend, checkAndroidBundle } from './android-config.mjs';

const backend = androidBackend(loadEnv('production', process.cwd(), 'VITE_'), process.argv.includes('--local-only'));
await checkAndroidBackend(backend);
const assets = 'android/app/src/main/assets/public/assets';
checkAndroidBundle(backend, readdirSync(assets).filter((name) => name.endsWith('.js')).map((name) => readFileSync(`${assets}/${name}`, 'utf8')));

const env = { ...process.env };
const brewJdk = '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
if (!env.JAVA_HOME && process.platform === 'darwin' && existsSync(brewJdk)) env.JAVA_HOME = brewJdk;

const gradlew = process.platform === 'win32' ? 'gradlew.bat' : 'sh gradlew';
// A fresh package avoids the unused ZIP space left by incremental asset replacement.
execSync(`${gradlew} :app:clean :app:assembleDebug`, { cwd: 'android', stdio: 'inherit', env });
