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
  plugins: {
    // 그룹 알림 while the app is in front: its own notice says it (useGroupNews), not a system banner too.
    PushNotifications: { presentationOptions: [] },
  },
};

export default config;
