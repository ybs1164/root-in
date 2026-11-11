import { Capacitor, registerPlugin } from '@capacitor/core';
import type { AppTheme } from '../services/profileRepository';

// The app icon follows the app theme (설정 → 디스플레이, 2026-11-11): 말차 is the
// primary icon, 바나나 and 초코 are alternates (scripts/generate-app-icons.mjs).
// On the phone apps the AppIcon plugin swaps the launcher icon (iOS alternate
// icons, Android launcher aliases); in the browser the tab and home-screen icons.

const AppIcon = registerPlugin<{ set(options: { name: AppTheme }): Promise<void> }>('AppIcon');

export async function setAppIcon(theme: AppTheme): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await AppIcon.set({ name: theme });
    } catch {
      // An older app build without the plugin keeps its icon.
    }
    return;
  }
  const base = import.meta.env.BASE_URL;
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', `${base}brand/root-in-${theme}.svg`);
  document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.setAttribute('href', `${base}brand/apple-touch-icon-${theme}.png`);
}
