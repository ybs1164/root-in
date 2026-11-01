import { Capacitor, registerPlugin } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import type { PushPlatform } from '../services/pushService';

// 그룹 알림 pushes on the phone apps (Capacitor PushNotifications): asks for
// permission, hands over the token, and says which group a tapped push was
// about. The browser gets no pushes — it has the in-app notice only.

const PushSetup = registerPlugin<{ ready(): Promise<{ ready: boolean }> }>('PushSetup');

function platform(): PushPlatform | null {
  const name = Capacitor.getPlatform();
  return name === 'android' || name === 'ios' ? name : null;
}

/**
 * Android without Firebase in the build (no google-services.json) crashes on
 * register(), so it asks the app's own PushSetup plugin first.
 */
async function canRegister(on: PushPlatform): Promise<boolean> {
  if (on === 'ios') return true;
  try {
    return (await PushSetup.ready()).ready;
  } catch {
    return false;
  }
}

/** A push was tapped: the group it was about, when it says. Phone apps only; returns the stop. */
export function onPushTap(handler: (groupId: string | null) => void): () => void {
  if (!platform()) return () => {};
  // Listening from the start: a push that opened the app is told as soon as someone listens.
  const handle = PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const group = (notification?.data as Record<string, unknown> | undefined)?.group;
    handler(typeof group === 'string' ? group : null);
  }).catch(() => null);
  return () => void handle.then((h) => h?.remove()).catch(() => undefined);
}

/**
 * Asks for permission and registers this phone (a no-op in the browser);
 * `onToken` gets its token (FCM on Android, APNs on iPhone) each time it's
 * given. Returns the stop. Never rejects.
 */
export function registerPush(onToken: (token: string, platform: PushPlatform) => void): () => void {
  const on = platform();
  if (!on) return () => {};
  let stopped = false;
  let handle: Promise<{ remove(): Promise<void> } | null> = Promise.resolve(null);
  const start = async () => {
    try {
      if (!(await canRegister(on)) || stopped) return;
      handle = PushNotifications.addListener('registration', ({ value }) => !stopped && onToken(value, on));
      let permission = await PushNotifications.checkPermissions();
      if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted' || stopped) return;
      await PushNotifications.register();
    } catch {
      // No pushes on this phone; the in-app notice still comes.
    }
  };
  void start();
  return () => {
    stopped = true;
    void handle.then((h) => h?.remove()).catch(() => undefined);
  };
}
