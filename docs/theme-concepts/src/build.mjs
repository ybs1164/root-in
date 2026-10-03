// Renders one concept board per theme candidate (docs/theme-concepts/<nn>-<id>.png).
// Concept art only: the app's real styles are untouched. Each board shows the
// same three screens (핀 지도 · 경로 · TODAY) so themes can be compared side by side.
// Usage: node docs/theme-concepts/src/build.mjs [themeId ...]
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES } from './themes.mjs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..');
const HTML_OUT = join(HERE, 'html');
const FONT_CACHE = join(HERE, '.fontcache');

// Headless Chromium here does not trust the egress proxy's CA, so web fonts are
// fetched with curl (which does) and served from a local cache. Google Fonts'
// \`text=\` subsetting keeps it to one small file per family/weight.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
function curl(url, out) {
  const args = ['-sS', '--fail', '-A', UA, url];
  if (out) args.push('-o', out);
  return execFileSync('curl', args, { encoding: out ? undefined : 'utf8', maxBuffer: 1 << 26 });
}
function localFontCss(families, text) {
  let css = '';
  for (const fam of families) {
    const url = `https://fonts.googleapis.com/css2?family=${fam}&text=${encodeURIComponent(text)}&display=block`;
    const key = createHash('sha1').update(url).digest('hex').slice(0, 16);
    const cssFile = join(FONT_CACHE, `${key}.css`);
    if (!existsSync(cssFile)) {
      let c = curl(url);
      c = c.replace(/url\((https:[^)]+)\)/g, (_, u) => {
        const f = join(FONT_CACHE, createHash('sha1').update(u).digest('hex').slice(0, 16) + '.woff2');
        if (!existsSync(f)) curl(u, f);
        return `url(file://${f})`;
      });
      execFileSync('sh', ['-c', 'cat > "$0"', cssFile], { input: c });
    }
    css += execFileSync('cat', [cssFile], { encoding: 'utf8' });
  }
  return css;
}

// ---------- icons (Lucide geometry, ISC) ----------
const P = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  pen: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
  trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  sticker: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/><path d="M8 13h.01M16 13h.01M10 16s.8 1 2 1c1.3 0 2-1 2-1"/>',
  brush: '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
  type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  palette: '<path d="M12 22a10 10 0 1 1 10-10c0 2.5-2 3.5-3.5 3.5H16a2 2 0 0 0-1.5 3.3c.6.8.2 3.2-2.5 3.2z"/><circle cx="7.5" cy="10.5" r=".5"/><circle cx="12" cy="7.5" r=".5"/><circle cx="16.5" cy="10.5" r=".5"/>',
  sparkles: '<path d="M9.94 14.06 8 20l-1.94-5.94L0 12l6.06-1.94L8 4l1.94 6.06L16 12z" transform="translate(4 -1) scale(.85)"/><path d="M20 3v4M22 5h-4"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  check: '<path d="M3 17l2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
};
const ic = (n, cls = '') => `<svg class="ic ic-${n} ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;
const PIN_PATH = 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0';

// ---------- fake map ----------
function mapSvg() {
  const blocks = [];
  for (let y = -260; y < 1080; y += 66) {
    for (let x = -260; x < 640; x += 82) {
      const w = 70 + ((x * 7 + y * 3) % 3) * 0;
      blocks.push(`<rect class="blk" x="${x}" y="${y}" width="${w}" height="56" rx="5"/>`);
    }
  }
  return `<svg viewBox="0 0 375 812" preserveAspectRatio="xMidYMid slice">
  <rect class="road-fill" width="375" height="812"/>
  <g transform="rotate(-14 187 406)">${blocks.join('')}
    <path class="major" d="M-300 300H700M-300 560H700M140 -300V1100"/>
  </g>
  <path class="park" d="M8 168c30-22 92-30 132-8 20 22 18 74-6 104-36 28-104 30-126 6-16-28-22-74 0-102z"/>
  <path class="water" d="M-20 650c70-30 140-6 210-22s130-48 210-34v120c-80-10-140 26-210 38s-150-6-210 22z"/>
  <text class="lbl" x="44" y="222">서울숲</text>
  <text class="lbl" x="214" y="132">성수동</text>
  <text class="lbl lbl-w" x="150" y="716">한강</text>
