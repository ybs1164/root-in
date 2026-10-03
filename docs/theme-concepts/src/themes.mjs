// Theme candidates for root-in concept boards. Each entry: tokens (vars),
// extra CSS layered on the shared screens, and decoration snippets per screen.
import { D } from './helpers.mjs';
import { THEMES_B } from './themes-b.mjs';
import { THEMES_C } from './themes-c.mjs';
import { THEMES_D } from './themes-d.mjs';

export const THEMES = [
  // 1 ─────────────────────────────────────────────── 레트로
  {
    id: 'retro', name: '레트로', en: 'RETRO',
    desc: '70~90년대 인쇄물·전자제품 감성',
    feel: '베이지 배경, 두꺼운 테두리, 둥근 버튼, 살짝 바랜 색감. 오래된 잡지나 가전제품 조작부 같은 UI',
    swatches: [['오렌지', '#e2692a'], ['머스타드', '#e0a526'], ['브라운', '#6b4423']],
    fonts: ['Shrikhand', 'Do+Hyeon', 'Black+Han+Sans'],
    vars: {
      bg: '#f1e4c6', surface: '#fbf2dc', 'surface-2': '#f0dfb8', text: '#4a2f1a', muted: '#8a6a4a', line: '#4a2f1a',
      accent: '#e2692a', a2: '#e0a526', a3: '#6b4423', bw: '2.5px',
      shadow: '4px 4px 0 #4a2f1a', 'shadow-sm': '3px 3px 0 #4a2f1a', 'pin-shadow': '2px 2px 0 #4a2f1a',
      'font-ui': "'Do Hyeon', sans-serif", 'font-title': "'Shrikhand', 'Black Han Sans', cursive", 'font-label': "'Do Hyeon', sans-serif",
      'map-land': '#ead8b1', 'map-block': '#e8d3a6', 'map-road': '#f7ecd2', 'map-major': '#e6b35a', 'map-water': '#9fb9a8', 'map-park': '#b9c28a', 'map-label': '#7a5a3a',
      p1: '#e2692a', p2: '#e0a526', p3: '#6b8a3a', p4: '#a2462c', 'pin-bw': '2.5px', 'pin-border': '#4a2f1a',
      'stop-bg': '#e2692a', 'title-color': '#a2462c', 'tab-off': '#e8d2a2', step: '#a88a64', board: '#e9d9b6', 'board-ink': '#4a2f1a', dline: '#4a2f1a',
    },
    css: `
.map{filter:sepia(.25) saturate(.9)}
.map-overlay{background:radial-gradient(rgba(74,47,26,.16) 1px,transparent 1.4px) 0 0/6px 6px;mix-blend-mode:multiply}
.search{font-size:17px}
.card{border-radius:14px}
.card-ic{border:2px solid #4a2f1a}
.tab.big,.rb.on,.stop{background:linear-gradient(#ef7a35,#d85d1f)}
.tab.big::before{content:'';position:absolute;inset:6px;border-radius:50%;border:2px dashed rgba(255,255,255,.55)}
.tab.big{position:relative}
.rb.all.on2{background:#e0a526;color:#4a2f1a}
.dtitle{font-size:50px;-webkit-text-stroke:2px #4a2f1a;color:#e2692a;text-shadow:4px 4px 0 #e0a526,7px 7px 0 #4a2f1a;top:94px}
.ddate{top:174px;color:#6b4423}
.day-bg{background:radial-gradient(rgba(74,47,26,.1) 1px,transparent 1.4px) 0 0/7px 7px,#f1e4c6}
.dtext{font-family:'Do Hyeon';font-size:24px;color:#6b4423;background:#e0a526;padding:6px 14px;border:2.5px solid #4a2f1a;border-radius:999px;box-shadow:3px 3px 0 #4a2f1a;top:626px}
.rt-name{color:#a2462c;font-family:'Black Han Sans';font-size:40px;text-shadow:3px 3px 0 #e0a526}
.tray{border-radius:26px 26px 0 0}
.ftab{border-radius:12px 12px 0 0}
`,
    deco: {
      dayBack: [
        D(-60, 650, `<div style="width:500px;height:300px;border-radius:50% 50% 0 0;background:repeating-radial-gradient(circle at 50% 100%,#e2692a 0 18px,#e0a526 18px 36px,#6b4423 36px 54px,transparent 54px 72px);opacity:.25"></div>`),
      ],
      map: [D(18, 724, `<div style="font:16px 'Shrikhand';color:#a2462c;transform:rotate(-8deg)">'86 Edition</div>`)],
      day: [
        D(256, 548, `<div style="width:62px;height:62px;border-radius:50%;background:#6b4423;border:2.5px solid #4a2f1a;color:#f1e4c6;display:grid;place-items:center;font:13px 'Shrikhand';text-align:center;transform:rotate(12deg);box-shadow:3px 3px 0 #4a2f1a">No.<br>275</div>`),
      ],
    },
    boardDeco: `<div style="position:absolute;right:-80px;bottom:-80px;width:520px;height:520px;border-radius:50%;background:repeating-radial-gradient(circle,#e2692a 0 26px,#e0a526 26px 52px,#6b4423 52px 78px,transparent 78px 104px);opacity:.13"></div>`,
  },
];
THEMES.push(...THEMES_B, ...THEMES_C, ...THEMES_D);
THEMES.forEach((t, i) => { t.no = i + 1; });
