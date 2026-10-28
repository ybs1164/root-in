import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

const LocationSettings = registerPlugin<{ open(options: { target: 'permission' | 'services' }): Promise<void> }>('LocationSettings');
export async function openLocationSettings(target: 'permission' | 'services'): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') return false;
  try { await LocationSettings.open({ target }); return true; } catch { return false; }
}

/** Web visibility plus native activity state: neither may keep GPS running in the background. */
export function onAppVisibility(handler: (active: boolean) => void): () => void {
  let disposed = false;
  let nativeActive = true;
  let last: boolean | null = null;
  const emit = () => {
    const active = document.visibilityState === 'visible' && nativeActive;
    if (!disposed && active !== last) {
      last = active;
      handler(active);
    }
  };
  document.addEventListener('visibilitychange', emit);
  const listener = isNativeApp() ? App.addListener('appStateChange', ({ isActive }) => {
    nativeActive = isActive;
    emit();
  }) : null;
  emit();
  return () => {
    disposed = true;
    document.removeEventListener('visibilitychange', emit);
    void listener?.then((handle) => handle.remove());
  };
}

/** Android's system back button; a no-op in the browser. Returns the unsubscribe. */
export function onNativeBack(handler: () => boolean): () => void {
  if (!isNativeApp()) return () => {};
  const added = App.addListener('backButton', () => {
    // Nothing left to close: leave the app instead of swallowing the press.
    if (!handler()) void App.exitApp();
  });
  return () => void added.then((h) => h.remove());
}

/** Closes the topmost open modal <dialog> the way Esc would. True if there was one. */
export function closeTopDialog(): boolean {
  const open = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
  const top = open[open.length - 1];
  if (!top) return false;
  if (typeof top.requestClose === 'function') top.requestClose();
  else if (top.dispatchEvent(new Event('cancel', { cancelable: true }))) top.close();
  return true;
}