</svg>`;
}

const D = (x, y, inner, style = '') => `<div class="deco" style="left:${x}px;top:${y}px;${style}">${inner}</div>`;

const status = () => `<div class="status"><span>9:41</span><span class="st-r"><svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="6" rx="1"/><rect x="10" y="2.5" width="3" height="8.5" rx="1"/><rect x="15" y="0" width="3" height="11" rx="1"/></svg><svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="17" height="8" rx="2"/><rect x="23.5" y="4" width="2" height="4" rx="1" opacity=".45"/></svg></span></div>`;

function screenMap(t) {
  const cats = t.cats ?? ['☕', '🍽️', '🌳', '🛍️'];
  const pins = [
    [92, 236, 'var(--p3)', cats[2]],
    [248, 268, 'var(--p1)', cats[0]],
    [128, 352, 'var(--p2)', cats[1]],
    [268, 548, 'var(--p4)', cats[3]],
    [86, 520, 'var(--p1)', cats[0]],
    [226, 610, 'var(--p2)', cats[1]],
  ];
  return `<div class="scr scr-map">
  <div class="map">${mapSvg()}</div><div class="map-overlay"></div>
  <div class="back">${(t.deco?.mapBack ?? []).join('')}</div>
  <div class="pins">${pins.map(([x, y, c, e]) => `<div class="pin" style="left:${x}px;top:${y}px;--c:${c}"><span>${e}</span></div>`).join('')}
    <div class="pin sel" style="left:188px;top:452px;--c:var(--p1)"><span>${cats[0]}</span></div></div>
  <div class="card" style="left:188px;top:420px">${t.card ? t.card({ ic, cats }) : `
    <div class="card-row"><span class="card-ic">${cats[0]}</span><b class="card-name">어니언 성수</b>${ic('pen', 'card-pen')}</div>
    <div class="card-sub">카페 · 성동구 아차산로9길 8</div>
    <div class="card-row card-row2">${ic('more')}${ic('trash')}</div>`}
  </div>
  ${status()}
  <div class="top"><div class="search">${ic('search')}<span>장소 · 주소 검색</span></div><div class="profile">${ic('user')}</div></div>
  <div class="rail"><div class="rb on">${ic('pin')}</div><div class="rb all on2">ALL</div>${cats.map((e) => `<div class="rb cat">${e}</div>`).join('')}<div class="rb">${ic('route')}</div></div>
  <div class="bottom"><div class="tab" data-l="CAL">${ic('cal')}</div><div class="tab big on" data-l="PIN">${ic('pin')}</div></div>
  <div class="fab">${ic('plus')}</div>
  ${(t.deco?.map ?? []).join('')}
