// Builds the app for the iOS Simulator (no signing needed) into ios/build.
import { execSync } from 'node:child_process';
import { xcodeEnv } from './xcode-env.mjs';

execSync(
  'xcodebuild -project App.xcodeproj -scheme App -configuration Debug ' +
    "-destination 'generic/platform=iOS Simulator' -derivedDataPath ../build build",
  { cwd: 'ios/App', stdio: 'inherit', env: xcodeEnv() },
);
console.log('\n→ ios/build/Build/Products/Debug-iphonesimulator/App.app');
