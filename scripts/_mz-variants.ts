// Scratch: draws the main map's 동 in several design directions on real shapes, to compare.
// npx vite-node scripts/_mz-variants.ts  ->  ui-shots/mz-variants.html
import { readFileSync, writeFileSync } from 'node:fs';
import { renderAreaMap, type AdminArea, type AreaShapes } from '../src/domain/adminAreas';
import { screenProjection } from '../src/domain/districtRendering';
import { parseAreas } from '../src/services/adminAreaService';
import type { MapViewport } from '../src/domain/districtMap';

const read = (p: string) => parseAreas(JSON.parse(readFileSync(`public/korea/admin/${p}`, 'utf8'))) as AdminArea[];
const W = 375, H = 640;
const view = (lon: number, lat: number, mpp: number): MapViewport => {
  const spanLon = mpp * W / (111320 * Math.cos(lat * Math.PI / 180));
  const spanLat = spanLon * H / W * Math.cos(lat * Math.PI / 180);
  return { bounds: { west: lon - spanLon / 2, east: lon + spanLon / 2, south: lat - spanLat / 2, north: lat + spanLat / 2 }, widthPx: W };
};
const parts = ['11200', '11215', '11680', '11170', '11650', '11140'].flatMap((g) => read(`dong/${g}.json`));
const views = [
  { name: '구 단위 (한강·성동·강남)', v: view(127.04, 37.535, 40) },
  { name: '동 단위 (성수)', v: view(127.05, 37.546, 12) },
];

type Drawn = { d: string[]; tones: number[]; outline: string; drop: string; centers: [number, number][] };
function draw(v: MapViewport): Drawn {
  const shapes: AreaShapes = renderAreaMap({ focus: { code: '', name: 'x' }, parts, others: [] }, v);
  const p = screenProjection(v);
  const top = p.project([v.bounds.west, v.bounds.north]).Y / 100;
  const path = (polys: NonNullable<AreaShapes['partsOutline']>) => polys.map((rings) => rings.map((ring) =>
    'M' + ring.map((q) => { const s = p.project(q); return `${(s.X / 100).toFixed(1)},${(top - s.Y / 100).toFixed(1)}`; }).join('L') + 'Z').join('')).join('');
  const centers = shapes.parts.map((poly) => {
    const pts = poly[0].map((q) => { const s = p.project(q); return [s.X / 100, top - s.Y / 100]; });
    return [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length] as [number, number];
  });
  return { d: shapes.parts.map((poly) => path([poly])), tones: shapes.partTones ?? [], outline: path(shapes.partsOutline ?? []), drop: path(shapes.partsDrop ?? []), centers };
}

type Variant = { id: string; title: string; why: string; svg: (g: Drawn, k: number) => string };
const svg = (bg: string, body: string, defs = '') =>
  `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`;
const fills = (g: Drawn, colour: (tone: number, i: number) => string, extra = '') =>
  g.d.map((d, i) => `<path d="${d}" fill="${colour(g.tones[i] ?? 0, i)}" fill-rule="evenodd" ${extra}/>`).join('');