</div>`;
}

function screenRoute(t) {
  const stops = [[96, 404], [214, 372], [292, 480], [170, 548]];
  const lines = stops.slice(1).map((s, i) => `<line x1="${stops[i][0]}" y1="${stops[i][1]}" x2="${s[0]}" y2="${s[1]}"/>`).join('');
  const folders = t.folders ?? ['🍰', '✈️', '🎬'];
  return `<div class="scr scr-route">
  <div class="map">${mapSvg()}</div><div class="map-overlay"></div>
  <div class="back">${(t.deco?.routeBack ?? []).join('')}</div>
  <svg class="rlines" viewBox="0 0 375 812">${lines}</svg>
  ${stops.map(([x, y], i) => `<div class="stop" style="left:${x}px;top:${y}px">${i + 1}</div>`).join('')}
  ${status()}
  <div class="top"><div class="search">${ic('search')}<span>장소 · 주소 검색</span></div><div class="profile">${ic('user')}</div></div>
  <div class="rail"><div class="rb">${ic('pin')}</div><div class="rb on">${ic('route')}</div></div>
  <div class="rtitle"><div class="rt-icon">${t.routeIcon ?? '☕'}</div><div class="rt-name">${t.routeName ?? '성수 데이트'}${ic('pen', 'rt-pen')}</div></div>
  <div class="step step-l">${ic('left')}</div><div class="step step-r">${ic('right')}</div>
  <div class="tray">
    <div class="ftabs"><div class="ftab">${ic('layers')}</div><div class="ftab">${ic('inbox')}</div><div class="ftab on">${folders[0]}</div><div class="ftab">${folders[1]}</div><div class="ftab">${folders[2]}</div><div class="ftab add">${ic('plus')}</div></div>
    <div class="tray-tools">${ic('check')}${ic('plus')}</div>
    <div class="row on"><span class="row-ic">${t.routeIcon ?? '☕'}</span><div class="row-main"><b>성수 데이트</b><small>브런치 → 서울숲 산책 → 저녁은 갈비</small></div><span class="row-f">${folders[0]}</span>
      <div class="row-btns">${ic('folder')}${ic('trash')}</div></div>
    <div class="row"><span class="row-ic">🌙</span><div class="row-main"><b>을지로 밤 산책</b><small>노가리 골목부터 세운상가까지</small></div><span class="row-f">${folders[0]}</span></div>
  </div>
  ${(t.deco?.route ?? []).join('')}
</div>`;
}

function screenDay(t) {
  const pts = [[44, 300], [92, 150], [160, 214], [214, 92], [236, 262]];
  const shapes = pts.map(([x, y], i) => {
    const big = i === pts.length - 1;
    const s = big ? 46 : 30;
    return `<svg class="ping ${big ? 'big' : ''}" style="left:${x - s / 2}px;top:${y - s}px;width:${s}px;height:${s}px;--c:var(--p${(i % 4) + 1})" viewBox="0 0 24 24"><path d="${PIN_PATH}"/><circle cx="12" cy="10" r="3.2"/></svg>`;
  }).join('');
  const lines = pts.slice(1).map((p, i) => `<line x1="${pts[i][0]}" y1="${pts[i][1] - 4}" x2="${p[0]}" y2="${p[1] - 4}"/>`).join('');
  return `<div class="scr scr-day">
  <div class="day-bg"></div>
  <div class="back">${(t.deco?.dayBack ?? []).join('')}</div>
  ${status()}
  <div class="profile day-profile">${ic('user')}</div>
  <div class="dtitle">${t.dayTitle ?? 'TODAY'}</div>
  <div class="ddate">${t.dayDate ?? '2026. 10. 03 · SAT'}</div>
  <div class="drawing"><svg class="dlines" viewBox="0 0 280 380">${lines}</svg>${shapes}</div>
  <div class="dtext">${t.dayText ?? '성수에서 하루 종일 ☀'}</div>
  <div class="drail"><div class="rb">${ic('sticker')}</div><div class="rb">${ic('brush')}</div><div class="rb">${ic('type')}</div><div class="rb">${ic('palette')}</div><div class="rb">${ic('sparkles')}</div><div class="rb share">${ic('share')}</div></div>
  <div class="step step-l day-step">${ic('left')}</div>
  <div class="bottom"><div class="tab big on" data-l="CAL">${ic('cal')}</div><div class="tab" data-l="PIN">${ic('pin')}</div></div>
  ${(t.deco?.day ?? []).join('')}
