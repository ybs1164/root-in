// Themes 10–18: 베이커리 · 캔디 · 초콜릿 · 말차 · 다이너 · 캠핑 · 여행 · 캘린더 · Kawaii
import { D, star, spark, heart, rot } from './helpers.mjs';

const OUTLINE = 'filter:drop-shadow(2px 0 #fff) drop-shadow(-2px 0 #fff) drop-shadow(0 2px #fff) drop-shadow(0 -2px #fff) drop-shadow(0 3px 4px rgba(0,0,0,.22))';
const gingham = (c, s = 14) => `repeating-linear-gradient(0deg,${c} 0 ${s}px,transparent ${s}px ${s * 2}px),repeating-linear-gradient(90deg,${c} 0 ${s}px,transparent ${s}px ${s * 2}px)`;
const checker = (a, b, s) => `repeating-conic-gradient(${a} 0 25%,${b} 0 50%) 0 0/${s}px ${s}px`;
const stamp = (text, c, size, r) => `<div style="width:${size}px;height:${size}px;border-radius:50%;border:3px solid ${c};box-shadow:inset 0 0 0 3px transparent,inset 0 0 0 5px ${c};color:${c};display:grid;place-items:center;text-align:center;font:700 11px/1.15 'Courier Prime';letter-spacing:.06em;${rot(r)}filter:url(#wob);opacity:.85">${text}</div>`;

