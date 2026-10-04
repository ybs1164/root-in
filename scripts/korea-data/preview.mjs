import { chromium } from 'playwright';
import { mkdir, readdir } from 'node:fs/promises';

const base = process.env.SHOTS_URL ?? 'http://localhost:5188';
await mkdir('ui-shots/korea', { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL ?? 'msedge' });
const scenes = [
  { name: 'country', center: [127.8, 36], zoom: 6.4 },
  { name: 'seoul-region', center: [126.978, 37.5665], zoom: 9 },
  { name: 'seoul-city', center: [126.978, 37.5665], zoom: 11 },
  { name: 'seoul-district', center: [126.978, 37.5665], zoom: 12 },
  { name: 'seoul-streets', center: [126.978, 37.5665], zoom: 15 },
  { name: 'busan', center: [129.0756, 35.1796], zoom: 14 },
  { name: 'jeju', center: [126.53, 33.5], zoom: 13 },
  { name: 'ulleungdo', center: [130.9, 37.5], zoom: 11 },
  { name: 'dokdo', center: [131.867, 37.242], zoom: 14 },
];
const results = [];
const deviceFilter = process.env.SHOTS_DEVICE;
const sceneFilter = process.env.SHOTS_SCENE;
const detailOnly = process.argv.includes('--detail-only');
const partialManifest = detailOnly ? {
  version: 1,
  levels: await Promise.all([['detail', .05], ['city', .2], ['region', 1], ['country', 4]].map(async ([name, step]) => ({
    name, step, tiles: name === 'detail' ? (await readdir(`public/korea/${name}`)).filter((p) => p.endsWith('.json')).map((p) => p.slice(0, -5)) : [],
  }))),
} : null;
for (const [device, viewport] of Object.entries({ mobile: { width: 375, height: 812 }, desktop: { width: 1280, height: 800 } })) {
  if (deviceFilter && device !== deviceFilter) continue;
  const page = await browser.newPage({ viewport });
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (message) => {
    if (message.text().startsWith('District ')) console.log(message.text());
  });
  page.on('requestfailed', (r) => requests.push({ url: r.url(), error: r.failure()?.errorText }));
  page.on('response', (r) => { if (r.status() >= 400) requests.push({ url: r.url(), status: r.status() }); });
  if (partialManifest) await page.route('**/korea/manifest.json', (route) => route.fulfill({ json: partialManifest }));
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__courseMap?.provider === 'maplibre', { timeout: 30000 });
  await page.waitForFunction(() => window.__courseMap?.map?.isStyleLoaded());
  for (const scene of detailOnly ? scenes.filter((s) => s.name === 'seoul-streets') : scenes) {
    if (sceneFilter && scene.name !== sceneFilter) continue;
    console.log(`Checking ${device}/${scene.name}`);
    const camera = { ...scene, country: scene.name === 'country', mobile: device === 'mobile' };
    await page.evaluate(({ center, zoom, country, mobile }) => {
      window.__previousDistrict = window.__courseMap.district;
      if (country) {
        // Include Jeju, the western islands, Ulleungdo and Dokdo within the
        // visible area left by the existing sheet and bottom controls.
        window.__courseMap.map.fitBounds([[124.4, 33], [132.2, 38.7]], {
          duration: 0,
          padding: mobile ? { top: 375, bottom: 105, left: 10, right: 10 } : { top: 35, bottom: 80, left: 430, right: 35 },
        });
      } else window.__courseMap.map.jumpTo({ center, zoom });
    }, camera);
    try { await page.waitForFunction(({ center }) => {
      const district = window.__courseMap?.district;
      if (!district || district === window.__previousDistrict || district.blocks.length === 0) return false;
      const xs = district.region.map((p) => p[0]), ys = district.region.map((p) => p[1]);
      const bounds = window.__courseMap.map.getBounds();
      return center[0] >= Math.min(...xs) && center[0] <= Math.max(...xs) && center[1] >= Math.min(...ys) && center[1] <= Math.max(...ys) &&
        Math.abs(Math.min(...xs) - bounds.getWest()) < 1e-6 && Math.abs(Math.max(...xs) - bounds.getEast()) < 1e-6 &&
        Math.abs(Math.min(...ys) - bounds.getSouth()) < 1e-6 && Math.abs(Math.max(...ys) - bounds.getNorth()) < 1e-6;
    }, camera, { timeout: 60000 }); } catch (error) {
      console.log(JSON.stringify({ device, scene: scene.name, requests, errors, state: await page.evaluate(() => ({
        provider: window.__courseMap?.provider,
        center: window.__courseMap?.map?.getCenter().toArray(),
        zoom: window.__courseMap?.map?.getZoom(),
        district: window.__courseMap?.district ? { region: window.__courseMap.district.region, blocks: window.__courseMap.district.blocks.length, same: window.__courseMap.district === window.__previousDistrict } : null,
      })) }, null, 2));
      await page.screenshot({ path: `ui-shots/korea/failed-${device}-${scene.name}.png` });
      await browser.close();
      throw error;
    }
    await page.waitForTimeout(1500);
    const result = await page.evaluate(() => {
      const map = window.__courseMap.map;
      const bounds = map.getBounds();
      const mpp = (bounds.getEast() - bounds.getWest()) * 111320 * Math.cos((bounds.getSouth() + bounds.getNorth()) / 2 * Math.PI / 180) / map.getContainer().clientWidth;
      const blocks = window.__courseMap.district.blocks;
      const areas = blocks.filter((b) => b.areaM2 !== undefined && !b.continuesBeyondTile).map((b) => b.areaM2 / mpp ** 2);
      const compactness = [];
      for (const block of blocks) {
        if (block.holes.length) throw new Error('Convex block has an interior hole');
        const p = block.outer.slice(0, -1).map((at) => {
          const point = map.project(at); return [point.x, point.y];
        });
        const turns = p.map((a, i) => {
          const b = p[(i + 1) % p.length], c = p[(i + 2) % p.length];
          return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        });
        if (!turns.every((t) => t >= -1e-6) && !turns.every((t) => t <= 1e-6)) throw new Error('Non-convex screen block');
        const area = Math.abs(p.reduce((sum, a, i) => {
          const b = p[(i + 1) % p.length]; return sum + a[0] * b[1] - b[0] * a[1];
        }, 0)) / 2;
        const perimeter = p.reduce((sum, a, i) => {
          const b = p[(i + 1) % p.length]; return sum + Math.hypot(a[0] - b[0], a[1] - b[1]);
        }, 0);
        compactness.push(4 * Math.PI * area / perimeter ** 2);
        if (p.length < 32) throw new Error('Unrounded district fragment');
        if (compactness.at(-1) < .8) throw new Error('District is too narrow or pointed');
      }
      if (blocks.length < 10 || blocks.length > 30) throw new Error('District count is outside 10–30');
      return { blocks: blocks.length, center: map.getCenter().toArray(), zoom: map.getZoom(),
        minRegionAreaPx2: areas.length ? Math.min(...areas) : null,
        roadWidthPx: window.__courseMap.district.roadWidthPx,
        minCompactness: Math.min(...compactness) };
    });
    await page.screenshot({ path: `ui-shots/korea/${device}-${scene.name}.png` });
    results.push({ device, scene: scene.name, ...result });
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await page.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