const variants: Variant[] = [
  {
    id: 'A', title: 'A. 지금 — 파스텔 7:2:1',
    why: '라벤더 바탕에 핑크·노랑이 가운데 한 무리. 차분하지만 셋의 밝기가 비슷해 멀리서 한 덩어리로 보임.',
    svg: (g) => svg('#e4e9f2', `<path d="${g.drop}" fill="#7d6ea8" opacity=".35"/>` + fills(g, (t) => ['#e3d9ef', '#f7d3e1', '#f6e0b0'][t])),
  },
  {
    id: 'B', title: 'B. 캔디 컬러블록 (Y2K)',
    why: '하늘·핑크·라임을 쨍하게, 굵은 흰 틈으로 블록처럼. 채도 대비로 한눈에 "요즘" 느낌. 대신 핀·루트가 묻힐 수 있어 바탕을 하늘색으로 눌러 둠.',
    svg: (g) => svg('#f3f6fb', fills(g, (t) => ['#bfe0ff', '#ff9ccf', '#d9f56a'][t], 'stroke="#ffffff" stroke-width="3" stroke-linejoin="round"')),
  },
  {
    id: 'C', title: 'C. 리소 프린트',
    why: '형광 핑크·파랑 두 잉크만, 바탕 동은 망점, 파랑 판이 살짝 어긋나게. 굿즈·진(zine) 감성. 색 수가 적어 시선이 흩어지지 않음.',
    svg: (g, k) => svg('#fbf6ec',
      fills(g, (t) => [`url(#dots${k})`, '#ff7aa8', '#4f7cff'][t], t0Opacity()) +
      `<path d="${g.outline}" fill="none" stroke="#4f7cff" stroke-width="1.6" transform="translate(2.5 2)" opacity=".85"/>`,
      `<pattern id="dots${k}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#fde3ec"/><circle cx="3" cy="3" r="1.3" fill="#ff7aa8"/></pattern>`),
  },
  {
    id: 'D', title: 'D. 다꾸 와펜 (바느질)',
    why: '크림 종이 위 파스텔 동마다 안쪽에 흰 바느질 점선. 천 패치를 붙인 느낌이라 "아기자기"가 가장 직접적. 선이 많아 축소하면 복잡해짐.',
    svg: (g) => svg('#f8f1e3', `<path d="${g.drop}" fill="#b9a4d6" opacity=".45"/>` +
      fills(g, (t) => ['#dcd3f2', '#f9cfe0', '#fbe3a8'][t]) +
      g.d.map((d) => `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-dasharray="3 3" transform-origin="center" opacity=".95" style="paint-order:stroke" clip-path="none"/>`).join('')),
  },
  {
    id: 'E', title: 'E. 톤온톤 + 포인트 하나',
    why: '모든 동을 한 색(라벤더) 밝기 세 단계로, 가운데 몇 곳만 코랄 포인트. 7:2:1을 "명도"로 지킴. 가장 세련되고 핀이 잘 보임, 대신 귀여움은 덜함.',
    svg: (g) => svg('#eef0f7', `<path d="${g.drop}" fill="#6b5fa0" opacity=".25"/>` + fills(g, (t) => ['#e6e1f4', '#c9bfe8', '#ff8a7a'][t])),
  },
  {
    id: 'F', title: 'F. 오로라 그라데이션',
    why: '동마다 핑크→라벤더→민트 그라데이션, 방향만 바꿔 홀로그램 스티커처럼. 화사하지만 지도 정보(경계)는 약해짐.',
    svg: (g, k) => svg('#eef1f8', `<path d="${g.drop}" fill="#9c8cc8" opacity=".3"/>` + fills(g, (t) => `url(#au${k}-${t})`),
      [0, 1, 2].map((t) => `<linearGradient id="au${k}-${t}" gradientTransform="rotate(${[35, 120, 210][t]} .5 .5)"><stop offset="0" stop-color="#ffd1e6"/><stop offset=".5" stop-color="#dcd2ff"/><stop offset="1" stop-color="#c8f2e6"/></linearGradient>`).join('')),
  },
];
function t0Opacity() { return ''; }

const drawn = views.map((v) => draw(v.v));
let k = 0;
const cards = variants.map((variant) => `<section><h2>${variant.title}</h2><p>${variant.why}</p><div class="pair">${
  drawn.map((g, i) => `<figure><figcaption>${views[i].name}</figcaption>${variant.svg(g, k++)}</figure>`).join('')}</div></section>`).join('');
