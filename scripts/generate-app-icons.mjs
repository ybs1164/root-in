// Regenerate launcher icons from the existing light brand SVGs.
// Use PLAYWRIGHT_CHANNEL=chrome when using an installed Chrome instead of Playwright Chromium.
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const light = await readFile('public/brand/root-in-light.svg', 'utf8');
const mark = await readFile('public/brand/root-in-mark-light.svg', 'utf8');
const tile = await readFile('public/brand/root-in-tile-light.svg', 'utf8');
const background = tile.match(/fill="(#[a-f\d]{6})"/i)?.[1];
if (!background) throw new Error('Light brand tile must define a background colour.');

const round = light.replace(/(<svg\b[^>]*>)([\s\S]*)(<\/svg>)/, '$1<defs><clipPath id="round"><circle cx="96" cy="96" r="96"/></clipPath></defs><g clip-path="url(#round)">$2</g>$3');
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  async function render(svg, size, path, transparent = false) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>${svg}`);
    await page.screenshot({ path, omitBackground: transparent });
  }

  for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
    const dir = `android/app/src/main/res/mipmap-${density}`;
    await render(light, 48 * scale, `${dir}/ic_launcher.png`);
    await render(round, 48 * scale, `${dir}/ic_launcher_round.png`, true);
    // Preserve the mark's existing adaptive-icon safe-zone geometry and transparent pin hole.
    await render(mark, 108 * scale, `${dir}/ic_launcher_foreground.png`, true);
  }
  await render(light, 1024, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
  await render(light, 180, 'public/apple-touch-icon.png');
} finally {
  await browser.close();
}

await writeFile('public/favicon.svg', light);
await writeFile('android/app/src/main/res/values/ic_launcher_background.xml', `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${background}</color>\n</resources>\n`);
console.log('Applied the light brand to Android, iOS, and web icons.');
