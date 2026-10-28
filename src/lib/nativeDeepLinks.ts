import { App } from '@capacitor/app';
import { applyIncomingLink } from './deepLink';

interface LinkSource {
  addListener(event: 'appUrlOpen', listener: (event: { url: string }) => void): Promise<{ remove(): Promise<void> }>;
  getLaunchUrl(): Promise<{ url: string } | undefined>;
}

/** Registered once at startup, outside React's StrictMode effect replay. */
export async function startNativeDeepLinks(
  source: LinkSource = App,
  receive: (url: string) => boolean = applyIncomingLink,
): Promise<() => void> {
  let receivedLiveLink = false;
  const handle = await source.addListener('appUrlOpen', ({ url }) => {
    if (receive(url)) receivedLiveLink = true;
  });
  try {
    const launch = await source.getLaunchUrl();
    // A newer link received while startup was pending takes precedence.
    if (launch?.url && !receivedLiveLink) receive(launch.url);
  } catch {
    // Live links still work if the platform cannot supply a launch URL.
  }
  return () => { void handle.remove(); };
}
