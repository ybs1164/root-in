// The address links people send each other point at. In the Android shell the
// page lives at https://localhost, which on the receiver's phone is nothing, so
// a build that ships to phones sets VITE_PUBLIC_APP_URL to the web app's
// public address. Without it (dev, a plain web deploy) links use the page's own address.

/** Where share and invite links send people, without the #fragment. */
export function publicAppUrl(
  configured: string | undefined = import.meta.env.VITE_PUBLIC_APP_URL,
  here: () => string = () => `${window.location.origin}${window.location.pathname}`,
): string {
  const url = configured?.trim();
  if (url && /^https?:\/\//.test(url)) return url.split('#')[0];
  return here();
}

