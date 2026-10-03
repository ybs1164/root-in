// Themes 19–26: 키치 · 스티커 · 장난감 · 손그림 · 낙서 · 동화책 · 꿈 · 드림코어
import { D, star, spark, heart, rot } from './helpers.mjs';

const OUTLINE = (w = 3) => `filter:drop-shadow(${w}px 0 #fff) drop-shadow(-${w}px 0 #fff) drop-shadow(0 ${w}px #fff) drop-shadow(0 -${w}px #fff) drop-shadow(0 4px 5px rgba(0,0,0,.25))`;
const ransom = (word, styles) => [...word].map((ch, i) => `<span style="${styles[i % styles.length]}">${ch}</span>`).join('');
const KITSCH_STYLES = [
  "font-family:'Bungee';background:#ff2e93;color:#fff;transform:rotate(-6deg)",
  "font-family:'Abril Fatface';background:#b6ff3b;color:#111;transform:rotate(5deg)",
  "font-family:'Permanent Marker';background:#fff;color:#ff2e93;transform:rotate(-3deg)",
  "font-family:'Lobster';background:#111;color:#ffe600;transform:rotate(7deg)",
  "font-family:'Bungee';background:#ffe600;color:#111;transform:rotate(-8deg)",
];
const studs = (n, c, s = 12) => `<div style="display:flex;gap:${s}px">${`<i style="display:block;width:${s + 6}px;height:${s - 2}px;border-radius:50% 50% 30% 30%;background:${c};box-shadow:inset 0 -3px 0 rgba(0,0,0,.2),inset 0 2px 0 rgba(255,255,255,.45)"></i>`.repeat(n)}</div>`;
const scribbleStar = (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" style="filter:url(#wob)"><path d="M12 2l2.6 6.6 7 .4-5.4 4.5 1.8 6.9L12 16.6l-6 3.8 1.8-6.9L2.4 9l7-.4z" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const doodleArrow = (c, w, h, d) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible;filter:url(#wob)"><path d="${d}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const cloud = (w, o = 1, blur = 0) => `<div style="width:${w}px;height:${w * 0.42}px;position:relative;opacity:${o};filter:blur(${blur}px)"><i style="position:absolute;left:0;bottom:0;width:100%;height:55%;border-radius:999px;background:#fff"></i><i style="position:absolute;left:16%;bottom:22%;width:42%;height:78%;border-radius:50%;background:#fff"></i><i style="position:absolute;left:44%;bottom:18%;width:36%;height:64%;border-radius:50%;background:#fff"></i></div>`;
const win95 = (title, w, h, body, extra = '') => `<div style="width:${w}px;height:${h}px;background:#c0c0c0;box-shadow:inset -2px -2px 0 #404040,inset 2px 2px 0 #fff,inset -3px -3px 0 #808080,inset 3px 3px 0 #dfdfdf;padding:4px;${extra}"><div style="height:20px;background:linear-gradient(90deg,#0a2a8a,#3a7ad8);color:#fff;font:16px/20px 'VT323';padding:0 4px;display:flex;justify-content:space-between"><span>${title}</span><span style="display:flex;gap:2px">${['_', '□', '×'].map((s) => `<b style="width:16px;height:14px;margin-top:3px;background:#c0c0c0;color:#000;font:12px/13px 'VT323';text-align:center;box-shadow:inset -1px -1px 0 #404040,inset 1px 1px 0 #fff">${s}</b>`).join('')}</span></div>${body}</div>`;

export const THEMES_D = [
  // 19 ────────────────────────────────────────────── 키치
  {
    id: 'kitsch', name: '키치', en: 'KITSCH',
    desc: '일부러 촌스럽고 과하게 꾸민 재미',
    feel: '폰트·색·스티커를 의도적으로 뒤섞음. 정돈보다는 개성이 강하고 잡지 콜라주 같은 UI',
    swatches: [['핫핑크', '#ff2e93'], ['라임', '#b6ff3b'], ['옐로우', '#ffe600']],
    fonts: ['Bungee', 'Lobster', 'Black+Han+Sans', 'Permanent+Marker', 'Abril+Fatface', 'Yeon+Sung', 'Do+Hyeon'],
    cats: ['💋', '🍒', '🌈', '💿'], folders: ['💋', '🍒', '🦄'], routeIcon: '💖',
    vars: {
      bg: '#fff59a', surface: '#ffffff', 'surface-2': '#b6ff3b', text: '#111111', muted: '#444444', line: '#111111',
      accent: '#ff2e93', a2: '#b6ff3b', a3: '#ffe600', bw: '3px', 'r-card': '4px',
      shadow: '5px 5px 0 #111', 'shadow-sm': '3px 3px 0 #111', 'pin-shadow': '2px 2px 0 #111',
      'font-ui': "'Do Hyeon', sans-serif", 'font-title': "'Bungee', 'Black Han Sans', sans-serif", 'font-label': "'Bungee', sans-serif", 'font-hand': "'Yeon Sung', cursive",
      'map-land': '#ffe7f3', 'map-block': '#ffd0ea', 'map-road': '#ffffff', 'map-major': '#b6ff3b', 'map-major-w': '12', 'map-water': '#7fd6ff', 'map-park': '#c8ff7a', 'map-label': '#ff2e93',
      p1: '#ff2e93', p2: '#b6ff3b', p3: '#ffe600', p4: '#7fd6ff', 'pin-bw': '3px', 'pin-border': '#111', 'pin-r': '30%',
      'stop-bg': '#111', 'stop-fg': '#ffe600', route: '#111', 'route-w': '4', 'route-dash': '12 5', 'title-color': '#111', 'tab-off': '#b6ff3b', step: '#111',
      'day-bg': '#ff2e93', dline: '#111', 'dline-w': '3.5', board: '#ffe9f4', 'board-ink': '#111',
    },
    card: ({ ic }) => `<div class="kc-name">${ransom('어니언성수', ["font-family:'Black Han Sans';background:#ff2e93;color:#fff", "font-family:'Yeon Sung';background:#ffe600", "font-family:'Do Hyeon';background:#111;color:#b6ff3b", "font-family:'Black Han Sans';background:#b6ff3b", "font-family:'Yeon Sung';background:#7fd6ff"])}</div><div class="card-sub">☕ 카페 · 성동구 아차산로9길 8</div><div class="card-row card-row2">${ic('more')}<span class="kc-wow">HOT!</span>${ic('trash')}</div>`,
    css: `
.map-overlay{background:radial-gradient(rgba(255,46,147,.35) 1.2px,transparent 1.6px) 0 0/8px 8px;mix-blend-mode:multiply}
.rail .rb:nth-child(odd){transform:rotate(-8deg)}.rail .rb:nth-child(even){transform:rotate(7deg)}
.rail .rb:nth-child(3){background:#ffe600}.rail .rb:nth-child(4){background:#7fd6ff;border-radius:6px}.rail .rb:nth-child(5){background:#b6ff3b}.rail .rb:nth-child(6){background:#fff;clip-path:polygon(50% 0,61% 32%,98% 35%,68% 56%,79% 92%,50% 70%,21% 92%,32% 56%,2% 35%,39% 32%);border:0;box-shadow:none;background:#ffe600}
.rb.on,.tab.big{background:#ff2e93;color:#fff}
.rb.all.on2{background:#111;color:#b6ff3b}
.search{border-radius:4px;transform:rotate(-1.5deg);background:#fff;font-family:'Permanent Marker','Do Hyeon';font-size:17px}
.profile{background:#b6ff3b;color:#111;transform:rotate(8deg)}
.card{transform:translate(-50%,-100%) rotate(-3deg);background:#fff;border-radius:2px;padding:14px 14px 8px}
.card::after{display:none}
.card::before{content:'';position:absolute;left:30px;top:-12px;width:80px;height:22px;background:rgba(182,255,59,.85);transform:rotate(-8deg);border:2px dashed #111}
.kc-name{display:flex;gap:3px}
.kc-name span{font-size:22px;padding:2px 5px;border:2px solid #111;display:inline-block}
.kc-name span:nth-child(odd){transform:rotate(-5deg)}.kc-name span:nth-child(even){transform:rotate(4deg) translateY(2px)}
.card-sub{margin:8px 0 0;font-family:'Yeon Sung';font-size:15px;color:#111}
.kc-wow{font:400 14px 'Bungee';background:#ffe600;border:2px solid #111;padding:1px 8px;transform:rotate(-6deg);color:#ff2e93}
.tab:not(.big){background:#7fd6ff;transform:rotate(-8deg)}
.fab{background:#ffe600;transform:rotate(10deg)}
.stop{border-radius:4px;font-family:'Bungee';transform:rotate(-8deg)}
.stop:nth-of-type(even){transform:rotate(8deg);background:#ff2e93;color:#fff}
.rtitle{top:216px}
.rt-name{font-size:0;display:flex;gap:4px;justify-content:center}
.rt-name span{font-size:30px;padding:4px 8px;border:3px solid #111;box-shadow:3px 3px 0 #111;display:inline-block}
.rt-name .rt-pen{display:none}
.tray{background:#fff;border-radius:0;transform:none;background-image:repeating-linear-gradient(-45deg,transparent 0 16px,rgba(255,230,0,.35) 16px 22px)}
.ftab{border-radius:4px 4px 0 0}
.ftab:nth-child(odd){transform:rotate(-4deg)}.ftab:nth-child(even){transform:rotate(4deg)}
.ftab.on{background:#ff2e93;color:#fff;transform:none}
.row.on{background:#ffe600;border:3px solid #111;box-shadow:4px 4px 0 #111;padding:10px 10px 30px;transform:rotate(-1deg)}
.row-main b{font:400 20px 'Black Han Sans'}
.row-main small{color:#111}
.day-bg{background:${'repeating-conic-gradient(#111 0 25%,#fff 0 50%) 0 650px/30px 30px no-repeat'},radial-gradient(rgba(255,255,255,.35) 2px,transparent 2.5px) 0 0/14px 14px,#ff2e93}
.day-bg::after{content:'';position:absolute;left:0;right:0;top:650px;height:30px;background:repeating-conic-gradient(#111 0 25%,#fff 0 50%) 0 0/30px 30px}
.scr-day .status{color:#fff}
.dtitle{font-size:0;display:flex;justify-content:center;gap:6px;top:96px;left:-40px}
.dtitle span{font-size:40px;padding:2px 10px;border:3px solid #111;box-shadow:4px 4px 0 #111;display:inline-block;line-height:1.1}
.ddate{top:166px;color:#fff;font:400 13px 'Bungee';letter-spacing:.1em}
.drawing{transform:scale(.8) rotate(-3deg);transform-origin:0 0;left:52px;top:236px}
.dtext{font:400 30px 'Yeon Sung';color:#111;background:#b6ff3b;border:3px solid #111;padding:2px 12px;box-shadow:4px 4px 0 #111;top:592px;left:40px;transform:rotate(-5deg)}
.drail .rb:nth-child(odd){transform:rotate(-8deg)}.drail .rb:nth-child(even){transform:rotate(7deg);background:#ffe600}
.drail .share{background:#b6ff3b;color:#111}
.day-step{color:#fff}
`,
    dayTitle: ransom('TODAY', KITSCH_STYLES),
    dayText: '오늘 완전 최고♥♥',
    deco: {
      dayBack: [D(34, 218, `<div style="width:262px;height:340px;background:#fff;border:3px solid #111;box-shadow:6px 6px 0 #111;${rot(-3)}"></div>`)],
      day: [
        D(238, 520, `<div style="width:90px;height:90px;background:#ffe600;clip-path:polygon(50% 0,61% 22%,85% 10%,80% 37%,100% 50%,80% 63%,85% 90%,61% 78%,50% 100%,39% 78%,15% 90%,20% 63%,0 50%,20% 37%,15% 10%,39% 22%);display:grid;place-items:center;font:400 18px 'Bungee';color:#ff2e93;${rot(12)}">WOW!</div>`),
        D(24, 210, `<div style="font-size:42px;${OUTLINE(3)};${rot(-14)}">💋</div>`),
        D(250, 200, `<div style="font-size:36px;${OUTLINE(3)};${rot(14)}">🍒</div>`),
        D(30, 680, `<div style="font:400 22px 'Lobster';color:#ffe600;-webkit-text-stroke:1px #111;${rot(-4)}">so cute~!!</div>`),
      ],
      map: [D(18, 686, `<div style="width:76px;height:76px;background:#ffe600;clip-path:polygon(50% 0,61% 22%,85% 10%,80% 37%,100% 50%,80% 63%,85% 90%,61% 78%,50% 100%,39% 78%,15% 90%,20% 63%,0 50%,20% 37%,15% 10%,39% 22%);display:grid;place-items:center;font:400 13px 'Bungee';color:#ff2e93;${rot(-10)}">NEW!</div>`), D(36, 230, `<div style="font-size:30px;${OUTLINE(3)}">🌈</div>`, 'left:30px;top:420px')],
      route: [D(36, 210, `<div style="font-size:34px;${OUTLINE(3)};${rot(-12)}">🦄</div>`), D(286, 310, `<div style="font:400 18px 'Permanent Marker';color:#ff2e93;${rot(10)}">yay!</div>`)],
    },
    routeName: ransom('성수데이트', ["font-family:'Black Han Sans';background:#ffe600;transform:rotate(-5deg)", "font-family:'Yeon Sung';background:#ff2e93;color:#fff;transform:rotate(4deg)", "font-family:'Do Hyeon';background:#fff;transform:rotate(-2deg)", "font-family:'Black Han Sans';background:#b6ff3b;transform:rotate(6deg)", "font-family:'Yeon Sung';background:#111;color:#ffe600;transform:rotate(-4deg)"]),
  },

  // 20 ────────────────────────────────────────────── 스티커
  {
    id: 'sticker', name: '스티커', en: 'STICKER',
    desc: '스티커 자체가 주요 UI 요소',
    feel: '버튼, 카테고리, 상태표시까지 스티커처럼 표현. 흰 테두리와 작은 그림이 화면 곳곳에 붙어 있음',
    swatches: [['옐로우', '#ffd23f'], ['핑크', '#ff7eb6'], ['블루', '#4d9de0']],
    fonts: ['Jua', 'Luckiest+Guy'],
    cats: ['☕', '🍜', '🌳', '🛼'], folders: ['⭐', '🌈', '🐶'], routeIcon: '⭐',
    vars: {
      bg: '#f6f1e7', surface: '#ffffff', 'surface-2': '#fff3c4', text: '#2a2a3a', muted: '#7c7c8c', line: 'transparent',
      accent: '#ff7eb6', a2: '#ffd23f', a3: '#4d9de0', 'r-card': '22px',
      shadow: '0 0 0 4px #fff,0 7px 12px rgba(0,0,0,.22)', 'shadow-sm': '0 0 0 4px #fff,0 5px 9px rgba(0,0,0,.2)', 'pin-shadow': '0 0 0 3px #fff,0 3px 6px rgba(0,0,0,.25)',
      'font-ui': "'Jua', sans-serif", 'font-title': "'Luckiest Guy', 'Jua', sans-serif", 'font-label': "'Luckiest Guy', sans-serif",
      'map-land': '#f1ece0', 'map-block': '#e9e2d2', 'map-road': '#fbf8f1', 'map-major': '#ffe38a', 'map-water': '#b9dcf7', 'map-park': '#cfe9bd', 'map-label': '#9a9284',
      p1: '#ffd23f', p2: '#ff7eb6', p3: '#4d9de0', p4: '#7ed68a',
      'stop-bg': '#4d9de0', route: '#ff7eb6', 'route-w': '6', 'title-color': '#2a2a3a', 'tray-bg': '#f3efe6', 'tab-off': '#e8e2d4', step: '#bdb5a5',
      dline: '#ff7eb6', 'dline-w': '5', board: '#efe9dc', 'board-ink': '#2a2a3a',
    },
    css: `
.rail .rb:nth-child(3){background:#ffd23f}.rail .rb:nth-child(4){background:#ff7eb6}.rail .rb:nth-child(5){background:#7ed68a}.rail .rb:nth-child(6){background:#4d9de0}
.rail .rb:nth-child(odd){transform:rotate(-6deg)}.rail .rb:nth-child(even){transform:rotate(5deg)}
.rb.all.on2{background:#4d9de0;color:#fff;font-size:15px}
.rb.all{font-family:'Luckiest Guy';padding-top:3px}
.search{transform:rotate(-1deg);font-size:17px}
.profile{background:#ffd23f;color:#2a2a3a}
.card{background:#ffd23f;transform:translate(-50%,-100%) rotate(-2.5deg);padding:14px 16px 10px}
.card::after{display:none}
.card::before{content:'';position:absolute;right:0;top:0;width:30px;height:30px;background:linear-gradient(225deg,#f6f1e7 50%,#fff 50%,#e8e2d4 100%);border-radius:0 22px 0 8px;box-shadow:-2px 2px 4px rgba(0,0,0,.18)}
.card-ic{background:#fff;box-shadow:0 0 0 3px #fff,0 2px 4px rgba(0,0,0,.2)}
.card-name{font:400 20px 'Jua'}
.card-pen{margin-right:22px}
.card-sub{color:#6a5a2a}
.card-row2{color:#6a5a2a}
.tab:not(.big){background:#4d9de0;color:#fff;transform:rotate(-8deg)}
.tab.big{transform:rotate(4deg)}
.fab{background:#7ed68a;color:#fff;transform:rotate(8deg)}
.stop{font-family:'Luckiest Guy';font-size:15px;padding-top:3px}
.stop:nth-of-type(odd){background:#ffd23f;color:#2a2a3a}
.rlines line{filter:drop-shadow(0 0 0 #fff) drop-shadow(2px 0 #fff) drop-shadow(-2px 0 #fff) drop-shadow(0 2px #fff) drop-shadow(0 -2px #fff)}
.rt-name{font:400 44px 'Luckiest Guy','Jua';color:#ff7eb6;-webkit-text-stroke:8px #fff;paint-order:stroke fill;filter:drop-shadow(0 4px 4px rgba(0,0,0,.25))}
.rt-icon{${OUTLINE(3)}}
.tray{box-shadow:0 -6px 20px rgba(0,0,0,.12);background:#f3efe6 radial-gradient(rgba(0,0,0,.04) 1px,transparent 1.5px) 0 0/10px 10px}
.ftab{box-shadow:none}
.ftab.on{background:#f3efe6}
.row{background:#fff;border-radius:18px;padding:10px 12px;box-shadow:0 0 0 3px #fff,0 4px 8px rgba(0,0,0,.15);margin-top:26px;transform:rotate(-.8deg)}
.row + .row{margin-top:12px;border:0;transform:rotate(.8deg)}
.row.on{background:#ff7eb6;color:#fff;padding-bottom:30px}
.row.on small,.row.on .row-btns{color:#ffe3f0}
.row-ic{${OUTLINE(2)}}
.day-bg{background:radial-gradient(rgba(0,0,0,.05) 1.2px,transparent 1.6px) 0 0/12px 12px,#f6f1e7}
.dtitle{font:400 60px 'Luckiest Guy';color:#ffd23f;-webkit-text-stroke:10px #fff;paint-order:stroke fill;filter:drop-shadow(0 5px 5px rgba(0,0,0,.22));top:94px}
.ddate{top:166px;font:400 14px 'Luckiest Guy';color:#4d9de0;letter-spacing:.14em}
.drawing{transform:scale(.8);transform-origin:0 0;left:48px;top:230px}
.ping{filter:drop-shadow(1.5px 0 #fff) drop-shadow(-1.5px 0 #fff) drop-shadow(0 1.5px #fff) drop-shadow(0 -1.5px #fff) drop-shadow(0 3px 3px rgba(0,0,0,.25))}
.dlines line{filter:drop-shadow(1.5px 0 #fff) drop-shadow(-1.5px 0 #fff)}
.dtext{font:400 21px 'Jua';color:#2a2a3a;background:#fff;border-radius:14px;padding:6px 14px;box-shadow:0 0 0 4px #fff,0 5px 9px rgba(0,0,0,.2);top:600px;left:40px;transform:rotate(-4deg)}
.drail .rb:nth-child(1){background:#ffd23f}.drail .rb:nth-child(2){background:#ff7eb6;color:#fff}.drail .rb:nth-child(3){background:#4d9de0;color:#fff}.drail .rb:nth-child(4){background:#7ed68a;color:#fff}
.drail .rb:nth-child(odd){transform:rotate(-6deg)}.drail .rb:nth-child(even){transform:rotate(6deg)}
`,
    dayText: '스티커 모으기 4/4 ✓',
    deco: {
      map: [D(22, 690, `<div style="font-size:40px;${OUTLINE(3)};${rot(-12)}">🐶</div>`), D(70, 238, `<div style="font:400 14px 'Luckiest Guy';background:#7ed68a;color:#fff;padding:5px 10px 2px;border-radius:999px;box-shadow:0 0 0 3px #fff,0 4px 6px rgba(0,0,0,.2);${rot(-8)}">OPEN!</div>`, 'left:180px;top:150px')],
      route: [D(34, 222, `<div style="font-size:34px;${OUTLINE(3)};${rot(-14)}">🌈</div>`), D(292, 300, `<div style="font-size:28px;${OUTLINE(3)};${rot(12)}">⭐</div>`)],
      day: [
        D(28, 214, `<div style="font-size:46px;${OUTLINE(4)};${rot(-12)}">🐶</div>`),
        D(246, 214, `<div style="font-size:38px;${OUTLINE(4)};${rot(10)}">🌈</div>`),
        D(244, 540, `<div style="font-size:42px;${OUTLINE(4)};${rot(14)}">🍦</div>`),
        D(40, 520, `<div style="font-size:30px;${OUTLINE(3)};${rot(-6)}">⭐</div>`),
        D(30, 664, `<div style="font:400 14px 'Luckiest Guy';background:#ff7eb6;color:#fff;padding:6px 12px 3px;border-radius:999px;box-shadow:0 0 0 4px #fff,0 4px 8px rgba(0,0,0,.2);${rot(-8)}">GOOD DAY!</div>`, 'left:200px;top:664px'),
      ],
    },
  },

  // 21 ────────────────────────────────────────────── 장난감
  {
    id: 'toy', name: '장난감', en: 'TOY',
    desc: '플라스틱 완구와 어린 시절 놀이 감성',
    feel: '입체적인 플라스틱 버튼, 큰 아이콘, 강한 원색. 실제 장난감 기계를 조작하는 듯한 UI',
    swatches: [['옐로우', '#ffd100'], ['레드', '#e63329'], ['블루', '#1f5fd1']],
    fonts: ['Baloo+2:wght@700;800', 'Jua', 'Do+Hyeon'],
    cats: ['🧸', '🍭', '🌳', '🎈'], folders: ['🧸', '🚂', '🎈'], routeIcon: '🚂',
    vars: {
      bg: '#fff6d6', surface: '#ffffff', 'surface-2': '#ffe680', text: '#1d2b5a', muted: '#5b6aa0', line: 'transparent',
      accent: '#e63329', a2: '#ffd100', a3: '#1f5fd1', 'r-card': '20px', 'r-pill': '18px',
      shadow: 'inset 0 -6px 0 rgba(0,0,0,.2),inset 0 4px 0 rgba(255,255,255,.45),0 6px 0 #1d2b5a', 'shadow-sm': 'inset 0 -5px 0 rgba(0,0,0,.2),inset 0 3px 0 rgba(255,255,255,.5),0 5px 0 #1d2b5a', 'pin-shadow': 'inset 0 -3px 0 rgba(0,0,0,.2),0 3px 0 #1d2b5a',
      'font-ui': "'Jua', sans-serif", 'font-title': "'Baloo 2', 'Jua', sans-serif", 'font-label': "'Baloo 2', sans-serif",
      'map-land': '#9dd67a', 'map-block': '#bfe39a', 'map-road': '#8c95a6', 'map-major': '#5d6678', 'map-major-w': '14', 'map-water': '#4fb3ff', 'map-park': '#6cc75a', 'map-label': '#1d2b5a',
      p1: '#e63329', p2: '#1f5fd1', p3: '#ffd100', p4: '#22b25a',
      'stop-bg': '#ffd100', 'stop-fg': '#1d2b5a', route: '#e63329', 'route-w': '7', 'title-color': '#1d2b5a', 'tab-off': '#ffe680', step: '#1d2b5a',
      dline: '#1d2b5a', 'dline-w': '3', 'ping-hole': '#fff', board: '#fff1c2', 'board-ink': '#1d2b5a',
    },
    css: `
.map .blk:nth-child(5n){fill:#ffe680}.map .blk:nth-child(7n){fill:#ffb3a8}.map .blk:nth-child(11n){fill:#a8c8ff}
.map .major{stroke-dasharray:none}
.map-overlay{background:linear-gradient(transparent,rgba(255,255,255,.08))}
.rb,.tab,.fab,.profile{background:#fff;border:0}
.rail .rb:nth-child(3){background:#ffd100}.rail .rb:nth-child(4){background:#1f5fd1;color:#fff}.rail .rb:nth-child(5){background:#22b25a;color:#fff}.rail .rb:nth-child(6){background:#ffd100}
.rb.on,.tab.big{background:#e63329;color:#fff}
.rb.all.on2{background:#1f5fd1;color:#fff;font:800 13px 'Baloo 2'}
.search{background:#1f5fd1;padding:5px;border:0}
.search::before{content:'';position:absolute}
.search{color:#5b6aa0}
.search .ic,.search span{position:relative;z-index:1}
.search{background:linear-gradient(#fff,#fff) padding-box;box-shadow:0 0 0 5px #1f5fd1,inset 0 3px 0 rgba(0,0,0,.08),0 8px 0 #1d2b5a;margin:5px}
.profile{background:#ffd100}
.pin{border:0}
.card{background:#ffd100;padding:18px 14px 10px;border:0}
.card::after{background:#ffd100;border:0;box-shadow:none;bottom:-7px}
.card::before{content:'';position:absolute;left:18px;right:18px;top:-9px;height:12px;background:radial-gradient(ellipse 9px 6px at 50% 50%,#ffd100 98%,transparent) 0 0/32px 12px repeat-x;filter:drop-shadow(0 -1px 0 rgba(0,0,0,.15))}
.card-ic{background:#fff;box-shadow:inset 0 -3px 0 rgba(0,0,0,.15)}
.card-name{font:400 21px 'Jua'}
.card-sub,.card-row2{color:#6a5410}
.tab:not(.big){background:#1f5fd1;color:#fff}
.fab{background:#22b25a;color:#fff}
.bottom{left:50%;right:auto;transform:translateX(-50%);background:#1f5fd1;padding:12px 18px;border-radius:24px;box-shadow:inset 0 -6px 0 rgba(0,0,0,.2),0 8px 0 #1d2b5a;bottom:24px}
.bottom .tab:not(.big){background:#ffd100;color:#1d2b5a}
.stop{font:800 16px 'Baloo 2';border:0}
.rtitle{top:210px}
.rt-name{font:400 32px 'Jua';color:#fff;background:#e63329;padding:14px 22px 10px;border-radius:14px;box-shadow:inset 0 -6px 0 rgba(0,0,0,.2),inset 0 4px 0 rgba(255,255,255,.35),0 6px 0 #1d2b5a}
.rt-name::before{content:'';position:absolute;left:14px;right:14px;top:-8px;height:10px;background:radial-gradient(ellipse 8px 5px at 50% 50%,#e63329 98%,transparent) 0 0/26px 10px repeat-x}
.rt-pen{color:#fff;right:-26px}
.tray{background:#ffd100;border:0;box-shadow:inset 0 6px 0 rgba(255,255,255,.35),0 -6px 20px rgba(0,0,0,.15)}
.tray::after{content:'';position:absolute;right:12px;bottom:12px;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle,#c9a400 30%,#e8be00 32%);box-shadow:-339px 0 0 #e8be00}
.ftab{background:#fff6d6;border:0}
.ftab.on{background:#ffd100}
.row{background:#fff;border-radius:16px;padding:10px 12px;margin-top:28px;box-shadow:inset 0 -4px 0 rgba(0,0,0,.08)}
.row.on{padding-bottom:30px}
.row + .row{margin-top:10px;border:0}
.row-main b{font:400 19px 'Jua'}
.day-bg{background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.5) 0 6px,transparent 6.5px) 0 0/34px 34px,#ffd100}
.dtitle{font:800 54px 'Baloo 2';color:#fff;background:#1f5fd1;left:50%;right:auto;transform:translateX(-56%);padding:10px 22px 0;border-radius:16px;box-shadow:inset 0 -6px 0 rgba(0,0,0,.2),inset 0 4px 0 rgba(255,255,255,.35),0 6px 0 #1d2b5a;top:90px;line-height:1.1}
.ddate{top:182px;font:800 14px 'Baloo 2';color:#1d2b5a}
.drawing{transform:scale(.74);transform-origin:0 0;left:62px;top:250px}
.ping path{stroke:#1d2b5a;stroke-width:1.2}
.dtext{font:400 18px 'Jua';color:#1d2b5a;top:620px;left:46px;transform:none}
.drail .rb:nth-child(1){background:#e63329;color:#fff}.drail .rb:nth-child(2){background:#1f5fd1;color:#fff}.drail .rb:nth-child(3){background:#22b25a;color:#fff}
`,
    dayText: '오늘의 놀이 코스 완성!',
    deco: {
      dayBack: [
        D(30, 220, `<div style="width:270px;height:390px;border-radius:28px;background:#e63329;box-shadow:inset 0 -8px 0 rgba(0,0,0,.2),inset 0 6px 0 rgba(255,255,255,.3),0 8px 0 #1d2b5a"></div>`),
        D(48, 238, `<div style="width:234px;height:300px;border-radius:14px;background:#d9dcd6 radial-gradient(rgba(0,0,0,.08) 1px,transparent 1.5px) 0 0/5px 5px;box-shadow:inset 0 4px 8px rgba(0,0,0,.25)"></div>`),
        D(62, 560, `<div style="width:206px;display:flex;justify-content:space-between">${'<i style="display:block;width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,#d9d9d9);box-shadow:inset 0 -3px 0 rgba(0,0,0,.15),0 3px 0 #8a1a14"></i>'.repeat(2)}</div>`),
        D(126, 566, `<div style="font:800 13px 'Baloo 2';color:#fff;letter-spacing:.1em">MAGIC DOODLE</div>`),
      ],
      map: [D(22, 688, `<div style="font-size:42px;${rot(-10)}">🧸</div>`)],
      route: [D(30, 232, studs(3, '#22b25a', 10)), D(268, 300, '<div style="font-size:30px">🎈</div>')],
    },
  },

  // 22 ────────────────────────────────────────────── 손그림
  {
    id: 'handdrawn', name: '손그림', en: 'HAND-DRAWN',
    desc: '사람이 직접 그린 듯한 불규칙한 디자인',
    feel: '삐뚤어진 선, 손글씨, 직접 그린 아이콘. 버튼 테두리조차 완벽한 사각형이 아닌 UI',
    swatches: [['아이보리', '#fbf6e9'], ['블루', '#3d6fb6'], ['오렌지', '#f08a3c']],
    fonts: ['Gaegu:wght@400;700', 'Gamja+Flower'],
    vars: {
      bg: '#fbf6e9', surface: '#fffdf6', 'surface-2': '#f3ead3', text: '#2d3a5a', muted: '#6d779a', line: '#2d3a5a',
      accent: '#3d6fb6', a2: '#f08a3c', bw: '2px', 'r-card': '18px 22px 16px 24px', 'r-btn': '48% 52% 50% 46%', 'r-pill': '22px 28px 24px 30px',
      shadow: '3px 4px 0 rgba(45,58,90,.85)', 'shadow-sm': '2px 3px 0 rgba(45,58,90,.85)', 'pin-shadow': '1px 2px 0 #2d3a5a',
      'font-ui': "'Gaegu', cursive", 'font-title': "'Nanum Pen Script', cursive", 'font-label': "'Gaegu', cursive", 'font-hand': "'Nanum Pen Script', cursive",
      'map-land': '#fbf6e9', 'map-block': '#fbf6e9', 'map-block-stroke': '#2d3a5a', 'map-block-sw': '1.3', 'map-road': '#fbf6e9', 'map-major': '#f8cfa6', 'map-major-w': '12', 'map-water': '#c7d9f0', 'map-park': '#d8e8c4', 'map-label': '#2d3a5a',
      p1: '#f08a3c', p2: '#3d6fb6', p3: '#6aa85a', p4: '#d65b6a', 'pin-bw': '2px', 'pin-border': '#2d3a5a', 'pin-r': '48% 52% 46% 54%',
      route: '#f08a3c', 'route-w': '3.5', 'stop-bg': '#fffdf6', 'stop-fg': '#2d3a5a', 'title-color': '#2d3a5a', 'tab-off': '#f3ead3', step: '#2d3a5a',
      dline: '#2d3a5a', 'dline-w': '2.2', board: '#f3ecd9', 'board-ink': '#2d3a5a',
    },
    css: `
.map svg{filter:url(#wob)}
.map .park{fill:url(#hatchG)}.map .water{fill:url(#hatchB)}
.map-overlay{background:var(--noise);opacity:.12;mix-blend-mode:multiply}
.rb,.tab,.fab,.profile,.search,.card,.pin,.stop,.ftab,.row.on,.dtext{filter:url(#wob)}
.rb.on,.tab.big{background:repeating-linear-gradient(-50deg,#3d6fb6 0 3px,#6d93cc 3px 6px);color:#fff}
.rb.all.on2{background:repeating-linear-gradient(-50deg,#f08a3c 0 3px,#f6b07a 3px 6px);color:#2d3a5a;font-weight:700}
.rb .ic,.tab .ic,.fab .ic,.search .ic,.card .ic,.drail .ic{stroke-width:2.2}
.search{font-size:18px}
.card-name{font:700 21px 'Gaegu'}
.card-sub{font-size:15px}
.card-ic{border:2px solid #2d3a5a;border-radius:46% 54% 50% 50%}
.stop{border:2px solid #2d3a5a;font:700 16px 'Gaegu'}
.rlines line{filter:url(#wob2)}
.rt-name{font:400 56px 'Nanum Pen Script'}
.rt-name::after{content:'';position:absolute;left:-6px;right:-6px;bottom:2px;height:12px;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 12' preserveAspectRatio='none'><path d='M2 7 C40 2 70 11 110 6 S170 3 198 8' fill='none' stroke='%23f08a3c' stroke-width='3' stroke-linecap='round'/></svg>") 0 0/100% 100%}
.tray{border:2px solid #2d3a5a;border-bottom:0;border-radius:26px 30px 0 0;filter:url(#wob)}
.row-main b{font:700 20px 'Gaegu'}
.row-main small{font-size:15px}
.row.on{background:rgba(240,138,60,.13);border-radius:16px 22px 14px 20px;padding-left:8px}
.day-bg::after{content:'';position:absolute;inset:0;background:var(--noise);opacity:.1;mix-blend-mode:multiply}
.dtitle{font:400 76px 'Nanum Pen Script';top:84px;transform:rotate(-3deg)}
.ddate{top:166px;font:700 16px 'Gaegu';letter-spacing:.04em}
.drawing{filter:url(#wob)}
.ping path{stroke:#2d3a5a;stroke-width:1.4}
.dtext{font:400 27px 'Nanum Pen Script';top:620px;left:44px}
`,
    dayText: '성수 한 바퀴 → 다리 아픔 ㅎㅎ',
    deco: {
      mapBack: [D(0, 0, `<svg width="0" height="0"><defs><pattern id="hatchG" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="7" height="7" fill="#e3eed6"/><line x1="0" y1="0" x2="0" y2="7" stroke="#6aa85a" stroke-width="1.6"/></pattern><pattern id="hatchB" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><rect width="8" height="8" fill="#dae6f5"/><line x1="0" y1="0" x2="0" y2="8" stroke="#3d6fb6" stroke-width="1.3"/></pattern></defs></svg>`)],
      map: [D(24, 690, doodleArrow('#3d6fb6', 60, 40, 'M4 30 C20 4 40 4 56 20 M48 12 l8 8 -10 4'))],
      route: [D(40, 226, scribbleStar('#f08a3c', 30)), D(290, 300, `<svg width="34" height="34" viewBox="0 0 34 34" style="filter:url(#wob)"><circle cx="17" cy="17" r="10" fill="none" stroke="#f08a3c" stroke-width="2.4"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="17" y1="2" x2="17" y2="5" stroke="#f08a3c" stroke-width="2.4" stroke-linecap="round" transform="rotate(${a} 17 17)"/>`).join('')}</svg>`)],
      day: [
        D(78, 162, `<svg width="210" height="20" viewBox="0 0 210 20" style="filter:url(#wob)"><path d="M4 10 C50 2 90 18 140 8 S190 6 206 12" fill="none" stroke="#f08a3c" stroke-width="4" stroke-linecap="round"/></svg>`, 'left:82px;top:150px'),
        D(36, 220, scribbleStar('#3d6fb6', 34)), D(250, 560, `<svg width="60" height="60" viewBox="0 0 60 60" style="filter:url(#wob)">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="30" cy="16" rx="8" ry="12" fill="#fde1c8" stroke="#f08a3c" stroke-width="2" transform="rotate(${a} 30 30)"/>`).join('')}<circle cx="30" cy="30" r="6" fill="#ffd36e" stroke="#2d3a5a" stroke-width="1.8"/></svg>`),
        D(40, 560, doodleArrow('#2d3a5a', 70, 50, 'M6 6 C10 30 30 44 62 40 M52 32 l10 8 -12 6')),
      ],
    },
  },

  // 23 ────────────────────────────────────────────── 낙서
  {
    id: 'doodle', name: '낙서', en: 'DOODLE',
    desc: '노트 위에 자유롭게 끄적인 디자인',
    feel: '공책 배경, 볼펜 선, 형광펜, 화살표와 메모. 정보 주변에 의미 없는 낙서까지 배치 가능',
    swatches: [['화이트', '#ffffff'], ['블랙', '#1a1a1a'], ['옐로우', '#ffe14d']],
    fonts: ['Gaegu:wght@400;700', 'Permanent+Marker', 'Caveat:wght@600;700'],
    vars: {
      bg: '#ffffff', surface: '#ffffff', 'surface-2': '#fff6b0', text: '#1a1a1a', muted: '#555555', line: '#1a1a1a',
      accent: '#ffe14d', 'on-accent': '#1a1a1a', a2: '#1a1a1a', bw: '1.8px', 'r-card': '6px', 'r-btn': '50%', 'r-pill': '8px',
      shadow: 'none', 'shadow-sm': 'none', 'pin-shadow': 'none',
      'font-ui': "'Gaegu', cursive", 'font-title': "'Permanent Marker', 'Nanum Pen Script', cursive", 'font-label': "'Caveat', cursive", 'font-hand': "'Nanum Pen Script', cursive",
      'map-land': '#ffffff', 'map-block': 'rgba(255,255,255,0)', 'map-block-stroke': '#1a1a1a', 'map-block-sw': '1', 'map-road': '#ffffff', 'map-major': 'rgba(255,225,77,.75)', 'map-major-w': '14', 'map-water': 'url(#scribbleW)', 'map-park': 'url(#scribbleP)', 'map-label': '#1a1a1a',
      p1: '#1a1a1a', p2: '#1a1a1a', p3: '#1a1a1a', p4: '#1a1a1a', 'pin-bw': '1.8px', 'pin-border': '#1a1a1a',
      'stop-bg': '#fff', 'stop-fg': '#1a1a1a', route: '#1a1a1a', 'route-w': '2', 'title-color': '#1a1a1a', 'tab-off': '#ffffff', step: '#1a1a1a',
      dline: '#1a1a1a', 'dline-w': '1.8', 'ping-hole': '#ffe14d', board: '#f4f4ef', 'board-ink': '#1a1a1a',
    },
    css: `
.map svg{filter:url(#wob)}
.map-overlay{background:linear-gradient(90deg,transparent 38px,rgba(226,80,80,.55) 38px 39.5px,transparent 39.5px),repeating-linear-gradient(transparent 0 27px,rgba(80,140,210,.4) 27px 28px)}
.rb,.tab,.fab,.profile,.search,.card,.stop,.ftab,.tray{filter:url(#wob)}
.rb,.tab,.fab,.profile{outline:1.4px solid #1a1a1a;outline-offset:2px}
.rb.on,.tab.big{background:#ffe14d}
.rb.all.on2{background:#1a1a1a;color:#ffe14d;font:700 17px 'Caveat'}
.rb.all{font:700 17px 'Caveat'}
.pin{background:#fff}
.pin.sel{background:#ffe14d}
.search{font-size:18px}
.card{padding:12px 14px 8px}
.card-name{font:700 21px 'Gaegu';background:linear-gradient(transparent 55%,rgba(255,225,77,.85) 55% 92%,transparent 92%)}
.card-name{flex:none}
.card-row:first-child::after{content:'';flex:1}
.card-ic{background:none;border:1.8px solid #1a1a1a}
.stop{font:700 18px 'Caveat';border:1.8px solid #1a1a1a}
.rlines line{filter:url(#wob2)}
.rt-name{font:400 44px 'Permanent Marker','Nanum Pen Script';background:linear-gradient(transparent 50%,rgba(255,225,77,.85) 50% 88%,transparent 88%);transform:rotate(-2deg)}
.tray{background:#fff repeating-linear-gradient(transparent 0 27px,rgba(80,140,210,.35) 27px 28px);border-top:1.8px solid #1a1a1a;box-shadow:none}
.ftab{border:1.8px solid #1a1a1a;border-bottom:0}
.ftab.on{background:#ffe14d}
.row-main b{font:700 20px 'Gaegu'}
.row-main small{font-size:15px;color:#333}
.row.on .row-main b{background:linear-gradient(transparent 55%,rgba(255,225,77,.85) 55% 92%,transparent 92%)}
.day-bg{background:linear-gradient(90deg,transparent 38px,rgba(226,80,80,.55) 38px 39.5px,transparent 39.5px),repeating-linear-gradient(transparent 0 27px,rgba(80,140,210,.4) 27px 28px) 0 12px,#fff}
.dtitle{font:400 58px 'Permanent Marker';top:92px;transform:rotate(-4deg)}
.dtitle span{background:linear-gradient(transparent 48%,rgba(255,225,77,.9) 48% 90%,transparent 90%);padding:0 8px}
.ddate{top:166px;font:700 20px 'Caveat';color:#1a1a1a;letter-spacing:.06em}
.drawing{filter:url(#wob)}
.ping path{fill:#fff;stroke:#1a1a1a;stroke-width:1.6}
.ping.big path{fill:#ffe14d}
.ping circle{fill:#fff;stroke:#1a1a1a;stroke-width:1.2}
.dtext{font:400 32px 'Nanum Pen Script';top:616px;left:60px;transform:rotate(-3deg)}
.drail .share{background:#1a1a1a;color:#ffe14d}
`,
    dayTitle: '<span>TODAY!!</span>',
    dayText: '→ 성수 또 가기!! ★★★',
    deco: {
      mapBack: [D(0, 0, `<svg width="0" height="0"><defs><pattern id="scribbleW" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)"><rect width="10" height="10" fill="#fff"/><path d="M0 5 Q2.5 2 5 5 T10 5" fill="none" stroke="#3a6fc0" stroke-width="1"/></pattern><pattern id="scribbleP" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#fff"/><line x1="0" y1="0" x2="0" y2="6" stroke="#1a1a1a" stroke-width=".9"/></pattern></defs></svg>`)],
      map: [
        D(228, 480, `<div style="display:flex;align-items:center;gap:2px;transform:rotate(-8deg)">${doodleArrow('#1a1a1a', 50, 30, 'M48 6 C30 2 14 10 6 24 M6 12 l0 12 12 -2')}<span style="font:400 26px 'Nanum Pen Script'">여기!!</span></div>`),
        D(24, 690, scribbleStar('#1a1a1a', 30)), D(60, 724, `<svg width="40" height="40" viewBox="0 0 40 40" style="filter:url(#wob)"><path d="M20 20 m0 -2 a2 2 0 1 1 -2 2 a5 5 0 1 1 6 -5 a9 9 0 1 1 -12 9 a13 13 0 1 1 18 -13" fill="none" stroke="#1a1a1a" stroke-width="1.6"/></svg>`),
      ],
      route: [D(40, 226, `<svg width="40" height="40" viewBox="0 0 40 40" style="filter:url(#wob)"><circle cx="20" cy="20" r="15" fill="none" stroke="#1a1a1a" stroke-width="1.8"/><circle cx="14" cy="16" r="1.8" fill="#1a1a1a"/><circle cx="26" cy="16" r="1.8" fill="#1a1a1a"/><path d="M12 24 Q20 32 28 24" fill="none" stroke="#1a1a1a" stroke-width="1.8"/></svg>`), D(282, 290, scribbleStar('#1a1a1a', 30))],
      day: [
        D(250, 200, scribbleStar('#1a1a1a', 34)), D(40, 218, `<div style="font:700 20px 'Caveat';transform:rotate(-10deg)">best day ever →</div>`),
        D(248, 560, `<svg width="54" height="54" viewBox="0 0 40 40" style="filter:url(#wob)"><circle cx="20" cy="20" r="15" fill="#ffe14d" stroke="#1a1a1a" stroke-width="1.8"/><circle cx="14" cy="16" r="1.8" fill="#1a1a1a"/><circle cx="26" cy="16" r="1.8" fill="#1a1a1a"/><path d="M12 24 Q20 32 28 24" fill="none" stroke="#1a1a1a" stroke-width="1.8"/></svg>`),
        D(56, 668, `<svg width="140" height="20" viewBox="0 0 140 20" style="filter:url(#wob)"><path d="M2 10 q8 -12 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" fill="none" stroke="#1a1a1a" stroke-width="1.6"/></svg>`),
      ],
    },
  },

  // 24 ────────────────────────────────────────────── 동화책
  {
    id: 'storybook', name: '동화책', en: 'STORYBOOK',
    desc: '그림책의 삽화와 페이지 구성',
    feel: '페이지를 넘기는 듯한 화면 전환, 삽화 중심 카드. UI 자체가 책 속 그림의 일부처럼 자연스럽게 섞임',
    swatches: [['크림', '#f6efd9'], ['그린', '#4c8b4a'], ['레드', '#c8443a']],
    fonts: ['Gowun+Batang:wght@400;700', 'Cormorant+Garamond:ital,wght@0,700;1,600;1,700'],
    cats: ['☕', '🍎', '🌳', '🍄'], folders: ['📖', '🍄', '🌙'], routeIcon: '📖',
    vars: {
      bg: '#f6efd9', surface: '#fbf6e6', 'surface-2': '#efe3c2', text: '#3a3226', muted: '#8a7a5e', line: 'rgba(76,139,74,.55)',
      accent: '#c8443a', a2: '#4c8b4a', bw: '1.5px', 'r-card': '14px',
      shadow: '0 8px 22px rgba(58,50,38,.2)', 'shadow-sm': '0 3px 8px rgba(58,50,38,.15)',
      'font-ui': "'Gowun Batang', serif", 'font-title': "'Cormorant Garamond', 'Gowun Batang', serif", 'font-label': "'Cormorant Garamond', serif",
      'map-land': '#f4ead0', 'map-block': '#efe2c2', 'map-road': '#f8f1de', 'map-major': '#e9cfa0', 'map-water': '#a9cbd3', 'map-park': '#a9c98f', 'map-label': '#6a5a3e',
      p1: '#c8443a', p2: '#4c8b4a', p3: '#d9a33a', p4: '#5a7fae', 'pin-bw': '2px', 'pin-border': '#fbf6e6',
      route: '#c8443a', 'route-dash': '1 7', 'route-w': '3.5', 'title-color': '#3a3226', 'tab-off': '#efe3c2', step: '#b9a985',
      dline: '#4c8b4a', 'dline-dash': '1 6', 'dline-w': '3', board: '#efe6cc', 'board-ink': '#3a3226',
    },
    css: `
.map svg{filter:url(#wob2) saturate(.85)}
.map-overlay{background:var(--noise),radial-gradient(ellipse at 50% 50%,transparent 55%,rgba(120,90,40,.22));opacity:.55;mix-blend-mode:multiply}
.rb,.tab,.fab,.profile{border:1.5px solid rgba(76,139,74,.6)}
.rb.on,.tab.big{background:#c8443a;border-color:#fbf6e6;box-shadow:0 0 0 2px #c8443a,var(--shadow-sm)}
.rb.all.on2{background:#4c8b4a;color:#fbf6e6;font:italic 700 15px 'Cormorant Garamond'}
.search{font-family:'Gowun Batang'}
.card{border:1.5px solid rgba(76,139,74,.6);box-shadow:inset 0 0 0 4px #fbf6e6,inset 0 0 0 5px rgba(200,68,58,.35),var(--shadow);padding:14px 16px 10px}
.card::before{content:'❦';position:absolute;right:12px;top:6px;color:#4c8b4a;font-size:14px}
.card-name{font:700 19px 'Gowun Batang'}
.card-ic{background:#efe3c2;border:1.5px solid rgba(76,139,74,.5)}
.stop{font:italic 700 16px 'Cormorant Garamond';border:2px solid #fbf6e6}
.rt-name{font:700 40px 'Gowun Batang'}
.rt-name::before{content:'~ chapter 3 ~';display:block;font:italic 600 16px 'Cormorant Garamond';color:#4c8b4a;letter-spacing:.06em}
.tray{border-top:1.5px solid rgba(76,139,74,.5);background:#fbf6e6}
.tray::after{content:'';position:absolute;right:0;bottom:0;width:46px;height:46px;background:linear-gradient(135deg,transparent 50%,#e2d4ae 50%,#f3e9cf);box-shadow:-3px -3px 6px rgba(58,50,38,.12)}
.ftab{border:1.5px solid rgba(76,139,74,.4);border-bottom:0}
.row-main b{font:700 18px 'Gowun Batang'}
.day-bg{background:#f6efd9}
.day-bg::after{content:'';position:absolute;inset:0;background:var(--noise);opacity:.25;mix-blend-mode:multiply}
.dtitle{font:italic 700 58px 'Cormorant Garamond';top:96px;color:#3a3226}
.dtitle::first-letter{color:#c8443a;font-size:80px}
.ddate{top:166px;font:italic 600 16px 'Cormorant Garamond';color:#4c8b4a;letter-spacing:.08em}
.drawing{transform:scale(.72);transform-origin:0 0;left:66px;top:230px}
.ping path{stroke:#fbf6e6;stroke-width:1.2}
.dtext{font:400 15px/1.6 'Gowun Batang';color:#3a3226;top:606px;left:40px;transform:none;width:280px}
.dtext::first-letter{font:700 30px 'Gowun Batang';color:#c8443a;float:left;margin:2px 6px 0 0;line-height:1}
`,
    dayDate: 'Once upon a time, 10월 3일',
    dayText: '그날 우리는 성수에서 네 곳을 걸었어요.',
    deco: {
      dayBack: [
        D(0, 470, `<svg width="375" height="160" viewBox="0 0 375 160" style="filter:url(#wob2)"><path d="M0 70 C60 20 120 40 190 70 S320 40 375 60 V160 H0z" fill="#b9d49a" opacity=".75"/><path d="M0 110 C80 70 160 90 230 110 S340 90 375 100 V160 H0z" fill="#8fbb74" opacity=".8"/></svg>`),
        D(24, 420, `<svg width="54" height="90" viewBox="0 0 54 90" style="filter:url(#wob)"><rect x="24" y="40" width="7" height="48" fill="#7a5a36"/><circle cx="27" cy="30" r="24" fill="#4c8b4a"/><circle cx="18" cy="24" r="4" fill="#c8443a"/><circle cx="34" cy="34" r="4" fill="#c8443a"/></svg>`),
        D(270, 470, `<svg width="60" height="60" viewBox="0 0 60 60" style="filter:url(#wob)"><path d="M8 30 L30 10 L52 30z" fill="#c8443a"/><rect x="14" y="30" width="32" height="26" fill="#fbf6e6" stroke="#7a5a36" stroke-width="2"/><rect x="26" y="40" width="9" height="16" fill="#7a5a36"/></svg>`),
        D(318, 770, '<div style="width:60px;height:60px;background:linear-gradient(135deg,transparent 50%,#e2d4ae 50%,#f3e9cf);box-shadow:-4px -4px 8px rgba(58,50,38,.15)"></div>', 'left:315px;top:752px'),
      ],
      map: [D(20, 690, `<svg width="56" height="80" viewBox="0 0 54 90" style="filter:url(#wob)"><rect x="24" y="40" width="7" height="48" fill="#7a5a36"/><circle cx="27" cy="30" r="24" fill="#4c8b4a"/><circle cx="18" cy="24" r="4" fill="#c8443a"/><circle cx="34" cy="34" r="4" fill="#c8443a"/></svg>`)],
      route: [D(282, 230, '<div style="font-size:28px">🍄</div>')],
    },
  },

  // 25 ────────────────────────────────────────────── 꿈
  {
    id: 'dream', name: '꿈', en: 'DREAMY',
    desc: '흐릿하고 현실과 동떨어진 몽환적 분위기',
    feel: '블러, 빛 번짐, 반투명 카드, 느린 애니메이션. 버튼이 떠다니거나 구름처럼 배치되는 부드러운 UI',
    swatches: [['라벤더', '#c7b8f5'], ['스카이블루', '#a9d4f7'], ['화이트', '#ffffff']],
    fonts: ['Gowun+Dodum', 'Quicksand:wght@300;500'],
    cats: ['☁️', '🌙', '🫧', '✨'], folders: ['🌙', '☁️', '🫧'], routeIcon: '🌙',
    vars: {
      bg: '#eef0fb', surface: 'rgba(255,255,255,.5)', 'surface-2': 'rgba(255,255,255,.4)', text: '#5a5a86', muted: '#9a9ac0', line: 'rgba(255,255,255,.75)',
      accent: '#b9a6f2', a2: '#a9d4f7', bw: '1px', 'r-card': '30px',
      shadow: '0 10px 40px rgba(150,140,220,.35)', 'shadow-sm': '0 6px 24px rgba(150,140,220,.3)', 'pin-shadow': '0 0 14px rgba(185,166,242,.9)',
      'font-ui': "'Gowun Dodum', sans-serif", 'font-title': "'Quicksand', 'Gowun Dodum', sans-serif", 'font-label': "'Quicksand', sans-serif",
      'map-land': '#ece9f8', 'map-block': '#e4e2f5', 'map-road': '#f7f6fd', 'map-major': '#dcd6f7', 'map-water': '#cde4f8', 'map-park': '#e0ecf3', 'map-label': '#a9a6cc',
      p1: '#c7b8f5', p2: '#a9d4f7', p3: '#f5c6e6', p4: '#bfe8e0', 'pin-bw': '2px', 'pin-border': 'rgba(255,255,255,.9)',
      route: '#c7b8f5', 'route-w': '5', 'stop-bg': 'rgba(255,255,255,.75)', 'stop-fg': '#7a6ac0', 'title-color': '#7a72b8', 'tray-bg': 'rgba(255,255,255,.45)', 'tab-off': 'rgba(255,255,255,.3)', step: '#c4c0e6',
      'day-bg': 'linear-gradient(180deg,#d9d0fb 0%,#e3ecfb 45%,#fbf8ff 100%)', dline: '#ffffff', 'dline-w': '3', 'ping-hole': '#fff', board: 'linear-gradient(135deg,#e6e0fb,#e3f0fb)', 'board-ink': '#5a5a86',
    },
    css: `
.map{filter:blur(.7px) saturate(.6) brightness(1.04)}
.map-overlay{background:radial-gradient(circle at 20% 30%,rgba(199,184,245,.55),transparent 40%),radial-gradient(circle at 80% 70%,rgba(169,212,247,.55),transparent 42%),radial-gradient(circle at 60% 15%,rgba(255,255,255,.7),transparent 30%)}
.search,.card,.tray,.rb,.tab,.fab,.profile,.stop{backdrop-filter:blur(14px) saturate(1.3);-webkit-backdrop-filter:blur(14px) saturate(1.3)}
.rail .rb:nth-child(2){transform:translateX(-10px)}.rail .rb:nth-child(3){transform:translateX(4px)}.rail .rb:nth-child(4){transform:translateX(-8px)}.rail .rb:nth-child(5){transform:translateX(6px)}.rail .rb:nth-child(6){transform:translateX(-4px)}.rail .rb:nth-child(7){transform:translateX(-12px)}
.rb.on,.tab.big{background:linear-gradient(135deg,#c7b8f5,#a9d4f7);color:#fff;box-shadow:0 0 24px rgba(185,166,242,.9),0 0 0 4px rgba(255,255,255,.5)}
.rb.all.on2{background:rgba(255,255,255,.75);color:#7a6ac0;font:500 12px 'Quicksand';letter-spacing:.14em}
.search{font-family:'Gowun Dodum';letter-spacing:.04em}
.card{box-shadow:0 0 0 1px rgba(255,255,255,.8),0 14px 40px rgba(150,140,220,.4);padding:16px 18px 10px}
.card::after{background:rgba(255,255,255,.5)}
.card-name{font-weight:400;font-family:'Gowun Dodum';letter-spacing:.04em}
.card-ic{background:rgba(255,255,255,.6)}
.pin{filter:blur(.2px)}
.stop{font:500 14px 'Quicksand';box-shadow:0 0 16px rgba(185,166,242,.9)}
.rlines line{filter:drop-shadow(0 0 6px #c7b8f5)}
.rt-name{font:300 40px 'Quicksand','Gowun Dodum';letter-spacing:.06em;text-shadow:0 0 18px #fff,0 0 30px rgba(199,184,245,.9)}
.tab:not(.big){transform:translateY(-10px)}
.fab{transform:translateY(-16px)}
.tray{border-radius:0;border:0;padding-top:30px}
.tray::before{content:'';position:absolute;left:-20px;right:-20px;top:-26px;height:52px;background:radial-gradient(circle at 30px 30px,rgba(255,255,255,.45) 28px,transparent 29px) 0 0/70px 60px repeat-x;filter:blur(1px)}
.ftabs{top:-50px}
.ftab{border-radius:50%;width:44px;height:44px;border:1px solid rgba(255,255,255,.8)}
.ftab.on{height:44px;box-shadow:0 0 18px rgba(185,166,242,.8)}
.row-main b{font:400 18px 'Gowun Dodum';letter-spacing:.04em}
.dtitle{font:300 46px 'Quicksand';letter-spacing:.32em;padding-left:.32em;color:#fff;text-shadow:0 0 16px rgba(185,166,242,.9),0 0 40px rgba(169,212,247,.9);top:104px;text-transform:lowercase}
.ddate{top:166px;font:500 12px 'Quicksand';color:#8a86c0;letter-spacing:.3em}
.ping{filter:drop-shadow(0 0 8px rgba(185,166,242,1)) blur(.2px)}
.dlines line{filter:drop-shadow(0 0 4px #c7b8f5)}
.dtext{font:400 17px 'Gowun Dodum';letter-spacing:.12em;color:#7a72b8;top:618px;left:0;right:0;text-align:center;transform:none;text-shadow:0 0 12px #fff}
.drail .rb:nth-child(2){transform:translateX(-8px)}.drail .rb:nth-child(4){transform:translateX(-12px)}.drail .rb:nth-child(5){transform:translateX(4px)}
`,
    dayText: '꿈에서 걸었던 길 같아',
    deco: {
      dayBack: [
        D(-60, 190, '<div style="width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.9),rgba(199,184,245,0) 70%);filter:blur(10px)"></div>'),
        D(200, 460, '<div style="width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(169,212,247,.9),rgba(169,212,247,0) 70%);filter:blur(14px)"></div>'),
        D(-30, 560, cloud(200, 0.85, 3)), D(220, 700, cloud(190, 0.9, 2)), D(170, 210, cloud(130, 0.6, 4)),
      ],
      day: [D(40, 120, spark('#fff', 22), 'filter:drop-shadow(0 0 6px #c7b8f5)'), D(272, 186, spark('#fff', 14), 'filter:drop-shadow(0 0 6px #a9d4f7)'), D(60, 540, spark('#fff', 16), 'filter:drop-shadow(0 0 6px #c7b8f5)')],
      map: [D(-20, 640, cloud(170, 0.7, 3)), D(30, 700, spark('#fff', 20), 'filter:drop-shadow(0 0 6px #c7b8f5)')],
      route: [D(30, 200, cloud(110, 0.75, 2)), D(250, 290, spark('#fff', 18), 'filter:drop-shadow(0 0 6px #c7b8f5)')],
    },
  },

  // 26 ────────────────────────────────────────────── 드림코어
  {
    id: 'dreamcore', name: '드림코어', en: 'DREAMCORE',
    desc: '어린 시절의 익숙한 이미지와 비현실적 공간을 결합',
    feel: '구름·들판·별·창문·옛 컴퓨터 그래픽 등을 혼합. 익숙하지만 묘하게 이상한 UI. 메뉴가 공간 속에 떠 있는 듯한 구성',
    swatches: [['스카이블루', '#6ec3ff'], ['옐로우', '#ffe45c'], ['그린', '#6fcf6b']],
    fonts: ['VT323', 'Silkscreen', 'Do+Hyeon'],
    cats: ['☁️', '🌻', '🌳', '⭐'], folders: ['☁️', '🌻', '🚪'], routeIcon: '🚪',
    vars: {
      bg: '#8fd3ff', surface: '#ffffff', 'surface-2': '#c0c0c0', text: '#1a1a2e', muted: '#4a4a5a', line: 'transparent',
      accent: '#ffe45c', 'on-accent': '#1a1a2e', a2: '#6fcf6b', a3: '#6ec3ff', 'r-card': '0', 'r-btn': '0', 'r-pill': '0',
      shadow: 'inset -2px -2px 0 #404040,inset 2px 2px 0 #fff,inset -3px -3px 0 #808080,inset 3px 3px 0 #dfdfdf,6px 6px 0 rgba(26,26,46,.25)', 'shadow-sm': 'inset -2px -2px 0 #404040,inset 2px 2px 0 #fff,inset -3px -3px 0 #808080,inset 3px 3px 0 #dfdfdf', 'pin-shadow': '0 3px 0 rgba(26,26,46,.35)',
      'font-ui': "'Do Hyeon', sans-serif", 'font-title': "'VT323', 'Do Hyeon', monospace", 'font-label': "'VT323', monospace",
      'map-land': '#9fe08c', 'map-block': '#b5ea9f', 'map-road': '#e9f7ff', 'map-major': '#ffe45c', 'map-water': '#6ec3ff', 'map-park': '#6fcf6b', 'map-label': '#1a4a2a',
      p1: '#ffe45c', p2: '#ff8fd0', p3: '#6ec3ff', p4: '#ffffff', 'pin-bw': '2px', 'pin-border': '#1a1a2e', 'pin-r': '50%',
      'stop-bg': '#ffe45c', 'stop-fg': '#1a1a2e', route: '#ffffff', 'route-w': '4', 'route-dash': '2 7', 'title-color': '#ffffff', 'tray-bg': '#c0c0c0', 'tab-off': '#a8a8a8', step: '#ffffff',
      'btn-bg': '#c0c0c0', 'btn-fg': '#1a1a2e', 'day-bg': 'linear-gradient(180deg,#5bb6ff 0%,#9fdcff 55%,#d8f2ff 70%)', dline: '#ffffff', 'dline-w': '3', 'dline-dash': '2 6',
      'status-ink': '#1a1a2e', board: 'linear-gradient(180deg,#bfe6ff,#e6f6ff)', 'board-ink': '#1a1a2e',
    },
    card: ({ ic }) => win95('어니언성수.exe', 262, 116, `<div style="display:flex;gap:10px;align-items:center;padding:10px 8px 4px"><span style="font-size:28px">☕</span><div style="flex:1"><b style="font:400 19px 'Do Hyeon';display:block">어니언 성수</b><small style="font:16px 'VT323';color:#4a4a5a">C:\\성수\\카페\\아차산로9길</small></div></div><div style="display:flex;justify-content:flex-end;gap:6px;padding:0 6px"><span class="w95b">⋯</span><span class="w95b">수정</span><span class="w95b">삭제</span></div>`),
    css: `
.map-overlay{background:radial-gradient(circle at 70% 20%,rgba(255,255,255,.35),transparent 35%)}
.rb,.tab,.fab,.profile,.search{border:0}
.profile{border-radius:0;background:#c0c0c0;box-shadow:var(--shadow-sm)}
.search{background:#fff;box-shadow:inset 2px 2px 0 #404040,inset -2px -2px 0 #fff,inset 3px 3px 0 #808080,inset -3px -3px 0 #dfdfdf;font-family:'VT323','Do Hyeon';font-size:20px;color:#4a4a5a}
.rb.on,.tab.big{background:#ffe45c}
.rb.all.on2{background:#6fcf6b;color:#1a1a2e;font:20px 'VT323'}
.pin{border-radius:50%}
.card{background:transparent;box-shadow:none;border:0;padding:0;width:262px;filter:drop-shadow(6px 6px 0 rgba(26,26,46,.25))}
.card::after{display:none}
.w95b{font:15px/18px 'VT323';padding:2px 10px;background:#c0c0c0;box-shadow:inset -1px -1px 0 #404040,inset 1px 1px 0 #fff,inset -2px -2px 0 #808080}
.stop{font:20px 'VT323';border-radius:50%}
.rt-name{font:56px 'VT323','Do Hyeon';color:#fff;text-shadow:3px 3px 0 #1a6ab8,0 0 18px rgba(255,255,255,.8)}
.rt-icon{font-size:34px}
.tray{box-shadow:inset -2px -2px 0 #404040,inset 2px 2px 0 #fff,inset -3px -3px 0 #808080,inset 3px 3px 0 #dfdfdf;border-radius:0;left:10px;right:10px;bottom:10px;height:194px;padding-top:30px}
.tray::before{content:'C:\\\\ROOT-IN\\\\루트';position:absolute;left:4px;right:4px;top:4px;height:22px;background:linear-gradient(90deg,#0a2a8a,#3a7ad8);color:#fff;font:18px/22px 'VT323';padding:0 6px}
.tray-tools{top:32px;color:#1a1a2e}
.ftabs{left:14px;top:-34px}
.ftab{border-radius:0;height:34px;box-shadow:inset -2px 0 0 #404040,inset 2px 2px 0 #fff;border:0}
.ftab.on{background:#c0c0c0;height:36px}
.row{margin-top:30px}
.row.on{background:#0a2a8a;color:#fff}
.row.on small,.row.on .row-btns{color:#c8d8ff}
.row + .row{border-top:1px dotted #808080}
.row-main b{font:400 18px 'Do Hyeon'}
.day-bg::after{content:'';position:absolute;left:-40px;right:-40px;bottom:-60px;height:280px;border-radius:50% 50% 0 0;background:repeating-linear-gradient(80deg,rgba(0,0,0,.04) 0 3px,transparent 3px 8px),#6fcf6b}
.scr-day .status{color:#fff}
.dtitle{font:64px 'VT323';color:#fff;text-shadow:3px 3px 0 #1a6ab8,0 0 22px rgba(255,255,255,.9);top:92px;letter-spacing:.12em}
.ddate{top:150px;font:20px 'VT323';color:#fff;letter-spacing:.2em}
.drawing{transform:scale(.78);transform-origin:0 0;left:46px;top:238px}
.ping path{stroke:#1a1a2e;stroke-width:1}
.dtext{font:22px 'VT323';color:#1a1a2e;background:#ffe45c;padding:2px 10px;box-shadow:3px 3px 0 rgba(26,26,46,.4);top:648px;left:30px;transform:rotate(-3deg)}
.drail .share{background:#ffe45c}
.day-step{color:#fff}
`,
    dayText: '어디선가 본 것 같은 하루...',
    deco: {
      mapBack: [D(-30, 470, cloud(160, 0.8, 1)), D(230, 160, cloud(120, 0.7, 1))],
      map: [D(22, 692, win95('', 70, 64, '<div style="height:36px;background:linear-gradient(#6ec3ff,#bfe6ff);margin:2px;position:relative"><i style="position:absolute;left:8px;top:8px;width:30px;height:12px;border-radius:999px;background:#fff"></i></div>'))],
      route: [D(24, 214, `<div style="width:46px;height:70px;background:#fff8d8;border:3px solid #8a6a3a;box-shadow:4px 4px 0 rgba(26,26,46,.2);position:relative"><i style="position:absolute;right:6px;top:34px;width:5px;height:5px;border-radius:50%;background:#8a6a3a"></i></div>`), D(282, 226, star('#ffe45c', 28), 'filter:drop-shadow(0 0 6px #fff)')],
      dayBack: [
        D(-20, 190, cloud(150, 0.95, 0)), D(240, 610, cloud(150, 0.95, 0)), D(220, 196, cloud(90, 0.8, 0)),
        D(34, 222, win95('TODAY.BMP', 262, 330, '<div style="position:absolute;left:8px;right:8px;top:28px;bottom:8px;background:linear-gradient(#4aa8f5,#bfe6ff);box-shadow:inset 2px 2px 0 #404040,inset -2px -2px 0 #fff"></div>', 'position:relative')),
        D(268, 568, `<div style="width:54px;height:84px;background:#fff8d8;border:3px solid #8a6a3a;box-shadow:4px 4px 0 rgba(26,26,46,.2);position:relative;transform:perspective(200px) rotateY(-14deg)"><i style="position:absolute;right:6px;top:40px;width:6px;height:6px;border-radius:50%;background:#8a6a3a"></i></div>`),
      ],
      day: [D(30, 108, star('#ffe45c', 26), 'filter:drop-shadow(0 0 6px #fff)'), D(270, 168, star('#fff', 16)), D(40, 604, '<div style="font-size:30px">🌻</div>', 'left:296px;top:680px'), D(150, 692, '<div style="font-size:26px">🌻</div>')],
    },
  },
];