writeFileSync('ui-shots/mz-variants.html', `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>지도 디자인 방향</title>
<style>body{margin:0;padding:16px;background:#f4f1ea;color:#2a3354;font-family:system-ui,sans-serif}h1{font-size:20px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}section{background:#fff;border-radius:16px;padding:14px}
h2{font-size:17px;margin:0 0 4px}p{margin:0 0 10px;font-size:14px;color:#5b6280}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}figure{margin:0}figcaption{font-size:12px;color:#979bab;margin-bottom:4px}svg{width:100%;border-radius:10px;display:block}</style>
</head><body><h1>본 지도 디자인 방향 6가지 (실제 동 모양, 핀·이름 없음)</h1><main>${cards}</main></body></html>`);
// F, made premium: fewer, closer hues; one light across the whole sheet; fine grain; hairlines; soft shadow.
const grain = (k: number) =>
  `<filter id="grain${k}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0"/></filter>` +
  `<filter id="soft${k}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>`;
const clip = (g: Drawn, k: number) => `<clipPath id="sil${k}"><path d="${g.outline}"/></clipPath>`;
const softShadow = (g: Drawn, k: number, colour: string) =>
  `<path d="${g.outline}" fill="${colour}" opacity=".28" transform="translate(0 5)" filter="url(#soft${k})"/>`;
const finish = (k: number, sheen: string) =>
  `<g clip-path="url(#sil${k})"><rect width="${W}" height="${H}" fill="url(#sheen${k})" style="mix-blend-mode:soft-light"/>` +
  `<rect width="${W}" height="${H}" filter="url(#grain${k})" opacity=".09"/></g>` + sheen;
const sheenGrad = (k: number) =>
  `<linearGradient id="sheen${k}" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".46" stop-color="#fff" stop-opacity=".35"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
const goldGrad = (k: number) =>
  `<linearGradient id="gold${k}" gradientTransform="rotate(35 .5 .5)"><stop offset="0" stop-color="#f8ead0"/><stop offset="1" stop-color="#e9cf9e"/></linearGradient>`;
const hairlines = (g: Drawn, colour: string, width = 0.9) =>
  g.d.map((d) => `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linejoin="round"/>`).join('');

const aurora: Variant[] = [
  variants.find((v) => v.id === 'F')!,
  {
    id: 'F1', title: 'F1. 펄 호일 한 장',
    why: '동마다 따로 놀던 그라데이션을 화면 전체에 한 장으로(펄 핑크→라일락→아이스 블루, 채도 낮춤) — 한 장의 호일을 동 모양으로 오려 붙인 느낌. 사선 광택 한 줄, 고운 입자, 0.9px 흰 머리선, 흐린 그림자. 7:2:1은 라일락을 조금 진하게(20%)·샴페인 골드(10%)로.',
    svg: (g, k) => svg('#f7f4f1',
      softShadow(g, k, '#8c82b4') + fills(g, () => `url(#foil${k})`) +
      fills(g, (t) => ['transparent', '#a995e0', 'transparent'][t], 'opacity=".25"') +
      fills(g, (t) => (t === 2 ? `url(#gold${k})` : 'transparent')) +
      finish(k, hairlines(g, 'rgba(255,255,255,.75)')),
      grain(k) + clip(g, k) + sheenGrad(k) +
      `<linearGradient id="foil${k}" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f4dde7"/><stop offset=".45" stop-color="#e5dcf4"/><stop offset=".8" stop-color="#d9e6f5"/><stop offset="1" stop-color="#ece3f2"/></linearGradient>` + goldGrad(k)),
  },
  {
    id: 'F2', title: 'F2. 프로스트 글라스',
    why: '오로라는 동이 아니라 뒤 배경에 크게 흐린 빛 세 덩이로 깔고, 동은 그 위의 반투명 유리판(흰 머리선). 색은 배경이 내고 지도는 차분해서 핀이 잘 보임. 라일락 유리 20%, 샴페인 유리 10%.',
    svg: (g, k) => svg('#f3f1f6',
      `<g filter="url(#blur${k})"><circle cx="${W * 0.2}" cy="${H * 0.3}" r="150" fill="#f6cfe0"/><circle cx="${W * 0.85}" cy="${H * 0.45}" r="170" fill="#d9d0f6"/><circle cx="${W * 0.45}" cy="${H * 0.85}" r="160" fill="#cfe3f6"/></g>` +
      softShadow(g, k, '#7f77a8') +
      fills(g, (t) => ['rgba(255,255,255,.42)', 'rgba(190,172,240,.45)', `url(#gold${k})`][t]) +
      finish(k, hairlines(g, 'rgba(255,255,255,.95)', 1.1)),
      grain(k) + clip(g, k) + sheenGrad(k) + `<filter id="blur${k}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="55"/></filter>` + goldGrad(k)),
  },
  {
    id: 'F3', title: 'F3. 이리데선트 + 골드 포인트',
    why: '동마다 그라데이션은 살리되 방향을 모두 같게(35°) 하고 폭을 좁혀 정돈. 포인트 동만 샴페인 골드 그라데이션 + 금빛 머리선 — 보석처럼 한 곳에 시선. 바탕은 따뜻한 오프화이트.',
    svg: (g, k) => svg('#f8f5ef',
      softShadow(g, k, '#8a7fa6') + fills(g, (t) => `url(#ir${k}-${t})`) +
      finish(k, hairlines(g, 'rgba(255,255,255,.8)') +
        g.d.map((d, i) => (g.tones[i] === 2 ? `<path d="${d}" fill="none" stroke="#c9a46a" stroke-width="1.1"/>` : '')).join('')),
      grain(k) + clip(g, k) + sheenGrad(k) +
      [['#efe2f1', '#e2e3f6'], ['#e0d3f3', '#d6dcf5'], ['#f6e6c8', '#e8cfa0']].map(([a, b], t) =>
        `<linearGradient id="ir${k}-${t}" gradientTransform="rotate(35 .5 .5)"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`).join('')),
  },
];
const auroraCards = aurora.map((variant) => `<section><h2>${variant.title}</h2><p>${variant.why}</p><div class="pair">${
  drawn.map((g, i) => `<figure><figcaption>${views[i].name}</figcaption>${variant.svg(g, k++)}</figure>`).join('')}</div></section>`).join('');
