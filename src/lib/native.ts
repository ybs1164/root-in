import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

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