</div>`;
}

const NOISE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

const BASE_VARS = {
  bg: '#fbf6f0', surface: '#ffffff', 'surface-2': '#f5eee6', text: '#2f2622', muted: '#8b7d74',
  line: 'rgba(47,38,34,.12)', accent: '#e0664f', 'on-accent': '#ffffff', a2: '#4f9a72', a3: '#3f7fc4',
  bw: '0px', 'r-pill': '999px', 'r-card': '18px', 'r-btn': '50%',
  shadow: '0 10px 30px rgba(47,38,34,.16)', 'shadow-sm': '0 2px 10px rgba(47,38,34,.12)', 'pin-shadow': '0 2px 3px rgba(47,38,34,.25)',
  'btn-bg': 'var(--surface)', 'btn-fg': 'var(--text)',
  'font-ui': "'Noto Sans KR', sans-serif", 'font-title': "'Noto Sans KR', sans-serif", 'font-hand': "'Nanum Pen Script', cursive", 'font-label': 'var(--font-ui)',
  'map-land': '#f1ece4', 'map-block': '#ebe4d9', 'map-block-stroke': 'none', 'map-block-sw': '0', 'map-road': '#ffffff', 'map-major': '#fde3b0', 'map-major-w': '9', 'map-water': '#bcd8ee', 'map-park': '#cfe6c5', 'map-label': 'rgba(47,38,34,.45)',
  route: 'var(--accent)', 'route-w': '4', 'route-dash': 'none', 'stop-bg': 'var(--accent)', 'stop-fg': 'var(--on-accent)',
  p1: '#e0564a', p2: '#2e86de', p3: '#16a085', p4: '#8e4fb8',
  'title-color': 'var(--text)', 'tray-bg': 'var(--surface)', 'tab-off': 'var(--surface-2)', step: '#c9c1ba',
  'day-bg': 'var(--bg)', 'ping-hole': '#ffffff', 'dline': 'var(--text)',
  board: '#efebe6', 'board-ink': '#2f2622',
};

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--board);font-family:var(--font-ui);color:var(--text);width:1300px;-webkit-font-smoothing:antialiased}
.board{padding:40px 44px 40px;position:relative;overflow:hidden}
.head{display:grid;grid-template-columns:1fr auto;gap:12px 40px;align-items:end;margin-bottom:30px;color:var(--board-ink);position:relative;z-index:2}
.head .no{font:700 13px/1 'Noto Sans KR';letter-spacing:.18em;opacity:.55;margin-bottom:10px}
.head h1{font-family:var(--font-title);font-size:58px;line-height:1.05;font-weight:900}
.head h1 small{font:600 18px 'Noto Sans KR';opacity:.6;margin-left:14px;letter-spacing:.06em}
.head .desc{font:500 15px/1.6 'Noto Sans KR';opacity:.85;margin-top:10px;max-width:760px}
.head .feel{font:400 13.5px/1.6 'Noto Sans KR';opacity:.65;margin-top:4px;max-width:760px}
.sws{display:flex;gap:16px}
.sw{display:flex;flex-direction:column;align-items:center;gap:6px;font:600 11.5px 'Noto Sans KR'}
.sw i{width:52px;height:52px;border-radius:50%;display:block;box-shadow:0 0 0 1px rgba(0,0,0,.12),0 4px 10px rgba(0,0,0,.12)}
.sw em{font-style:normal;opacity:.6;font-weight:500;font-size:10.5px}
.phones{display:flex;gap:44px;position:relative;z-index:2}
.cap{text-align:center;margin-top:14px;font:600 14px 'Noto Sans KR';color:var(--board-ink);opacity:.75}
.phone{width:375px;height:812px;border-radius:46px;overflow:hidden;position:relative;background:var(--bg);box-shadow:0 30px 60px rgba(0,0,0,.2),0 0 0 1px rgba(0,0,0,.1);isolation:isolate}
.scr{position:absolute;inset:0;overflow:hidden}
.ic{width:22px;height:22px;stroke-width:var(--icon-sw,2);flex:none}
.back{position:absolute;inset:0;z-index:2;pointer-events:none}
.deco{position:absolute;z-index:40;pointer-events:none;line-height:1}
.status{position:absolute;top:0;left:0;right:0;height:44px;display:flex;justify-content:space-between;align-items:center;padding:4px 26px 0 34px;font:600 15px 'Noto Sans KR';z-index:60;color:var(--status-ink,var(--text))}
.status svg{fill:currentColor}.st-r{display:flex;gap:6px;align-items:center}
/* map */
.map{position:absolute;inset:0}
.map svg{width:100%;height:100%;display:block}
.map .road-fill{fill:var(--map-road)}
.map .blk{fill:var(--map-block);stroke:var(--map-block-stroke);stroke-width:var(--map-block-sw)}
.map .major{stroke:var(--map-major);stroke-width:var(--map-major-w);fill:none}
.map .park{fill:var(--map-park)}.map .water{fill:var(--map-water)}
.map .lbl{font:600 11px var(--font-ui);fill:var(--map-label)}
.map-overlay{position:absolute;inset:0;pointer-events:none}
/* top */
.top{position:absolute;top:50px;left:16px;right:16px;display:flex;gap:10px;z-index:20}
.search{flex:1;height:48px;border-radius:var(--r-pill);background:var(--search-bg,var(--surface));border:var(--bw) solid var(--line);box-shadow:var(--shadow-sm);display:flex;align-items:center;gap:10px;padding:0 16px;color:var(--muted);font-size:16px}
.search .ic{width:20px;height:20px}
.profile{width:48px;height:48px;border-radius:50%;background:var(--profile-bg,var(--surface-2));border:var(--bw) solid var(--line);display:grid;place-items:center;color:var(--profile-fg,var(--muted));box-shadow:var(--shadow-sm);flex:none}
.rail,.drail{position:absolute;top:110px;right:18px;display:flex;flex-direction:column;gap:10px;z-index:20}
.rb{width:44px;height:44px;border-radius:var(--r-btn);background:var(--btn-bg);color:var(--btn-fg);border:var(--bw) solid var(--line);box-shadow:var(--shadow-sm);display:grid;place-items:center;font-size:19px}
.rb .ic{width:21px;height:21px}
.rb.on{background:var(--accent);color:var(--on-accent)}
.rb.all{font:800 12px var(--font-label);letter-spacing:.04em}
.rb.all.on2{background:var(--all-bg,var(--accent));color:var(--all-fg,var(--on-accent))}
/* pins */
.pin{position:absolute;width:32px;height:32px;margin:-16px 0 0 -16px;border-radius:var(--pin-r,50%);background:var(--c);display:grid;place-items:center;font-size:15px;box-shadow:var(--pin-shadow);border:var(--pin-bw,0px) solid var(--pin-border,#fff);z-index:5}
.pin.sel{width:40px;height:40px;margin:-20px 0 0 -20px;font-size:19px;z-index:6}
/* card */
.card{position:absolute;width:262px;transform:translate(-50%,-100%);background:var(--card-bg,var(--surface));color:var(--card-fg,var(--text));border-radius:var(--r-card);box-shadow:var(--shadow);border:var(--bw) solid var(--line);padding:12px 14px 10px;z-index:30}
.card::after{content:'';position:absolute;left:50%;bottom:-8px;width:16px;height:16px;margin-left:-8px;transform:rotate(45deg);background:inherit;border-right:var(--bw) solid var(--line);border-bottom:var(--bw) solid var(--line)}
.card-row{display:flex;align-items:center;gap:10px}
.card-ic{width:38px;height:38px;border-radius:var(--r-btn);background:var(--surface-2);display:grid;place-items:center;font-size:20px;flex:none}
.card-name{flex:1;font:800 18px var(--font-card,var(--font-ui));letter-spacing:-.01em}
.card-pen{width:18px;height:18px;color:var(--muted)}
.card-sub{font-size:12.5px;color:var(--muted);margin:6px 0 0 48px}
.card-row2{justify-content:space-between;margin-top:6px;color:var(--muted)}
.card-row2 .ic{width:20px;height:20px}
/* bottom */
.bottom{position:absolute;bottom:30px;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:18px;z-index:20}
.tab{width:50px;height:50px;border-radius:var(--r-btn);background:var(--btn-bg);color:var(--btn-fg);box-shadow:var(--shadow);border:var(--bw) solid var(--line);display:grid;place-items:center}
.tab.big{width:68px;height:68px;background:var(--accent);color:var(--on-accent)}
.tab.big .ic{width:30px;height:30px}
.fab{position:absolute;right:18px;bottom:39px;width:50px;height:50px;border-radius:var(--r-btn);background:var(--btn-bg);color:var(--btn-fg);box-shadow:var(--shadow);border:var(--bw) solid var(--line);display:grid;place-items:center;z-index:20}
/* route */
.rlines{position:absolute;inset:0;width:100%;height:100%;z-index:4}
.rlines line{stroke:var(--route);stroke-width:var(--route-w);stroke-dasharray:var(--route-dash);stroke-linecap:round}
.stop{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:var(--pin-r,50%);background:var(--stop-bg);color:var(--stop-fg);display:grid;place-items:center;font:800 14px var(--font-label);z-index:6;box-shadow:var(--pin-shadow);border:var(--pin-bw,0px) solid var(--pin-border,#fff)}
.rtitle{position:absolute;top:214px;left:50px;right:50px;text-align:center;z-index:15;color:var(--title-color)}
.rt-icon{font-size:32px;margin-bottom:10px}
.rt-name{font:900 38px/1.12 var(--font-title);position:relative;display:inline-block;word-break:keep-all}
.rt-pen{position:absolute;right:-24px;bottom:2px;width:16px;height:16px;color:var(--muted)}
.step{position:absolute;top:420px;width:34px;height:64px;display:grid;place-items:center;color:var(--step);z-index:15}
.step .ic{width:30px;height:30px;stroke-width:2.4}
.step-l{left:4px}.step-r{right:4px}
.tray{position:absolute;left:0;right:0;bottom:0;height:200px;background:var(--tray-bg);border-radius:var(--r-tray,22px 22px 0 0);z-index:25;box-shadow:var(--shadow-up,0 -6px 24px rgba(0,0,0,.12));border-top:var(--bw) solid var(--line);padding:14px 16px 0}
.ftabs{position:absolute;top:-40px;left:12px;display:flex;gap:4px}
.ftab{width:50px;height:40px;border-radius:var(--r-tab,14px 14px 0 0);background:var(--tab-off);display:grid;place-items:center;font-size:19px;color:var(--muted);border:var(--bw) solid var(--line);border-bottom:0}
.ftab .ic{width:19px;height:19px}
.ftab.on{background:var(--tray-bg);color:var(--text);height:42px}
.ftab.add{background:transparent;border-color:transparent}
.tray-tools{position:absolute;right:16px;top:10px;display:flex;gap:14px;color:var(--muted)}
.tray-tools .ic{width:20px;height:20px}
.row{display:flex;align-items:flex-start;gap:12px;padding:10px 4px;position:relative;margin-top:22px}
.row + .row{margin-top:0;border-top:1px solid var(--line);opacity:.8}
.row-ic{font-size:22px;width:28px;text-align:center}
.row-main{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0}
.row-main b{font:800 17px var(--font-row,var(--font-ui))}
.row-main small{font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row-f{font-size:18px}
.row.on{padding-bottom:30px}
.row-btns{position:absolute;right:2px;bottom:8px;display:flex;gap:12px;color:var(--muted)}
.row-btns .ic{width:17px;height:17px}
/* day */
.day-bg{position:absolute;inset:0;background:var(--day-bg)}
.day-profile{position:absolute;top:50px;right:16px;z-index:20}
.dtitle{position:absolute;top:104px;left:0;right:0;text-align:center;font:900 46px/1 var(--font-title);color:var(--title-color);z-index:10;letter-spacing:.02em}
.ddate{position:absolute;top:160px;left:0;right:0;text-align:center;font:600 13px var(--font-label);color:var(--muted);letter-spacing:.14em;z-index:10}
.drawing{position:absolute;left:30px;top:226px;width:280px;height:380px;z-index:8}
.dlines{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.dlines line{stroke:var(--dline);stroke-width:var(--dline-w,3);stroke-dasharray:var(--dline-dash,none);stroke-linecap:round;opacity:var(--dline-o,.8)}
.ping{position:absolute;overflow:visible;filter:drop-shadow(var(--ping-drop,0 2px 2px rgba(0,0,0,.2)))}
.ping path{fill:var(--c);stroke:var(--ping-stroke,none);stroke-width:var(--ping-sw,0)}
.ping circle{fill:var(--ping-hole)}
.dtext{position:absolute;left:40px;top:618px;font:400 30px var(--font-hand);color:var(--text);z-index:12;transform:rotate(-3deg)}
.drail .share{margin-top:8px;background:var(--accent);color:var(--on-accent)}
.day-step{top:470px}
`;

