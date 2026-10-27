// Builds the debug APK with the Gradle wrapper for this OS (gradlew.bat only runs on Windows; gradlew is run through sh since Git may not keep its exec bit).
// On a Mac without JAVA_HOME, falls back to Homebrew's openjdk@21 — Capacitor 8 needs JDK 21.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const env = { ...process.env };
const brewJdk = '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
if (!env.JAVA_HOME && process.platform === 'darwin' && existsSync(brewJdk)) env.JAVA_HOME = brewJdk;

const gradlew = process.platform === 'win32' ? 'gradlew.bat' : 'sh gradlew';
execSync(`${gradlew} assembleDebug`, { cwd: 'android', stdio: 'inherit', env });
