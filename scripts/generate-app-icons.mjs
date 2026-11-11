// Regenerate the launcher icons, one per app theme (설정 → 디스플레이, 2026-11-11):
// 말차 is the primary icon, 바나나, 초코 and 딸기 are alternates the app switches to.
// Each is the logo on a tile in the theme's colour with a white pin (drafts
// output/app-icon-drafts/, B). Writes public/brand/root-in-<theme>.svg (+ -mark),
// Android mipmaps (ic_launcher[_<theme>]…), iOS app icon sets and the web icons.
// Use PLAYWRIGHT_CHANNEL=chrome when using an installed Chrome instead of Playwright Chromium.
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROUTE = 'M111.7 140.7C125.7 139.7 143.7 140.7 148.7 145.7C152.7 150.7 142.7 151.7 133.7 153.7C123.7 155.7 110.7 158.7 112.7 162.7C114.7 166.7 155.7 168.7 215.7 174.7';
const PIN = 'M60 86A36 36 0 0 1 132 86C132 113 113 128 96 152C79 128 60 113 60 86ZM80 86a16 16 0 1 0 32 0a16 16 0 1 0-32 0Z';

/** Keep in step with --logo-* in styles.css (each theme block). */
export const ICON_THEMES = {
  matcha: { tile: '#a3c46f', pin: '#ffffff', ink: '#3e5329' },
  banana: { tile: '#ffd85f', pin: '#ffffff', ink: '#a66726' },
  choco: { tile: '#a8704b', pin: '#ffffff', ink: '#4a2a1a' },
  strawberry: { tile: '#f48fa6', pin: '#ffffff', ink: '#a8324f' },
};
const PRIMARY = 'matcha';

// A soft shadow under the pin and route, in the theme's dark ink, lifts them off the tile.
const markOf = ({ pin, ink }) =>
  `<defs><filter id="lift" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2.4" flood-color="${ink}" flood-opacity="0.32"/></filter></defs><g filter="url(#lift)"><path d="${ROUTE}" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="105.7" cy="139.7" rx="11" ry="5.5" fill="${ink}"/><g transform="translate(96 96) scale(0.8059) translate(-96 -100.5) rotate(-12 96 96) translate(96 152) scale(1.12) translate(-96 -152)"><path d="${PIN}" fill="${pin}" fill-rule="evenodd"/></g></g>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">${body}</svg>`;

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  async function render(content, size, path, transparent = false) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>${content}`);
    await page.screenshot({ path, omitBackground: transparent });
  }

  const colors = [];
  for (const [theme, c] of Object.entries(ICON_THEMES)) {
    const full = svg(`<rect width="192" height="192" fill="${c.tile}"/>${markOf(c)}`);
    const mark = svg(markOf(c));
    const round = svg(`<defs><clipPath id="round"><circle cx="96" cy="96" r="96"/></clipPath></defs><g clip-path="url(#round)"><rect width="192" height="192" fill="${c.tile}"/>${markOf(c)}</g>`);
    await writeFile(`public/brand/root-in-${theme}.svg`, full);
    await writeFile(`public/brand/root-in-mark-${theme}.svg`, mark);

    // Android: the primary keeps the plain names; alternates get a _<theme> suffix.
    const name = theme === PRIMARY ? 'ic_launcher' : `ic_launcher_${theme}`;
    const bg = theme === PRIMARY ? 'ic_launcher_background' : `ic_launcher_background_${theme}`;
    colors.push(`    <color name="${bg}">${c.tile}</color>`);
    for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
      const dir = `android/app/src/main/res/mipmap-${density}`;
      await render(full, 48 * scale, `${dir}/${name}.png`);
      await render(round, 48 * scale, `${dir}/${name}_round.png`, true);
      // The mark keeps its adaptive-icon safe-zone geometry and transparent pin hole.
      await render(mark, 108 * scale, `${dir}/${name}_foreground.png`, true);
    }
    for (const suffix of ['', '_round']) {
      await writeFile(
        `android/app/src/main/res/mipmap-anydpi-v26/${name}${suffix}.xml`,
        `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/${bg}"/>\n    <foreground android:drawable="@mipmap/${name}_foreground"/>\n</adaptive-icon>\n`,
      );
    }

    // iOS: AppIcon is the primary; alternates are their own sets (named in the
    // target's ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES).
    const set = theme === PRIMARY ? 'AppIcon' : `AppIcon-${theme[0].toUpperCase()}${theme.slice(1)}`;
    const dir = `ios/App/App/Assets.xcassets/${set}.appiconset`;
    await mkdir(dir, { recursive: true });
    await render(full, 1024, `${dir}/AppIcon-512@2x.png`);
    await writeFile(
      `${dir}/Contents.json`,
      JSON.stringify({ images: [{ filename: 'AppIcon-512@2x.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }], info: { author: 'xcode', version: 1 } }, null, 2) + '\n',
    );

    // Web: the tab icon and home-screen icon per theme (lib/appIcon swaps them).
    await render(full, 180, `public/brand/apple-touch-icon-${theme}.png`);
    if (theme === PRIMARY) {
      await writeFile('public/favicon.svg', full);
      await render(full, 180, 'public/apple-touch-icon.png');
    }
  }
  await writeFile('android/app/src/main/res/values/ic_launcher_background.xml', `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${colors.join('\n')}\n</resources>\n`);
} finally {
  await browser.close();
}
console.log('Wrote the 말차 (primary), 바나나, 초코 and 딸기 icons for Android, iOS and the web.');