writeFileSync('ui-shots/mz-aurora.html', `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>오로라 고급화</title>
<style>body{margin:0;padding:16px;background:#f4f1ea;color:#2a3354;font-family:system-ui,sans-serif}h1{font-size:20px}main{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}section{background:#fff;border-radius:16px;padding:14px}
h2{font-size:17px;margin:0 0 4px}p{margin:0 0 10px;font-size:14px;color:#5b6280}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}figure{margin:0}figcaption{font-size:12px;color:#979bab;margin-bottom:4px}svg{width:100%;border-radius:10px;display:block}</style>
</head><body><h1>F 오로라 — 고급스럽게 다듬기</h1><main>${auroraCards}</main></body></html>`);
// G: Zenly's direction — one lavender family for the map, aurora as light at the screen edges,
// the accent only on pins and the selected 동.
const ACCENT = '#ff6f91';
const selected = (g: Drawn) => {
  let best = 0, dist = Infinity;
  g.centers.forEach(([x, y], i) => { const d = Math.hypot(x - W / 2, y - H * 0.45); if (d < dist) { dist = d; best = i; } });
  return best;
};
// The same few pins on every concept, so it shows how well they read on each.
const pins = (g: Drawn) => {
  const at = [[0.5, 0.45], [0.36, 0.38], [0.62, 0.55], [0.44, 0.62], [0.7, 0.36]].map(([x, y]) => [x * W, y * H]);
  const route = `<path d="M${at.map(([x, y]) => `${x},${y}`).join('L')}" fill="none" stroke="${ACCENT}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 7"/>`;
  return route + at.map(([x, y], i) => i === 0
    ? `<circle cx="${x}" cy="${y}" r="15" fill="#fff" filter="url(#pinShadow)"/><circle cx="${x}" cy="${y}" r="12" fill="url(#face)"/><circle cx="${x}" cy="${y}" r="15" fill="none" stroke="${ACCENT}" stroke-width="2.5"/>`
    : `<circle cx="${x}" cy="${y}" r="8" fill="${ACCENT}" stroke="#fff" stroke-width="3" filter="url(#pinShadow)"/>`).join('');
};
const pinDefs = `<filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#3b2f63" flood-opacity=".25"/></filter>` +
  `<linearGradient id="face" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd9b8"/><stop offset="1" stop-color="#f3b48f"/></linearGradient>`;