function page(t) {
  const vars = { ...BASE_VARS, ...t.vars };
  const root = Object.entries(vars).map(([k, v]) => `--${k}:${v};`).join('');
  return `<!doctype html><html><head><meta charset="utf-8">
<style>/*FONTS*/:root{${root}--noise:${NOISE}}${BASE_CSS}${t.css ?? ''}</style></head>
<body class="t-${t.id}">
<svg width="0" height="0" style="position:absolute"><defs>
<filter id="wob" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="3.2"/></filter>
<filter id="wob2" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="9"/><feDisplacementMap in="SourceGraphic" scale="7"/></filter>
<filter id="soft"><feGaussianBlur stdDeviation="1.4"/></filter>
</defs></svg>
<div class="board">
  ${t.boardDeco ?? ''}
  <div class="head"><div>
    <div class="no">ROOT-IN THEME CONCEPT · ${String(t.no).padStart(2, '0')} / ${THEMES.length}</div>
    <h1>${t.name}<small>${t.en}</small></h1>
    <div class="desc">${t.desc}</div><div class="feel">${t.feel}</div></div>
    <div class="sws">${t.swatches.map(([n, c]) => `<div class="sw"><i style="background:${c}"></i>${n}<em>${c}</em></div>`).join('')}</div>
  </div>
  <div class="phones">
    <div><div class="phone">${screenMap(t)}</div><div class="cap">📍 핀 지도 · 핀 카드</div></div>
    <div><div class="phone">${screenRoute(t)}</div><div class="cap">🧭 경로 보기 · 폴더 창</div></div>
    <div><div class="phone">${screenDay(t)}</div><div class="cap">📅 달력 TODAY · 꾸미기</div></div>
  </div>
</div></body></html>`;
}

const only = process.argv.slice(2);
await mkdir(HTML_OUT, { recursive: true });
await mkdir(FONT_CACHE, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 1.5 });
const pg = await ctx.newPage();
for (const t of THEMES) {
  if (only.length && !only.includes(t.id)) continue;
  const file = join(HTML_OUT, `${t.id}.html`);
  let html = page(t);
  const text = [...new Set(html.replace(/<[^>]*>/g, ' ').replace(/[\s\u{1F000}-\u{1FFFF}\u2600-\u27BF\uFE0F]/gu, ''))].sort().join('') + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const families = ['Noto+Sans+KR:wght@400;500;600;700;800;900', 'Nanum+Pen+Script', ...(t.fonts ?? [])];
  html = html.replace('/*FONTS*/', localFontCss(families, text));
  await writeFile(file, html);
  await pg.goto(`file://${file}`, { waitUntil: 'networkidle' });
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(250);
  const name = `${String(t.no).padStart(2, '0')}-${t.id}`;
  await pg.screenshot({ path: join(OUT, `${name}.jpg`), fullPage: true, type: 'jpeg', quality: 88 });
  console.log('shot', name);
}
await browser.close();