export const THEMES_C = [
  // 10 ────────────────────────────────────────────── 베이커리
  {
    id: 'bakery', name: '베이커리', en: 'BAKERY',
    desc: '빵집과 포장지의 따뜻한 분위기',
    feel: '빵 모양 아이콘, 체크 패턴, 둥글고 통통한 버튼. 메뉴판이나 빵 포장지 같은 UI',
    swatches: [['크림', '#fff1d6'], ['오렌지', '#f08a3c'], ['브라운', '#8a5230']],
    fonts: ['Jua', 'Fredoka:wght@600;700'],
    cats: ['🥐', '🥖', '🍰', '🧁'], folders: ['🥐', '🍩', '🥯'], routeIcon: '🥐',
    vars: {
      bg: '#fff3df', surface: '#fffaf0', 'surface-2': '#ffe6c2', text: '#6b3f1f', muted: '#a87b52', line: '#8a5230',
      accent: '#f08a3c', a2: '#8a5230', bw: '2.5px', 'r-card': '24px',
      shadow: '0 5px 0 #d9a066,0 10px 18px rgba(138,82,48,.2)', 'shadow-sm': '0 4px 0 #d9a066', 'pin-shadow': '0 3px 0 #b97a45',
      'font-ui': "'Jua', sans-serif", 'font-title': "'Fredoka', 'Jua', sans-serif", 'font-label': "'Fredoka', sans-serif",
      'map-land': '#fdebd0', 'map-block': '#f9e0bb', 'map-road': '#fff7ea', 'map-major': '#f6c58f', 'map-water': '#bfe0e8', 'map-park': '#d8e8b8', 'map-label': '#a87b52',
      p1: '#e0a060', p2: '#c4733a', p3: '#f08a3c', p4: '#f3b6a0', 'pin-bw': '2.5px', 'pin-border': '#8a5230',
      'stop-bg': '#c4733a', route: '#8a5230', 'route-dash': '2 9', 'route-w': '5', 'title-color': '#8a5230', 'tab-off': '#fde3bd', step: '#d9a066',
      board: '#fbe7c7', 'board-ink': '#6b3f1f', dline: '#c4733a', 'dline-dash': '2 8', 'dline-w': '4',
    },
    css: `
.rb,.tab,.fab,.profile{box-shadow:inset 0 -4px 0 rgba(138,82,48,.15),0 4px 0 #d9a066}
.rb{width:46px;height:46px}
.rb.on,.tab.big{background:radial-gradient(circle at 40% 30%,#ffb36b,#f08a3c 55%,#d86f22);box-shadow:inset 0 -5px 0 rgba(0,0,0,.14),inset 0 3px 0 rgba(255,255,255,.35),0 4px 0 #a85a1d}
.rb.all.on2{background:#8a5230;color:#fff3df}
.search{background:#fffaf0;font-size:17px}
.card{background:#fffaf0;padding-top:20px}
.card{overflow:hidden;padding-top:26px}
.card::before{content:'';position:absolute;left:0;right:0;top:0;height:14px;background:${gingham('rgba(240,138,60,.55)', 7)},#fffaf0;border-bottom:2.5px solid #8a5230}
.card::after{display:none}
.card-ic{background:${gingham('rgba(240,138,60,.35)', 6)},#fffaf0;border:2px solid #8a5230}
.card-name{font-size:20px}
.pin{font-size:17px}
.stop{border-radius:46% 54% 48% 52%/60% 60% 40% 40%;width:34px;height:30px;font-family:'Fredoka'}
.rt-name{font:700 44px 'Fredoka','Jua';color:#8a5230;-webkit-text-stroke:0;text-shadow:0 3px 0 #ffd8a8}
.tray{background:${gingham('rgba(240,138,60,.22)', 12)},#fffaf0}
.row{background:#fffaf0;border:2px solid #8a5230;border-radius:18px;padding:10px 12px;margin-top:30px;box-shadow:0 3px 0 #d9a066}
.row.on{padding-bottom:30px}
.row + .row{margin-top:10px;border-top:2px solid #8a5230}
.tray-tools{top:8px}
.ftab{border-radius:16px 16px 0 0}
.day-bg{background:linear-gradient(transparent 0 560px,#fffaf0 560px),${gingham('rgba(240,138,60,.3)', 14)},#fff3df}
.day-bg::after{content:'';position:absolute;left:0;right:0;top:548px;height:24px;background:radial-gradient(circle at 12px 0,#fff3df 12px,transparent 12.5px) 0 0/24px 24px repeat-x}
.dtitle{font:700 58px 'Fredoka';color:#fffaf0;-webkit-text-stroke:3px #8a5230;paint-order:stroke fill;text-shadow:0 5px 0 #8a5230;top:92px}
.ddate{top:166px;color:#8a5230;font-family:'Fredoka';font-weight:700}
.drawing{transform:scale(.84);transform-origin:0 0;left:42px;top:222px}
.dtext{font:400 22px 'Jua';color:#8a5230;top:600px;left:44px;transform:none}
`,
    dayText: '갓 구운 오늘의 루트 🥐',
    deco: {
      day: [
        D(28, 196, `<div style="font:700 12px 'Fredoka';color:#fff;background:#8a5230;border-radius:999px;padding:4px 10px;${rot(-6)}">FRESH · 08:00</div>`),
        D(250, 630, `<div style="font-size:44px;${rot(14)}">🥖</div>`), D(200, 650, '<div style="font-size:34px">🥐</div>'),
        D(30, 646, `<div style="width:78px;height:48px;border-radius:50%;border:2.5px dashed #c4733a;display:grid;place-items:center;font:700 11px 'Fredoka';color:#c4733a;${rot(-8)}">since<br>2026</div>`),
      ],
      map: [D(22, 694, `<div style="font:700 13px 'Fredoka';color:#fff;background:#f08a3c;border:2.5px solid #8a5230;border-radius:999px;padding:4px 12px;box-shadow:0 3px 0 #8a5230;${rot(-6)}">Fresh baked!</div>`)],
    },
    boardDeco: `<div style="position:absolute;inset:auto 0 0 0;height:120px;background:${gingham('rgba(240,138,60,.25)', 20)}"></div>`,
  },

  // 11 ────────────────────────────────────────────── 캔디
  {
    id: 'candy', name: '캔디', en: 'CANDY',
    desc: '사탕처럼 알록달록하고 달콤한 디자인',
    feel: '젤리처럼 볼록한 버튼, 강한 라운딩, 반짝임. UI 요소마다 서로 다른 파스텔 컬러 사용',
    swatches: [['핑크', '#ff8fc1'], ['민트', '#7fe0c5'], ['라벤더', '#b9a4ff']],
    fonts: ['Jua', 'Chewy'],
    cats: ['🍭', '🍬', '🍦', '🧃'], folders: ['🍭', '🍬', '🫧'], routeIcon: '🍭',
    vars: {
      bg: '#fff4fa', surface: '#ffffff', 'surface-2': '#ffe3f1', text: '#6a3d6e', muted: '#b08bb5', line: 'rgba(255,143,193,.5)',
      accent: '#ff7fb8', a2: '#6fe0c2', a3: '#b49cff', 'r-card': '28px',
      shadow: '0 10px 24px rgba(255,127,184,.3)', 'shadow-sm': '0 6px 14px rgba(180,120,200,.25)',
      'font-ui': "'Jua', sans-serif", 'font-title': "'Chewy', 'Jua', cursive", 'font-label': "'Chewy', cursive",
      'map-land': '#fdeef6', 'map-block': '#fae3f0', 'map-road': '#ffffff', 'map-major': '#d3f5ea', 'map-major-w': '11', 'map-water': '#d6e8ff', 'map-park': '#dff7e6', 'map-label': '#c39ac8',
      p1: '#ff8fc1', p2: '#7fe0c5', p3: '#b9a4ff', p4: '#ffd36e', 'pin-bw': '3px', 'pin-border': '#fff', 'pin-shadow': '0 4px 10px rgba(255,127,184,.45)',
      route: '#ff8fc1', 'route-w': '7', 'title-color': '#ff6fae', 'tab-off': '#ffe7f3', step: '#ffb6d6',
      'day-bg': 'linear-gradient(180deg,#fff0f8,#f2eaff 60%,#e6fbf4)', dline: '#ffb6d6', 'dline-w': '6',
      board: '#ffeef7', 'board-ink': '#6a3d6e',
    },
    css: `
.rb,.tab,.fab,.profile{--jc:#fff;background:radial-gradient(ellipse 60% 40% at 38% 22%,rgba(255,255,255,.95) 0 30%,transparent 62%),var(--jc);box-shadow:inset 0 -6px 10px rgba(0,0,0,.08),inset 0 2px 0 rgba(255,255,255,.8),0 6px 14px color-mix(in srgb,var(--jc) 60%,transparent)}
.rail .rb:nth-child(3){--jc:#c9f3e6}.rail .rb:nth-child(4){--jc:#e3d9ff}.rail .rb:nth-child(5){--jc:#fff0b8}.rail .rb:nth-child(6){--jc:#ffd6e8}.rail .rb:nth-child(7){--jc:#d4ebff}
.drail .rb:nth-child(1){--jc:#ffd6e8}.drail .rb:nth-child(2){--jc:#c9f3e6}.drail .rb:nth-child(3){--jc:#e3d9ff}.drail .rb:nth-child(4){--jc:#fff0b8}.drail .rb:nth-child(5){--jc:#d4ebff}
.rb.on,.tab.big,.drail .share{--jc:#ff7fb8;color:#fff}
.rb.all.on2{--jc:#6fe0c2;background:radial-gradient(ellipse 60% 40% at 38% 22%,rgba(255,255,255,.95) 0 30%,transparent 62%),#6fe0c2;color:#fff}
.profile{--jc:#e3d9ff;color:#8a6ac0}
.fab{--jc:#c9f3e6}
.tab:not(.big){--jc:#fff0b8}
.search{border:3px solid #ffd0e6;font-size:17px}
.card{border:4px solid transparent;background:linear-gradient(#fff,#fff) padding-box,repeating-linear-gradient(45deg,#ff8fc1 0 9px,#fff 9px 18px,#7fe0c5 18px 27px,#fff 27px 36px) border-box}
.card::after{background:#fff;border:0;bottom:-11px}
.card-ic{background:radial-gradient(ellipse 60% 40% at 38% 22%,#fff 0 30%,transparent 62%),#ffd6e8}
.stop{border:3px solid #fff;background:radial-gradient(ellipse 60% 40% at 38% 22%,rgba(255,255,255,.9) 0 30%,transparent 62%),#ff7fb8;font-family:'Chewy';font-size:16px;width:34px;height:34px;margin:-17px 0 0 -17px}
.stop:nth-of-type(2n){background:radial-gradient(ellipse 60% 40% at 38% 22%,rgba(255,255,255,.9) 0 30%,transparent 62%),#b49cff}
.rlines line{stroke:url(#g)}
.rt-name{font:400 46px 'Chewy','Jua';color:#ff6fae;-webkit-text-stroke:0;text-shadow:3px 3px 0 #ffd6e8,0 0 18px rgba(255,255,255,.9)}
.tray{border-radius:32px 32px 0 0}
.ftab{border-radius:18px 18px 0 0}
.ftab:nth-child(1){background:#ffe7f3}.ftab:nth-child(2){background:#e3faf3}.ftab:nth-child(4){background:#efe9ff}.ftab:nth-child(5){background:#fff6d6}
.ftab.on{background:#fff}
.row.on{background:linear-gradient(90deg,#ffe7f3,#f1eaff);border-radius:20px;padding-left:12px}
.dtitle{font:400 64px 'Chewy';top:90px}
.dtitle span:nth-child(1){color:#ff7fb8}.dtitle span:nth-child(2){color:#6fd8bb}.dtitle span:nth-child(3){color:#b49cff}.dtitle span:nth-child(4){color:#ffb84d}.dtitle span:nth-child(5){color:#6fb8ff}
.dtitle span{display:inline-block;text-shadow:0 4px 0 rgba(255,255,255,.9),0 6px 12px rgba(200,120,180,.3)}
.dtitle span:nth-child(2n){transform:translateY(5px) rotate(4deg)}.dtitle span:nth-child(2n+1){transform:rotate(-4deg)}
.ddate{top:168px;color:#c39ac8;font:400 16px 'Chewy';letter-spacing:.14em}
.ping{filter:drop-shadow(0 3px 6px rgba(255,127,184,.45))}
.ping path{stroke:#fff;stroke-width:1.5}
.dtext{font:400 22px 'Jua';color:#fff;background:linear-gradient(90deg,#ff8fc1,#b49cff);padding:8px 16px;border-radius:999px;top:620px;left:36px;transform:rotate(-3deg);box-shadow:0 6px 14px rgba(180,120,200,.35)}
`,
    dayTitle: '<span>T</span><span>O</span><span>D</span><span>A</span><span>Y</span>',
    dayText: '오늘 하루 달콤했어 🍬',
    deco: {
      mapBack: [D(0, 0, '<svg width="0" height="0"><defs><linearGradient id="g"><stop offset="0" stop-color="#ff8fc1"/><stop offset="1" stop-color="#b49cff"/></linearGradient></defs></svg>')],
      map: [D(26, 690, spark('#ffd36e', 26)), D(60, 720, spark('#ff8fc1', 14))],
      route: [D(46, 230, spark('#b49cff', 22)), D(300, 300, spark('#7fe0c5', 18))],
      dayBack: [
        D(-30, 560, '<div style="width:130px;height:130px;border-radius:50%;background:repeating-conic-gradient(#ff8fc1 0 20deg,#fff 20deg 40deg);opacity:.35"></div>'),
        D(270, 210, '<div style="width:70px;height:70px;border-radius:50%;background:repeating-conic-gradient(#7fe0c5 0 20deg,#fff 20deg 40deg);opacity:.45"></div>'),
      ],
      day: [D(30, 104, spark('#ffd36e', 24)), D(266, 176, spark('#ff8fc1', 16)), D(40, 560, spark('#b49cff', 20)), D(250, 600, '<div style="font-size:40px;transform:rotate(18deg)">🍭</div>')],
    },
  },

  // 12 ────────────────────────────────────────────── 초콜릿
  {
    id: 'chocolate', name: '초콜릿', en: 'CHOCOLATE',
    desc: '달콤하지만 조금 더 차분하고 고급스러운 테마',
    feel: '초콜릿 조각 같은 사각 카드, 진한 브라운 배경. 패키지 디자인 같은 깔끔한 UI',
    swatches: [['다크브라운', '#3a2219'], ['크림', '#f3e6cf'], ['골드', '#c9a24a']],
    fonts: ['DM+Serif+Display:ital@0;1', 'Nanum+Myeongjo:wght@700;800', 'Playfair+Display:wght@600;700'],
    cats: ['☕', '🍫', '🌳', '🎁'], folders: ['🍫', '🍷', '🎁'], routeIcon: '🍫',
    vars: {
      bg: '#3a2219', surface: '#4a2c20', 'surface-2': '#5a3628', text: '#f3e6cf', muted: '#c7a98a', line: 'rgba(201,162,74,.55)',
      accent: '#c9a24a', 'on-accent': '#2b170f', bw: '1px', 'r-card': '6px', 'r-pill': '8px', 'r-btn': '10px',
      shadow: '0 10px 24px rgba(0,0,0,.45)', 'shadow-sm': '0 4px 10px rgba(0,0,0,.35)',
      'font-ui': "'Nanum Myeongjo', serif", 'font-title': "'DM Serif Display', 'Nanum Myeongjo', serif", 'font-label': "'Playfair Display', serif",
      'map-land': '#2e1b14', 'map-block': '#3a241a', 'map-road': '#4f3226', 'map-major': '#6b4530', 'map-water': '#1f2a2e', 'map-park': '#2f3322', 'map-label': '#a88a6a',
      p1: '#c9a24a', p2: '#f3e6cf', p3: '#9c6b4a', p4: '#e0b9a0', 'pin-r': '8px', 'pin-bw': '1.5px', 'pin-border': '#2b170f',
      route: '#c9a24a', 'route-w': '2.5', 'title-color': '#e9cf7a', 'tray-bg': '#f3e6cf', 'tab-off': '#4a2c20', step: '#8a6a52',
      'status-ink': '#f3e6cf', dline: '#c9a24a', 'dline-w': '2', 'ping-hole': '#3a2219', board: '#2b1a13', 'board-ink': '#f3e6cf',
    },
    card: ({ ic }) => `<div class="foil">No.01 · CAFÉ · SEONGSU</div><div class="card-row"><span class="card-ic">☕</span><b class="card-name">어니언 성수</b>${ic('pen', 'card-pen')}</div><div class="card-row card-row2">${ic('more')}<span class="pc">72% · 성동구 아차산로9길 8</span>${ic('trash')}</div>`,
    css: `
.map-overlay{background:radial-gradient(ellipse at 50% 40%,transparent 40%,rgba(0,0,0,.35))}
.rb,.tab,.fab,.profile{background:#5a3628;border:0;box-shadow:inset 2px 2px 0 rgba(255,255,255,.1),inset -3px -3px 0 rgba(0,0,0,.35),0 4px 8px rgba(0,0,0,.4);color:#f3e6cf}
.profile{border-radius:10px}
.rb.on,.tab.big,.drail .share{background:linear-gradient(135deg,#f6e3a1,#c9a24a 42%,#a37f2e 58%,#ecd284);color:#2b170f;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4),0 4px 12px rgba(0,0,0,.45)}
.rb.all.on2{background:#f3e6cf;color:#3a2219;font-family:'Playfair Display'}
.search{background:#4a2c20;border:1px solid rgba(201,162,74,.6);box-shadow:inset 0 0 0 3px #4a2c20,inset 0 0 0 4px rgba(201,162,74,.3)}
.card{background:#f3e6cf;color:#3a2219;border:0;padding:0 0 10px;overflow:visible}
.card::after{background:#f3e6cf;border:0}
.foil{background:linear-gradient(135deg,#f6e3a1,#c9a24a 40%,#a37f2e 60%,#ecd284);font:700 10.5px 'Playfair Display';letter-spacing:.2em;color:#3a2219;padding:7px 14px;border-radius:6px 6px 0 0;margin-bottom:10px}
.card-row{padding:0 14px}
.card-ic{background:#5a3628;border-radius:6px;box-shadow:inset 2px 2px 0 rgba(255,255,255,.12),inset -2px -2px 0 rgba(0,0,0,.3)}
.card-name{font-weight:800;color:#3a2219}
.card-row2{color:#8a6a52}
.pc{font:600 11.5px 'Playfair Display';letter-spacing:.04em}
.pin{box-shadow:inset 1px 1px 0 rgba(255,255,255,.3),inset -2px -2px 0 rgba(0,0,0,.25),0 3px 6px rgba(0,0,0,.4)}
.stop{border-radius:8px;background:linear-gradient(135deg,#f6e3a1,#c9a24a 45%,#a37f2e 60%,#ecd284);color:#2b170f;font-family:'Playfair Display'}
.rt-name{font:400 44px 'DM Serif Display','Nanum Myeongjo';color:#e9cf7a}
.rt-icon{width:48px;height:48px;line-height:48px;border-radius:50%;border:1px solid #c9a24a;font-size:24px;margin:0 auto 10px}
.tray{color:#3a2219;border-top:3px solid #c9a24a;border-radius:6px 6px 0 0}
.tray::before{content:'';position:absolute;inset:8px 8px 0;border:1px solid rgba(201,162,74,.6);border-bottom:0;pointer-events:none}
.ftabs{left:14px}
.ftab{border-radius:6px 6px 0 0;background:#5a3628;border:0;box-shadow:inset 2px 2px 0 rgba(255,255,255,.1),inset -2px 0 0 rgba(0,0,0,.3);color:#f3e6cf}
.ftab.on{background:#f3e6cf;color:#3a2219}
.row-main b{color:#3a2219;font-weight:800}
.row-main small,.tray-tools,.row-btns{color:#8a6a52}
.row + .row{border-top:1px solid rgba(201,162,74,.5)}
.day-bg{background:repeating-linear-gradient(90deg,transparent 0 92px,rgba(0,0,0,.18) 92px 94px,rgba(255,255,255,.04) 94px 96px),repeating-linear-gradient(0deg,transparent 0 92px,rgba(0,0,0,.18) 92px 94px,rgba(255,255,255,.04) 94px 96px),#3a2219}
.dtitle{font:italic 400 54px 'DM Serif Display';top:104px;color:#e9cf7a}
.ddate{top:166px;font:600 12px 'Playfair Display';letter-spacing:.32em;color:#c7a98a}
.drawing{transform:scale(.78);transform-origin:0 0;left:50px;top:244px}
.ping path{stroke:#2b170f;stroke-width:.8}
.dtext{font:800 16px 'Nanum Myeongjo';color:#3a2219;top:590px;left:56px;transform:none}
`,
    dayText: '오늘의 컬렉션 · 성수 4곳',
    deco: {
      dayBack: [
        D(28, 208, '<div style="width:274px;height:420px;background:#2b170f;border:1px solid #c9a24a;box-shadow:inset 0 0 0 6px #2b170f,inset 0 0 0 7px rgba(201,162,74,.45),0 18px 40px rgba(0,0,0,.5)"></div>'),
        D(28, 572, '<div style="width:274px;height:56px;background:#f3e6cf;border-top:3px solid #c9a24a"></div>'),
        D(108, 196, `<div style="background:linear-gradient(135deg,#f6e3a1,#c9a24a 40%,#a37f2e 60%,#ecd284);font:700 10px 'Playfair Display';letter-spacing:.24em;color:#2b170f;padding:5px 14px">— COLLECTION —</div>`),
      ],
      map: [D(18, 700, `<div style="width:62px;height:62px;border-radius:50%;background:linear-gradient(135deg,#f6e3a1,#c9a24a 40%,#a37f2e 60%,#ecd284);display:grid;place-items:center;text-align:center;font:700 9px/1.2 'Playfair Display';letter-spacing:.1em;color:#2b170f;box-shadow:0 4px 10px rgba(0,0,0,.4)">ROOT·IN<br>EST.<br>2026</div>`)],
    },
  },

  // 13 ────────────────────────────────────────────── 말차
  {
    id: 'matcha', name: '말차', en: 'MATCHA',
    desc: '차분한 일본식 녹색 디저트 감성',
    feel: '넓은 여백과 낮은 채도. 녹차 패키지·일본 카페 메뉴판처럼 차분하고 정갈한 UI',
    swatches: [['말차그린', '#8aa86a'], ['크림', '#f4f1e6'], ['다크그린', '#2f4a32']],
    fonts: ['Gowun+Batang:wght@400;700', 'Cormorant+Garamond:wght@500;600'],
    cats: ['🍵', '🍡', '🌿', '🏮'], folders: ['🍵', '🌿', '🍡'], routeIcon: '🍵',
    vars: {
      bg: '#f4f1e6', surface: '#fbf9f2', 'surface-2': '#e8ead9', text: '#2f4a32', muted: '#8a9580', line: 'rgba(47,74,50,.2)',
      accent: '#8aa86a', a2: '#2f4a32', bw: '1px', 'r-card': '4px', 'r-pill': '4px',
      shadow: '0 8px 24px rgba(47,74,50,.08)', 'shadow-sm': '0 1px 4px rgba(47,74,50,.06)', 'pin-shadow': 'none',
      'font-ui': "'Gowun Batang', serif", 'font-title': "'Gowun Batang', serif", 'font-label': "'Cormorant Garamond', serif",
      'map-land': '#efeee3', 'map-block': '#e8e9db', 'map-road': '#f8f7f0', 'map-major': '#dfe3cb', 'map-water': '#d8e2dc', 'map-park': '#d7e2c4', 'map-label': '#8a9580',
      p1: '#8aa86a', p2: '#2f4a32', p3: '#b8c49a', p4: '#a35c46', 'pin-bw': '2px', 'pin-border': '#fbf9f2',
      route: '#2f4a32', 'route-w': '1.6', 'stop-bg': '#fbf9f2', 'stop-fg': '#2f4a32', 'title-color': '#2f4a32', 'tab-off': '#ecece0', step: '#b9bfae',
      dline: '#2f4a32', 'dline-w': '1.2', 'dline-o': '.7', board: '#ebe8db', 'board-ink': '#2f4a32',
    },
    css: `
.map{filter:saturate(.6)}
.rb,.tab,.fab,.profile{border:1px solid rgba(47,74,50,.3)}
.rb.on,.tab.big{background:#8aa86a;border-color:#8aa86a}
.rb.all.on2{background:#2f4a32;color:#f4f1e6;font:500 12px 'Cormorant Garamond';letter-spacing:.2em}
.rb .ic,.tab .ic,.fab .ic,.search .ic{stroke-width:1.4}
.search{font-size:15px;letter-spacing:.06em}
.card{padding:16px 18px 12px;border-top:3px solid #8aa86a}
.card::after{border-color:rgba(47,74,50,.2)}
.card-ic{border-radius:50%;border:1px solid rgba(47,74,50,.25);background:none}
.card-name{font-weight:700;letter-spacing:.06em}
.card-sub{letter-spacing:.04em}
.stop{border:1.5px solid #2f4a32;font:600 14px 'Cormorant Garamond';box-shadow:none}
.rtitle{top:226px}
.rt-name{font:400 30px 'Gowun Batang';letter-spacing:.32em}
.rt-icon{font-size:22px;margin-bottom:14px}
.tray{box-shadow:none;border-top:1px solid rgba(47,74,50,.2);padding:18px 24px 0}
.ftab{border-radius:0;border:1px solid rgba(47,74,50,.18);border-bottom:0;width:48px}
.ftab.on{border-top:2px solid #8aa86a}
.row{padding:12px 0}
.row-main b{font-weight:700;letter-spacing:.06em}
.day-bg::after{content:'';position:absolute;left:54px;top:250px;width:1px;height:330px;background:rgba(47,74,50,.18)}
.dtitle{font:400 22px 'Cormorant Garamond';letter-spacing:.7em;top:122px;padding-left:.7em;color:#2f4a32}
.ddate{top:156px;font:500 12px 'Cormorant Garamond';letter-spacing:.4em;color:#8a9580}
.drawing{transform:scale(.7);transform-origin:0 0;left:74px;top:278px}
.ping{filter:none}
.ping path{stroke:#fbf9f2;stroke-width:1}
.dtext{font:400 14px 'Gowun Batang';letter-spacing:.26em;color:#2f4a32;top:610px;left:0;right:0;text-align:center;transform:none}
`,
    dayText: '성수 · 네 곳의 쉼',
    deco: {
      dayBack: [
        D(58, 236, '<svg width="236" height="236" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="#8aa86a" stroke-width="7" stroke-linecap="round" stroke-dasharray="230 50" transform="rotate(-70 50 50)" opacity=".22" style="filter:url(#wob2)"/></svg>'),
        D(300, 236, `<div style="writing-mode:vertical-rl;font:400 13px 'Gowun Batang';letter-spacing:.6em;color:#8a9580">오늘의 다회</div>`, 'left:30px;top:250px'),
      ],
      day: [D(60, 650, `<div style="width:36px;height:36px;background:#a35c46;color:#fbf9f2;display:grid;place-items:center;font:700 12px/1 'Gowun Batang';border-radius:4px;${rot(-4)}">根<br></div>`, 'left:170px;top:648px')],
      map: [D(22, 704, `<div style="width:30px;height:30px;background:#a35c46;color:#fbf9f2;display:grid;place-items:center;font:700 14px 'Gowun Batang';border-radius:3px">根</div>`)],
      route: [D(26, 470, `<div style="writing-mode:vertical-rl;font:400 12px 'Gowun Batang';letter-spacing:.5em;color:#8a9580">二〇二六 · 秋</div>`)],
    },
  },

  // 14 ────────────────────────────────────────────── 다이너 / 패스트푸드
  {
    id: 'diner', name: '다이너 / 패스트푸드', en: 'AMERICAN DINER',
    desc: '미국식 레트로 식당과 패스트푸드점',
    feel: '체크무늬, 메뉴판, 주문번호표, 스티커형 버튼. 크고 명확한 버튼이 많은 활기찬 UI',
    swatches: [['레드', '#e23b3b'], ['옐로우', '#ffc93c'], ['민트', '#7fd8c6']],
    fonts: ['Righteous', 'Lobster', 'Black+Han+Sans', 'Do+Hyeon'],
    cats: ['🍔', '🍟', '🥤', '🍦'], folders: ['🍔', '🌭', '🍕'], routeIcon: '🍔',
    vars: {
      bg: '#fffaf0', surface: '#ffffff', 'surface-2': '#fff1c7', text: '#2a1a1a', muted: '#8a6f6f', line: '#2a1a1a',
      accent: '#e23b3b', a2: '#ffc93c', a3: '#7fd8c6', bw: '2.5px', 'r-card': '14px',
      shadow: '0 4px 0 #2a1a1a', 'shadow-sm': '0 3px 0 #2a1a1a', 'pin-shadow': '0 2px 0 #2a1a1a',
      'font-ui': "'Do Hyeon', sans-serif", 'font-title': "'Lobster', 'Black Han Sans', cursive", 'font-label': "'Righteous', sans-serif",
      'map-land': '#fff3dc', 'map-block': '#ffe9c2', 'map-road': '#fffaf0', 'map-major': '#ffd36e', 'map-water': '#a8e6da', 'map-park': '#c7ecc0', 'map-label': '#b0705a',
      p1: '#e23b3b', p2: '#ffc93c', p3: '#7fd8c6', p4: '#2a1a1a', 'pin-bw': '2.5px', 'pin-border': '#2a1a1a',
      'stop-bg': '#ffc93c', 'stop-fg': '#2a1a1a', route: '#e23b3b', 'route-w': '5', 'title-color': '#e23b3b', 'tab-off': '#fff1c7', step: '#e9a0a0',
      'day-bg': '#bfeee4', dline: '#2a1a1a', 'dline-w': '3', board: '#fde7e0', 'board-ink': '#2a1a1a',
    },
    card: ({ ic }) => `<div class="ord"><span>ORDER</span><b>#023</b></div><div class="card-row"><span class="card-ic">🍔</span><b class="card-name">어니언 성수</b>${ic('pen', 'card-pen')}</div><div class="card-row card-row2">${ic('more')}<span class="tag">TAKE OUT ✓</span>${ic('trash')}</div>`,
    css: `
.rb,.tab,.fab,.profile{box-shadow:0 0 0 3px #fff,0 5px 0 3px #2a1a1a}
.rail .rb:nth-child(2n+3){background:#fff1c7}
.rb.on,.tab.big{background:#e23b3b;color:#fff}
.rb.all.on2{background:#7fd8c6;color:#2a1a1a;font-family:'Righteous'}
.search{background:#ffc93c;color:#2a1a1a;font-size:17px;box-shadow:0 0 0 3px #fff,0 5px 0 3px #2a1a1a}
.search span::before{content:'🔍 ';display:none}
.card{background:#fff;padding:0 12px 10px;overflow:hidden}
.card::after{display:none}
.card{-webkit-mask:linear-gradient(#000,#000) top/100% calc(100% - 8px) no-repeat,conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/14px 8px repeat-x;mask:linear-gradient(#000,#000) top/100% calc(100% - 8px) no-repeat,conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/14px 8px repeat-x;padding-bottom:18px;border-bottom:0}
.ord{display:flex;justify-content:space-between;align-items:center;background:${checker('#e23b3b', '#fff', 14)};margin:0 -12px 10px;padding:6px 12px;border-bottom:2.5px solid #2a1a1a}
.ord span,.ord b{background:#fff;font:400 15px 'Righteous';padding:2px 8px;border:2px solid #2a1a1a;border-radius:6px}
.ord b{background:#ffc93c}
.card-name{font:400 21px 'Black Han Sans'}
.tag{font:400 11px 'Righteous';background:#7fd8c6;border:2px solid #2a1a1a;border-radius:999px;padding:2px 8px;color:#2a1a1a}
.stop{font-family:'Righteous';box-shadow:0 0 0 2px #fff,0 3px 0 2px #2a1a1a}
.rt-name{font:400 48px 'Lobster','Black Han Sans';color:#e23b3b;-webkit-text-stroke:2px #2a1a1a;paint-order:stroke fill;text-shadow:0 4px 0 #ffc93c}
.tray{border-top:0;padding-top:30px}
.tray::before{content:'';position:absolute;left:0;right:0;top:0;height:16px;background:${checker('#2a1a1a', '#fff', 16)};border-radius:22px 22px 0 0}
.ftab{border-radius:10px 10px 0 0}
.ftab.on{background:#e23b3b;color:#fff}
.tray-tools{top:24px}
.row-main b{font:400 19px 'Black Han Sans'}
.row-f{background:#ffc93c;border:2px solid #2a1a1a;border-radius:999px;padding:2px 6px;font-size:14px}
.day-bg::after{content:'';position:absolute;left:0;right:0;bottom:0;height:170px;background:${checker('#2a1a1a', '#fff', 28)};transform-origin:bottom;opacity:.9}
.dtitle{font:400 58px 'Lobster';color:#e23b3b;-webkit-text-stroke:3px #fff;paint-order:stroke fill;filter:drop-shadow(0 5px 0 #2a1a1a);top:92px}
.ddate{top:170px;font:400 14px 'Righteous';color:#2a1a1a;letter-spacing:.2em}
.drawing{transform:scale(.8);transform-origin:0 0;left:44px;top:232px}
.dtext{font:400 20px 'Black Han Sans';color:#2a1a1a;background:#ffc93c;border:2.5px solid #2a1a1a;border-radius:12px;padding:6px 14px;top:574px;left:40px;transform:rotate(-4deg);box-shadow:0 0 0 3px #fff,0 5px 0 3px #2a1a1a}
.drail .share{box-shadow:0 0 0 3px #fff,0 5px 0 3px #2a1a1a}
`,
    dayText: '오늘의 세트 · 성수 4곳 🍟',
    deco: {
      map: [D(18, 694, `<div style="font:400 15px 'Righteous';color:#fff;background:#e23b3b;border:2.5px solid #2a1a1a;border-radius:10px;padding:4px 10px;box-shadow:0 0 0 3px #fff,0 4px 0 3px #2a1a1a;${rot(-6)}">OPEN 24H</div>`)],
      dayBack: [D(26, 218, '<div style="width:278px;height:340px;border-radius:20px;background:#fffaf0;border:2.5px solid #2a1a1a;box-shadow:0 0 0 4px #fff,0 6px 0 4px #2a1a1a"></div>')],
      day: [D(250, 548, `<div style="font-size:44px;${OUTLINE};${rot(12)}">🍔</div>`), D(30, 654, `<div style="font-size:38px;${OUTLINE};${rot(-10)}">🥤</div>`), D(212, 650, `<div style="font:400 16px 'Righteous';color:#2a1a1a;background:#fff;border:2.5px solid #2a1a1a;border-radius:50%;width:70px;height:70px;display:grid;place-items:center;${rot(10)}">No.<br>023</div>`)],
      route: [D(30, 220, `<div style="font-size:30px;${OUTLINE};${rot(-12)}">🍟</div>`)],
    },
    boardDeco: `<div style="position:absolute;left:0;right:0;bottom:0;height:90px;background:${checker('#2a1a1a', '#fff', 30)};opacity:.12"></div>`,
  },

  // 15 ────────────────────────────────────────────── 캠핑
  {
    id: 'camping', name: '캠핑', en: 'CAMPING',
    desc: '자연·야외·캠핑 장비 감성',
    feel: '지도, 배지, 나무 표지판, 랜턴 아이콘. 카드가 캠핑 장비 태그처럼 보이는 UI',
    swatches: [['카키', '#6b7044'], ['오렌지', '#e8772e'], ['베이지', '#ede3cc']],
    fonts: ['Alfa+Slab+One', 'Do+Hyeon', 'Gaegu:wght@700'],
    cats: ['⛺', '🔥', '🌲', '🎣'], folders: ['⛺', '🌲', '🏔️'], routeIcon: '🏕️',
    vars: {
      bg: '#ede3cc', surface: '#f7f0de', 'surface-2': '#e2d6b6', text: '#3a3a24', muted: '#7b7556', line: '#5a5a38',
      accent: '#e8772e', a2: '#6b7044', bw: '2px', 'r-card': '10px', 'r-pill': '12px',
      shadow: '0 4px 0 #5a5a38', 'shadow-sm': '0 3px 0 #5a5a38', 'pin-shadow': '0 2px 0 #3a3a24',
      'font-ui': "'Do Hyeon', sans-serif", 'font-title': "'Alfa Slab One', 'Do Hyeon', serif", 'font-label': "'Alfa Slab One', serif",
      'map-land': '#e6dcbc', 'map-block': '#e0d5b2', 'map-road': '#efe7cf', 'map-major': '#c9a978', 'map-water': '#a9c3b8', 'map-park': '#b7c08a', 'map-label': '#6b7044',
      p1: '#e8772e', p2: '#6b7044', p3: '#4f7a4a', p4: '#a2522c', 'pin-bw': '2px', 'pin-border': '#f7f0de',
      'stop-bg': '#6b7044', route: '#a2522c', 'route-dash': '9 6', 'route-w': '3.5', 'title-color': '#f7f0de', 'tab-off': '#d5c7a2', step: '#9a9070',
      board: '#e2d6b6', 'board-ink': '#3a3a24', dline: '#6b7044', 'dline-dash': '8 6',
    },
    card: ({ ic }) => `<div class="tag-hole"></div><div class="card-row"><span class="card-ic">☕</span><b class="card-name">어니언 성수</b>${ic('pen', 'card-pen')}</div><div class="card-sub">GEAR No.07 · 카페</div><div class="card-row card-row2">${ic('more')}${ic('trash')}</div>`,
    css: `
.map-overlay{background:repeating-radial-gradient(circle at 30% 70%,transparent 0 22px,rgba(107,112,68,.22) 22px 23.5px),repeating-radial-gradient(circle at 85% 20%,transparent 0 18px,rgba(107,112,68,.18) 18px 19.5px);mix-blend-mode:multiply}
.rb,.tab,.fab,.profile{outline:1.5px dashed rgba(90,90,56,.55);outline-offset:-6px}
.rb.on,.tab.big{background:#e8772e;outline-color:rgba(255,255,255,.75)}
.rb.all.on2{background:#6b7044;color:#f7f0de;outline-color:rgba(255,255,255,.6)}
.search{background:#f7f0de}
.card{border:0;box-shadow:none;background:transparent;filter:drop-shadow(0 4px 0 #5a5a38) drop-shadow(0 8px 10px rgba(58,58,36,.2));padding:0}
.card::after{display:none}
.card{--bgc:#f7f0de}
.card > *{position:relative}
.card::before{content:'';position:absolute;inset:0;background:#f7f0de;border:2px solid #5a5a38;clip-path:polygon(22px 0,100% 0,100% 100%,22px 100%,0 calc(100% - 22px),0 22px);z-index:0}
.card{padding:12px 14px 10px 34px}
.tag-hole{position:absolute;left:10px;top:50%;width:12px;height:12px;margin-top:-6px;border-radius:50%;background:#6b7044;box-shadow:0 0 0 3px #c9a978}
.tag-hole::after{content:'';position:absolute;right:8px;top:4px;width:70px;height:2px;background:#a2522c;transform:rotate(-24deg);transform-origin:right}
.card-name{font-size:20px}
.card-sub{font-family:'Do Hyeon';letter-spacing:.04em}
.stop{font-family:'Alfa Slab One';font-size:12px;outline:1.5px dashed rgba(255,255,255,.6);outline-offset:-5px;width:32px;height:32px;margin:-16px 0 0 -16px}
.rtitle{top:220px}
.rt-name{font:400 30px 'Alfa Slab One','Do Hyeon';color:#f7f0de;padding:10px 34px 8px 20px;background:repeating-linear-gradient(0deg,#8a5a34 0 4px,#7a4e2c 4px 9px,#93633b 9px 11px);clip-path:polygon(0 0,calc(100% - 22px) 0,100% 50%,calc(100% - 22px) 100%,0 100%);text-shadow:0 2px 0 #4a2e18}
.rt-name::after{content:'';position:absolute}
.rt-pen{color:#f7f0de;right:28px}
.rt-icon{font-size:28px}
.tray{background:#6b7044;color:#f7f0de;border:0;padding:20px 18px 0;outline:2px dashed rgba(247,240,222,.45);outline-offset:-8px}
.tray-tools{color:#e2d6b6;top:14px;right:22px}
.row-main small,.row-btns{color:#d5c7a2}
.row + .row{border-top:1.5px dashed rgba(247,240,222,.35)}
.ftab{border-radius:8px 8px 0 0;background:#d5c7a2}
.ftab.on{background:#6b7044;color:#f7f0de}
.day-bg{background:linear-gradient(transparent 70%,#c3c99a 70%),repeating-radial-gradient(circle at 70% 30%,transparent 0 26px,rgba(107,112,68,.16) 26px 27.5px),#ede3cc}
.dtitle{top:96px;font:400 40px 'Alfa Slab One';color:#f7f0de;left:50%;right:auto;transform:translateX(-58%);padding:12px 40px 10px 22px;background:repeating-linear-gradient(0deg,#8a5a34 0 4px,#7a4e2c 4px 9px,#93633b 9px 11px);clip-path:polygon(0 0,calc(100% - 24px) 0,100% 50%,calc(100% - 24px) 100%,0 100%);text-shadow:0 2px 0 #4a2e18}
.ddate{top:168px;font:400 13px 'Alfa Slab One';color:#6b7044;letter-spacing:.18em}
.drawing{transform:scale(.82);transform-origin:0 0;left:36px;top:226px}
.dtext{font:700 22px 'Gaegu';color:#3a3a24;top:600px;left:120px;transform:rotate(-2deg)}
`,
    dayText: '성수 트레일 완주!',
    deco: {
      dayBack: [D(178, 158, '<div style="width:0;height:0;background:repeating-linear-gradient(0deg,#7a4e2c 0 6px,#8a5a34 6px 12px);box-shadow:2px 0 0 #4a2e18"></div>', 'left:150px;top:150px')],
      day: [
        D(22, 620, `<div style="width:84px;height:84px;border-radius:50%;background:#6b7044;border:3px solid #3a3a24;outline:2px dashed rgba(247,240,222,.7);outline-offset:-9px;display:grid;place-items:center;text-align:center;color:#f7f0de;font:400 10px/1.2 'Alfa Slab One';${rot(-10)}">SEONGSU<br>⛺<br>TRAIL</div>`),
        D(270, 650, `<div style="width:56px;height:62px;background:#e8772e;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);display:grid;place-items:center;font-size:26px">🔥</div>`),
        D(40, 220, '<div style="font-size:26px">🌲</div>'), D(260, 236, '<div style="font-size:20px">🌲</div>'),
      ],
      map: [D(18, 690, `<div style="width:60px;height:60px;border-radius:50%;background:#e8772e;border:2.5px solid #3a3a24;outline:1.5px dashed rgba(255,255,255,.75);outline-offset:-7px;display:grid;place-items:center;font-size:24px">🧭</div>`)],
    },
  },

  // 16 ────────────────────────────────────────────── 여행
  {
    id: 'travel', name: '여행', en: 'TRAVEL',
    desc: '지도·항공권·여권·스탬프 중심',
    feel: '티켓 형태 카드, 여권 스탬프, 지도 선. 페이지 이동 자체가 여행 기록을 넘기는 느낌',
    swatches: [['블루', '#2c5fa8'], ['오렌지', '#f08a2b'], ['베이지', '#f3ead8']],
    fonts: ['Bebas+Neue', 'Courier+Prime:wght@400;700', 'Do+Hyeon'],
    cats: ['☕', '🍽️', '🏞️', '🛍️'], folders: ['✈️', '🧳', '🗺️'], routeIcon: '✈️',
    vars: {
      bg: '#f3ead8', surface: '#fffaf0', 'surface-2': '#e9dfc8', text: '#1f3a63', muted: '#7a8aa3', line: 'rgba(31,58,99,.3)',
      accent: '#2c5fa8', a2: '#f08a2b', bw: '1.5px', 'r-card': '10px',
      shadow: '0 8px 20px rgba(31,58,99,.18)', 'shadow-sm': '0 2px 8px rgba(31,58,99,.15)',
      'font-ui': "'Do Hyeon', sans-serif", 'font-title': "'Bebas Neue', 'Do Hyeon', sans-serif", 'font-label': "'Courier Prime', monospace",
      'map-land': '#efe4cc', 'map-block': '#e8dcc0', 'map-road': '#f8f1e2', 'map-major': '#f2c08a', 'map-water': '#a9c6dd', 'map-park': '#cbd7b0', 'map-label': '#5a6f93',
      p1: '#2c5fa8', p2: '#f08a2b', p3: '#5f9e6e', p4: '#c0463a', 'pin-bw': '2.5px', 'pin-border': '#fffaf0',
      route: '#f08a2b', 'route-dash': '2 9', 'route-w': '4', 'title-color': '#2c5fa8', 'tab-off': '#e9dfc8', step: '#a9b6cc',
      dline: '#2c5fa8', 'dline-dash': '2 8', 'dline-w': '3.5', board: '#e8ddc6', 'board-ink': '#1f3a63',
    },
    card: ({ ic }) => `<div class="bp-top">BOARDING PASS · ROOT-IN AIR</div><div class="bp"><div class="bp-main"><div class="bp-ft"><span><small>FROM</small>SEONGSU</span><em>✈</em><span><small>TO</small>CAFÉ</span></div><b>어니언 성수</b><div class="bp-meta">GATE 9 · SEAT 03A · 10.03</div></div><div class="bp-stub"><i></i><div class="bp-acts">${ic('pen')}${ic('trash')}</div></div></div>`,
    css: `
.map-overlay{background:linear-gradient(rgba(44,95,168,.12) 1px,transparent 1px) 0 0/100% 64px,linear-gradient(90deg,rgba(44,95,168,.12) 1px,transparent 1px) 0 0/64px 100%}
.rb.on,.tab.big{background:#2c5fa8;box-shadow:0 0 0 3px #fffaf0,0 0 0 4.5px #2c5fa8}
.rb.all.on2{background:#f08a2b;color:#fff;font-family:'Courier Prime';font-weight:700}
.search{font-family:'Do Hyeon';letter-spacing:.02em}
.card{width:276px;padding:0;overflow:hidden;border:0;box-shadow:0 10px 24px rgba(31,58,99,.25)}
.card::after{display:none}
.bp-top{background:#2c5fa8;color:#fff;font:700 10px 'Courier Prime';letter-spacing:.14em;padding:6px 12px}
.bp{display:flex}
.bp-main{flex:1;padding:8px 12px 10px}
.bp-ft{display:flex;align-items:center;justify-content:space-between;font:400 22px/1 'Bebas Neue';color:#1f3a63}
.bp-ft small{display:block;font:700 8px 'Courier Prime';color:#7a8aa3;letter-spacing:.1em}
.bp-ft em{font-style:normal;color:#f08a2b;font-size:16px}
.bp-main b{display:block;font:400 19px 'Do Hyeon';margin-top:4px}
.bp-meta{font:700 9.5px 'Courier Prime';color:#7a8aa3;letter-spacing:.06em;margin-top:2px}
.bp-stub{width:64px;border-left:2px dashed rgba(31,58,99,.35);padding:10px 8px;display:flex;flex-direction:column;justify-content:space-between;align-items:center}
.bp-stub i{display:block;width:44px;height:40px;background:repeating-linear-gradient(90deg,#1f3a63 0 2px,transparent 2px 4px,#1f3a63 4px 5px,transparent 5px 8px,#1f3a63 8px 11px,transparent 11px 12px)}
.bp-acts{display:flex;gap:8px;color:#7a8aa3}.bp-acts .ic{width:16px;height:16px}
.stop{border:2.5px solid #fffaf0;font-family:'Bebas Neue';font-size:16px}
.rt-name{font:400 50px 'Bebas Neue','Do Hyeon';letter-spacing:.04em}
.rt-icon{font-size:28px}
.tray{border-top:0;padding-top:24px}
.tray::before{content:'';position:absolute;left:0;right:0;top:0;height:9px;background:repeating-linear-gradient(-45deg,#c0463a 0 10px,#fffaf0 10px 16px,#2c5fa8 16px 26px,#fffaf0 26px 32px);border-radius:22px 22px 0 0}
.tray-tools{top:18px}
.ftab{border-radius:10px 10px 0 0}
.row-main b{font-size:18px}
.row-f{font:700 10px 'Courier Prime';color:#c0463a;border:1.5px solid #c0463a;border-radius:4px;padding:3px 5px;transform:rotate(-6deg)}
.row-f::before{content:'ICN→'}
.day-bg{background:repeating-radial-gradient(circle at 50% 60%,transparent 0 9px,rgba(44,95,168,.06) 9px 10px),#f3ead8}
.dtitle{font:400 64px 'Bebas Neue';color:#2c5fa8;letter-spacing:.08em;top:98px}
.ddate{top:162px;font:700 12px 'Courier Prime';color:#7a8aa3;letter-spacing:.24em}
.dtext{font:700 16px 'Courier Prime';color:#1f3a63;top:640px;left:40px;transform:none}
`,
    dayText: '✈ ICN → 성수 · 4 STOPS',
    dayDate: 'PASSPORT · 03 OCT 2026',
    deco: {
      day: [
        D(28, 214, stamp('SEOUL<br>★<br>03 OCT 26', '#c0463a', 82, -14)),
        D(232, 530, stamp('ENTRY<br>성수<br>✓', '#2c5fa8', 72, 12)),
        D(186, 214, `<div style="border:2.5px solid #5f9e6e;color:#5f9e6e;padding:4px 8px;font:700 11px 'Courier Prime';letter-spacing:.1em;${rot(8)}filter:url(#wob);opacity:.85">VISITED · 4</div>`),
        D(30, 560, `<div style="border:2.5px double #f08a2b;color:#f08a2b;padding:6px 10px;font:700 12px 'Courier Prime';letter-spacing:.08em;border-radius:8px;${rot(-6)}filter:url(#wob)">DEPARTED 18:30</div>`),
      ],
      route: [D(150, 470, '<div style="font-size:24px;transform:rotate(-28deg)">✈️</div>', 'left:150px;top:378px')],
      map: [D(18, 692, stamp('ROOT<br>·IN·<br>AIR', '#2c5fa8', 64, -10))],
    },
  },

  // 17 ────────────────────────────────────────────── 캘린더
  {
    id: 'calendar', name: '캘린더', en: 'CALENDAR',
    desc: '일정표와 날짜 자체를 디자인 요소로 사용',
    feel: '날짜 블록이 핵심. 카드와 그리드 중심으로 매우 정돈된 UI. 날짜에 스티커나 아이콘을 붙이는 방식도 잘 맞음',
    swatches: [['블루', '#2f6fe0'], ['레드', '#e2453c'], ['화이트', '#ffffff']],
    fonts: ['Archivo+Black', 'Bebas+Neue'],
    folders: ['📌', '🗓️', '⭐'], routeIcon: '🗓️',
    vars: {
      bg: '#ffffff', surface: '#ffffff', 'surface-2': '#f2f5fb', text: '#1b2440', muted: '#8a93a8', line: '#dfe4ee',
      accent: '#2f6fe0', a2: '#e2453c', bw: '1px', 'r-card': '10px', 'r-btn': '12px', 'r-pill': '12px',
      shadow: '0 6px 18px rgba(27,36,64,.10)', 'shadow-sm': '0 2px 8px rgba(27,36,64,.08)',
      'font-title': "'Archivo Black', 'Noto Sans KR', sans-serif", 'font-label': "'Archivo Black', sans-serif",
      'map-land': '#f4f6fa', 'map-block': '#eceff5', 'map-road': '#ffffff', 'map-major': '#dbe6fb', 'map-water': '#cfe0fb', 'map-park': '#dcefe2', 'map-label': '#8a93a8',
      p1: '#2f6fe0', p2: '#e2453c', p3: '#1fa37a', p4: '#f2a516', 'pin-r': '9px',
      route: '#2f6fe0', 'route-w': '3', 'title-color': '#1b2440', step: '#c3cad8', board: '#eef1f7', 'board-ink': '#1b2440', dline: '#2f6fe0', 'dline-w': '2.5',
    },
    card: ({ ic }) => `<div class="cd"><div class="cd-date"><span>OCT</span><b>03</b><em>SAT</em></div><div class="cd-main"><b>어니언 성수</b><small>11:00 – 12:30 · 카페</small><div class="cd-acts">${ic('more')}${ic('pen')}${ic('trash')}</div></div></div>`,
    css: `
.map-overlay{background:linear-gradient(#e6ebf4 1px,transparent 1px) 0 0/100% 46px,linear-gradient(90deg,#e6ebf4 1px,transparent 1px) 0 0/53.6px 100%;opacity:.5}
.rb.all.on2{background:#1b2440}
.card{padding:10px}
.cd{display:flex;gap:12px;align-items:stretch}
.cd-date{width:58px;border:1px solid #dfe4ee;border-radius:8px;overflow:hidden;text-align:center;display:flex;flex-direction:column}
.cd-date span{background:#e2453c;color:#fff;font:400 11px 'Archivo Black';letter-spacing:.1em;padding:3px 0}
.cd-date b{font:400 30px/1.1 'Archivo Black';color:#1b2440;padding-top:4px}
.cd-date em{font:400 9px 'Archivo Black';font-style:normal;color:#8a93a8;padding-bottom:4px}
.cd-main{flex:1;display:flex;flex-direction:column;gap:2px;padding-top:2px}
.cd-main b{font:800 18px 'Noto Sans KR'}
.cd-main small{font-size:12.5px;color:#8a93a8}
.cd-acts{display:flex;gap:14px;justify-content:flex-end;color:#8a93a8;margin-top:auto}.cd-acts .ic{width:17px;height:17px}
.stop{font-family:'Archivo Black';font-size:12px}
.rt-name{font:900 38px 'Noto Sans KR'}
.rt-icon{font-size:26px}
.tray{border-radius:14px 14px 0 0}
.ftab{border-radius:10px 10px 0 0}
.row-ic{width:44px;height:48px;border:1px solid #dfe4ee;border-radius:8px;display:flex;flex-direction:column;overflow:hidden;font-size:0}
.row-ic::before{content:'OCT';background:#e2453c;color:#fff;font:400 9px/1.6 'Archivo Black'}
.row-ic::after{content:'03';font:400 20px/1.3 'Archivo Black';color:#1b2440}
.row + .row .row-ic::before{content:'SEP';background:#2f6fe0}
.row + .row .row-ic::after{content:'27'}
.dtitle{font:400 15px 'Archivo Black';letter-spacing:.3em;color:#2f6fe0;top:98px}
.ddate{display:none}
.drawing{top:286px;transform:scale(.86);transform-origin:0 0;left:40px}
.dtext{font:800 15px 'Noto Sans KR';color:#1b2440;top:640px;left:28px;transform:none}
.dtext::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:#e2453c;margin-right:8px;vertical-align:middle}
`,
    dayText: '성수 데이트 · 4곳 · 11:00–21:00',
    deco: {
      dayBack: [
        D(28, 122, `<div style="display:flex;align-items:flex-end;gap:12px"><div style="font:400 92px/0.9 'Archivo Black';color:#1b2440">03</div><div style="font:400 14px/1.3 'Archivo Black';color:#8a93a8;padding-bottom:6px">OCT<br><span style="color:#e2453c">SAT</span><br>2026</div></div>`),
        D(24, 232, `<div style="width:272px;display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;font:400 10px 'Archivo Black'">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => `<span style="color:${i === 0 ? '#e2453c' : i === 6 ? '#2f6fe0' : '#8a93a8'}">${d}</span>`).join('')}${[27, 28, 29, 30, 1, 2, 3].map((d, i) => `<span style="height:30px;line-height:30px;border-radius:8px;font-size:13px;${d === 3 ? 'background:#2f6fe0;color:#fff' : `background:#f2f5fb;color:${i === 0 ? '#e2453c' : '#1b2440'}`};position:relative">${d}${d === 29 ? '<i style="position:absolute;right:-4px;top:-8px;font-style:normal;font-size:14px">⭐</i>' : ''}${d === 30 ? '<i style="position:absolute;right:-4px;top:-8px;font-style:normal;font-size:14px">💗</i>' : ''}</span>`).join('')}</div>`),
        D(24, 282, '<div style="width:272px;height:340px;border:1px solid #dfe4ee;border-radius:12px;background:linear-gradient(#f2f5fb 1px,transparent 1px) 0 0/100% 34px"></div>'),
      ],
      day: [D(262, 600, '<div style="font-size:30px;transform:rotate(10deg)">📌</div>')],
      map: [D(18, 700, `<div style="background:#fff;border:1px solid #dfe4ee;border-radius:8px;overflow:hidden;width:52px;text-align:center;box-shadow:0 4px 10px rgba(27,36,64,.12)"><div style="background:#e2453c;color:#fff;font:400 9px/1.7 'Archivo Black'">OCT</div><div style="font:400 22px/1.3 'Archivo Black';color:#1b2440">03</div></div>`)],
    },
  },

  // 18 ────────────────────────────────────────────── 귀여운 / Kawaii
  {
    id: 'kawaii', name: '귀여운 / Kawaii', en: 'KAWAII',
    desc: '캐릭터와 둥근 형태 중심의 귀여운 디자인',
    feel: '모든 모서리가 둥글고 아이콘도 캐릭터화. 버튼이 통통하고 표정·하트·별 같은 장식이 많음',
    swatches: [['핑크', '#ffb3cf'], ['스카이블루', '#9ed2ff'], ['크림', '#fff4e3']],
    fonts: ['Jua', 'Dongle:wght@700'],
    cats: ['🧁', '🍙', '🌷', '🎀'], folders: ['🐰', '🐻', '🌷'], routeIcon: '🐰',
    vars: {
      bg: '#fff7ec', surface: '#ffffff', 'surface-2': '#ffe8f0', text: '#6b4a5a', muted: '#b296a3', line: '#ffc2d6',
      accent: '#ff9ec0', a2: '#9ed2ff', bw: '2.5px', 'r-card': '28px',
      shadow: '0 5px 0 #ffd0df', 'shadow-sm': '0 4px 0 #ffd6e3', 'pin-shadow': '0 3px 0 rgba(107,74,90,.18)',
      'font-ui': "'Jua', sans-serif", 'font-title': "'Dongle', 'Jua', sans-serif", 'font-label': "'Jua', sans-serif",
      'map-land': '#fff1e6', 'map-block': '#ffe8ea', 'map-road': '#fffaf5', 'map-major': '#d8ecff', 'map-major-w': '12', 'map-water': '#cbe6ff', 'map-park': '#dff3d8', 'map-label': '#d197ad',
      p1: '#ffb3cf', p2: '#9ed2ff', p3: '#b8e6a8', p4: '#ffd98a', 'pin-bw': '2.5px', 'pin-border': '#fff',
      route: '#ffb3cf', 'route-w': '6', 'route-dash': '1 11', 'title-color': '#ff7fa8', 'tab-off': '#ffeef4', step: '#ffc2d6',
      dline: '#ffb3cf', 'dline-w': '5', 'dline-dash': '1 10', board: '#fff0e6', 'board-ink': '#6b4a5a',
    },
    css: `
.pin span{display:none}
.pin{width:34px;height:32px;margin:-16px 0 0 -17px;border-radius:50% 50% 46% 46%}
.pin::before{content:'';position:absolute;left:9px;top:12px;width:4px;height:5px;border-radius:50%;background:#5a3a4a;box-shadow:12px 0 #5a3a4a}
.pin::after{content:'';position:absolute;left:5px;top:18px;width:6px;height:3px;border-radius:50%;background:rgba(255,120,150,.55);box-shadow:18px 0 rgba(255,120,150,.55)}
.pin.sel{width:44px;height:40px;margin:-20px 0 0 -22px}
.pin.sel::before{left:12px;top:15px;width:5px;height:6px;box-shadow:15px 0 #5a3a4a}
.pin.sel::after{left:7px;top:23px;width:8px;height:4px;box-shadow:22px 0 rgba(255,120,150,.55)}
.tab.big{position:relative;overflow:visible}
.tab.big::before,.tab.big::after{content:'';position:absolute;top:-8px;width:24px;height:24px;border-radius:50%;background:#ff9ec0;border:2.5px solid #ffc2d6;z-index:-1}
.tab.big::before{left:2px}.tab.big::after{right:2px}
.rb.on,.tab.big{border-color:#fff;box-shadow:0 0 0 2.5px #ffc2d6,0 5px 0 2.5px #ffc2d6}
.rb.all.on2{background:#9ed2ff;border-color:#fff}
.rb.all{font:400 14px 'Jua'}
.search{font-size:17px}
.card{padding:14px 16px 10px}
.card::after{bottom:-10px}
.card-ic{background:#ffe8f0;font-size:22px}
.card-name{font:400 20px 'Jua'}
.stop{font-family:'Jua';font-size:15px;width:34px;height:34px;margin:-17px 0 0 -17px}
.rt-name{font:700 62px/0.9 'Dongle','Jua';color:#ff7fa8;-webkit-text-stroke:4px #fff;paint-order:stroke fill;filter:drop-shadow(0 3px 0 #ffc2d6)}
.rt-icon{font-size:36px}
.tray{border-radius:34px 34px 0 0}
.ftab{border-radius:20px 20px 0 0}
.row-main b{font:400 18px 'Jua'}
.day-bg{background:radial-gradient(#ffd6e3 2px,transparent 2.5px) 0 0/26px 26px,#fff7ec}
.dtitle{font:700 92px/0.8 'Dongle';color:#ff7fa8;-webkit-text-stroke:6px #fff;paint-order:stroke fill;filter:drop-shadow(0 4px 0 #ffc2d6);top:92px}
.ddate{top:168px;color:#b296a3;font:400 14px 'Jua'}
.ping{filter:drop-shadow(0 3px 0 rgba(255,158,192,.4))}
.drawing{transform:scale(.84);transform-origin:0 0;left:40px;top:220px}
.dtext{font:400 18px 'Jua';color:#6b4a5a;background:#fff;border:2.5px solid #ffc2d6;border-radius:22px;padding:8px 14px;top:590px;left:110px;transform:none;box-shadow:0 4px 0 #ffd6e3}
.dtext::before{content:'';position:absolute;left:-12px;top:14px;border:7px solid transparent;border-right:9px solid #ffc2d6}
`,
    dayText: '오늘도 수고했어!',
    deco: {
      map: [D(22, 692, heart('#ff9ec0', 26)), D(54, 722, star('#ffd98a', 18))],
      route: [D(40, 236, heart('#ffb3cf', 22)), D(296, 300, star('#ffd98a', 20)), D(54, 300, '<div style="font:400 18px Jua;color:#ff9ec0">♡</div>')],
      day: [
        D(30, 576, `<div style="width:70px;height:70px;border-radius:50%;background:#fff;border:3px solid #ffc2d6;position:relative;box-shadow:0 4px 0 #ffd6e3">
          <i style="position:absolute;left:8px;top:-14px;width:16px;height:30px;border-radius:50%;background:#fff;border:3px solid #ffc2d6;transform:rotate(-12deg)"></i>
          <i style="position:absolute;right:8px;top:-14px;width:16px;height:30px;border-radius:50%;background:#fff;border:3px solid #ffc2d6;transform:rotate(12deg)"></i>
          <i style="position:absolute;left:0;right:0;top:0;bottom:0;border-radius:50%;background:#fff"></i>
          <i style="position:absolute;left:20px;top:28px;width:6px;height:7px;border-radius:50%;background:#5a3a4a;box-shadow:22px 0 #5a3a4a"></i>
          <i style="position:absolute;left:14px;top:38px;width:9px;height:5px;border-radius:50%;background:#ffb3cf;box-shadow:30px 0 #ffb3cf"></i>
          <i style="position:absolute;left:31px;top:38px;width:8px;height:5px;border-bottom:2px solid #5a3a4a;border-radius:0 0 50% 50%"></i></div>`),
        D(34, 104, star('#ffd98a', 26)), D(270, 176, heart('#ff9ec0', 20)), D(258, 120, '<div style="font:700 26px Dongle;color:#9ed2ff">★</div>'),
      ],
    },
  },
];
