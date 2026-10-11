import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.rootin.android',
  appName: 'root-in',
  webDir: 'dist',
  server: {
    // https origin so the Kakao JS key can be domain-restricted to https://localhost
    androidScheme: 'https',
  },
  android: {
    // Chrome remote debugging off in release builds
    webContentsDebuggingEnabled: false,
  },
};

export default config;
