// The Korea map data (base land tiles, admin areas, place kinds) is a package of
// its own (scripts/export-map-data.mjs) so other apps can read the same files.
// VITE_MAP_DATA_URL points at a hosted copy; without it the files ship with
// this app under korea/, as before.

/** Where the package's root is, ending in '/'. */
export function mapDataRoot(configured: string | undefined = import.meta.env.VITE_MAP_DATA_URL, appBase: string = import.meta.env.BASE_URL): string {
  const url = configured?.trim();
  if (url) return url.endsWith('/') ? url : `${url}/`;
  return `${appBase}korea/`;
}