const withPins = (v: Variant): Variant => ({ ...v, svg: (g, k) => v.svg(g, k).replace('</svg>', `<defs>${pinDefs}</defs>${pins(g)}</svg>`) });

const G: Variant = {
  id: 'G', title: 'G. 젠리 방향 — 라벤더 톤온톤 + 가장자리 오로라',
  why: '지도는 라벤더 한 색, 동은 밝기 두 단계(7:2)와 흰 머리선으로만 나눔. 오로라는 동 안이 아니라 화면 위·아래 가장자리 빛으로. 포인트 색(코랄 핑크)은 핀·루트·선택한 동(옅은 채움 + 테두리)에만 — 10%가 "의미 있는 곳"에만 쓰임.',
  svg: (g, k) => {
    const sel = selected(g);
    return svg('#ebe8f4',
      softShadow(g, k, '#6f63a3') +
      fills(g, (t, i) => (i === sel ? '#f3dce6' : t === 1 ? '#cfc6ea' : '#dfd9f1')) +
      hairlines(g, 'rgba(255,255,255,.9)', 1.1) +
      `<path d="${g.d[sel]}" fill="none" stroke="${ACCENT}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<g clip-path="url(#sil${k})"><rect width="${W}" height="${H}" filter="url(#grain${k})" opacity=".07"/></g>` +
      `<rect width="${W}" height="${H}" fill="url(#auroraTop${k})"/><rect width="${W}" height="${H}" fill="url(#auroraBottom${k})"/>`,
      grain(k) + clip(g, k) +
      `<radialGradient id="auroraBottom${k}" cx=".5" cy="1.08" r=".75"><stop offset="0" stop-color="#9fe3d6" stop-opacity=".75"/><stop offset=".45" stop-color="#b9a8f2" stop-opacity=".45"/><stop offset="1" stop-color="#b9a8f2" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="auroraTop${k}" cx=".95" cy="-.05" r=".6"><stop offset="0" stop-color="#ffc6dd" stop-opacity=".7"/><stop offset="1" stop-color="#ffc6dd" stop-opacity="0"/></radialGradient>`);
  },
};

const compare = [variants.find((v) => v.id === 'E')!, aurora.find((v) => v.id === 'F1')!, aurora.find((v) => v.id === 'F2')!, G].map(withPins);
const compareCards = compare.map((variant) => `<section${variant.id === 'G' ? ' class="new"' : ''}><h2>${variant.title}</h2><p>${variant.why}</p><div class="pair">${
  drawn.map((g, i) => `<figure><figcaption>${views[i].name}</figcaption>${variant.svg(g, k++)}</figure>`).join('')}</div></section>`).join('');
writeFileSync('ui-shots/mz-g.html', `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>G 비교</title>
<style>body{margin:0;padding:16px;background:#f4f1ea;color:#2a3354;font-family:system-ui,sans-serif}h1{font-size:20px}main{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}section{background:#fff;border-radius:16px;padding:14px}section.new{outline:2px solid ${ACCENT}}
h2{font-size:17px;margin:0 0 4px}p{margin:0 0 10px;font-size:14px;color:#5b6280}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}figure{margin:0}figcaption{font-size:12px;color:#979bab;margin-bottom:4px}svg{width:100%;border-radius:10px;display:block}</style>
</head><body><h1>G 젠리 방향 vs E · F1 · F2 (같은 핀·루트를 얹어 비교)</h1><main>${compareCards}</main></body></html>`);
console.log('ok', drawn.map((g) => g.d.length));
