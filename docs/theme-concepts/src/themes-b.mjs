// Themes 2–9: Y2K · 카세트 · MP3 플레이어 · 다이어리 · 폴라로이드 · 영화관 · 영화필름 · 카페
import { D, star, spark, heart, rot } from './helpers.mjs';

const reel = (s, ring = '#1f1c1a', hub = '#ece1c9') => `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="${hub}" stroke="${ring}" stroke-width="3"/><circle cx="20" cy="20" r="7" fill="${ring}"/>${[0, 60, 120, 180, 240, 300].map((a) => `<rect x="19" y="4" width="2" height="7" fill="${ring}" transform="rotate(${a} 20 20)"/>`).join('')}<circle cx="20" cy="20" r="3" fill="${hub}"/></svg>`;

export const THEMES_B = [
  // 2 ─────────────────────────────────────────────── Y2K
  {
    id: 'y2k', name: 'Y2K', en: 'MILLENNIUM',
    desc: '2000년대 초반의 디지털 미래주의',
    feel: '크롬 버튼, 반투명 패널, 별·하트·버블 장식. 옛날 MP3 프로그램이나 미니홈피를 미래적으로 만든 느낌',
    swatches: [['실버', '#c3ccd6'], ['스카이블루', '#5ab8f5'], ['핑크', '#ff8fcf']],
    fonts: ['Audiowide', 'Sunflower:wght@500;700'],
    vars: {
      bg: '#eaf2fb', surface: 'rgba(255,255,255,.6)', 'surface-2': 'rgba(214,228,246,.85)', text: '#2c3a5a', muted: '#7584a3', line: 'rgba(255,255,255,.95)',
      accent: '#4fb3f6', a2: '#ff8fcf', bw: '1.5px',
      shadow: '0 8px 24px rgba(80,120,180,.3)', 'shadow-sm': '0 4px 12px rgba(80,120,180,.28)',
      'font-ui': "'Sunflower', sans-serif", 'font-title': "'Audiowide', 'Sunflower', sans-serif", 'font-label': "'Audiowide', sans-serif",
      'map-land': '#e3ecf7', 'map-block': '#dde7f5', 'map-road': '#f8fbff', 'map-major': '#fbd0ea', 'map-water': '#a9dbf8', 'map-park': '#d3f1e2', 'map-label': '#7f8fb0',
      p1: '#ff7cc4', p2: '#4fb3f6', p3: '#8fd9b6', p4: '#b49cff', 'pin-bw': '2px', 'pin-border': '#fff', 'pin-shadow': '0 0 0 1px #9aa6b4, 0 3px 8px rgba(80,120,180,.4)',
      route: '#ff7cc4', 'route-w': '5', 'title-color': '#5a6c90', 'tray-bg': 'rgba(255,255,255,.6)', 'tab-off': 'rgba(220,232,246,.75)', step: '#9fb2cf',
      'day-bg': 'linear-gradient(165deg,#dcefff 0%,#f4e8ff 50%,#ffe3f3 100%)', dline: '#9aa6b4', 'dline-dash': '1 7', 'dline-w': '4',
      board: 'linear-gradient(135deg,#dfeefc,#f8e6f4)', 'board-ink': '#2c3a5a',
    },
    css: `
.rb,.tab,.fab,.profile,.card-ic{background:linear-gradient(180deg,#fff 0%,#e9eef4 42%,#b7c2cf 50%,#e3e9f0 100%);border:1.5px solid #9aa6b4;box-shadow:0 4px 10px rgba(60,90,140,.3),inset 0 1px 0 #fff;color:#4a5a7a}
.rb.on,.tab.big,.drail .share{background:linear-gradient(180deg,#d8f0ff 0%,#6cc2f8 46%,#2f8fd6 52%,#8fd8ff 100%);border-color:#2f7fc0;color:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.8),0 6px 18px rgba(47,143,214,.5)}
.rb.all.on2{background:linear-gradient(180deg,#ffe3f3 0%,#ff9fd4 46%,#f06bb6 52%,#ffc4e6 100%);border-color:#d95aa0;color:#fff}
.search,.card,.tray{backdrop-filter:blur(16px) saturate(1.5);-webkit-backdrop-filter:blur(16px) saturate(1.5)}
.card{border:1.5px solid #fff;box-shadow:0 0 0 2px rgba(255,143,207,.55),0 10px 30px rgba(80,120,180,.3)}
.card-name{font-weight:700}
.stop{background:linear-gradient(180deg,#ffd6ee,#ff7cc4 50%,#e85aa8 52%,#ffb3dd);border:2px solid #fff;box-shadow:0 0 0 1px #d95aa0,0 0 12px rgba(255,124,196,.7)}
.rlines line{filter:drop-shadow(0 0 4px rgba(255,124,196,.8))}
.rt-name{background:linear-gradient(180deg,#fff 0%,#dfe6ef 40%,#7a8aa3 52%,#e9eef5 100%);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:1px #6e7f9a;filter:drop-shadow(0 3px 0 rgba(255,143,207,.9))}
.dtitle{font-size:50px;background:linear-gradient(180deg,#fff 0%,#dfe6ef 40%,#6e7f95 50%,#e2e9f2 100%);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:1.5px #6e7f9a;filter:drop-shadow(0 4px 0 #ff8fcf) drop-shadow(0 0 14px rgba(255,255,255,.9))}
.ddate{color:#7584a3}
.day-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px) 0 0/100% 22px,linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px) 0 0/22px 100%}
.ping{filter:drop-shadow(0 0 6px rgba(255,255,255,.9)) drop-shadow(0 2px 4px rgba(80,120,180,.4))}
.dtext{font-family:'Sunflower';font-weight:700;font-size:20px;color:#fff;background:linear-gradient(90deg,#ff9fd4,#8fd0ff);padding:8px 16px;border-radius:999px;box-shadow:0 0 0 2px #fff,0 6px 16px rgba(255,143,207,.5);transform:rotate(-4deg)}
.ftab.on{background:rgba(255,255,255,.75)}
`,
    deco: {
      map: [D(30, 718, spark('#ff8fcf', 24)), D(316, 690, `<div style="width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#fff 0 18%,rgba(173,220,255,.5) 40%,rgba(255,255,255,.15) 70%);border:1px solid rgba(255,255,255,.9)"></div>`)],
      route: [D(52, 210, spark('#5ab8f5', 18)), D(292, 262, heart('#ff8fcf', 20)), D(30, 290, `<div style="width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#fff 0 16%,rgba(173,220,255,.55) 40%,rgba(255,255,255,.1) 72%);border:1px solid #fff"></div>`)],
      dayBack: [
        D(-40, 180, `<div style="width:140px;height:140px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#fff 0 12%,rgba(173,220,255,.6) 40%,rgba(255,255,255,.08) 72%);border:1.5px solid rgba(255,255,255,.95)"></div>`),
        D(230, 560, `<div style="width:90px;height:90px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#fff 0 12%,rgba(255,180,225,.6) 40%,rgba(255,255,255,.08) 72%);border:1.5px solid rgba(255,255,255,.95)"></div>`),
      ],
      day: [
        D(34, 98, spark('#5ab8f5', 26)), D(270, 170, spark('#ff8fcf', 18)), D(44, 196, heart('#ff8fcf', 18)),
        D(26, 676, `<div style="font:12px 'Audiowide';color:#5a6c90;background:rgba(255,255,255,.7);border:1px solid #fff;border-radius:6px;padding:4px 8px;box-shadow:0 2px 6px rgba(80,120,180,.25)">★ my root ★ visitor 0275</div>`),
        D(250, 238, star('#ffd84d', 26), 'filter:drop-shadow(0 0 6px #fff)'),
      ],
    },
    boardDeco: `<div style="position:absolute;right:120px;top:20px;opacity:.6">${spark('#fff', 80)}</div><div style="position:absolute;right:300px;top:110px;opacity:.7">${spark('#ff8fcf', 30)}</div>`,
  },

  // 3 ─────────────────────────────────────────────── 카세트
  {
    id: 'cassette', name: '카세트', en: 'CASSETTE TAPE',
    desc: '카세트테이프와 워크맨 중심의 아날로그 음악 감성',
    feel: '카세트 창, PLAY/STOP 버튼, 테이프 릴을 UI 요소로 활용. 물리 버튼을 누르는 듯한 인터페이스',
    swatches: [['오렌지', '#ee6a26'], ['베이지', '#e9dcc0'], ['블랙', '#1f1c1a']],
    fonts: ['Bebas+Neue', 'Do+Hyeon', 'Gaegu:wght@700'],
    routeIcon: '📼',
    vars: {
      bg: '#ece1c9', surface: '#f6eedc', 'surface-2': '#e3d5b6', text: '#1f1c1a', muted: '#7b6d5a', line: '#1f1c1a',
      accent: '#ee6a26', bw: '2px', 'r-card': '8px', 'r-pill': '10px', 'r-btn': '12px',
      shadow: '0 4px 0 #1f1c1a', 'shadow-sm': '0 3px 0 #1f1c1a', 'pin-shadow': '0 2px 0 #1f1c1a',
      'font-ui': "'Do Hyeon', sans-serif", 'font-title': "'Bebas Neue', 'Do Hyeon', sans-serif", 'font-label': "'Bebas Neue', sans-serif", 'font-hand': "'Gaegu', cursive",
      'map-land': '#e8dcc0', 'map-block': '#e2d4b3', 'map-road': '#f4ecd9', 'map-major': '#e9a073', 'map-water': '#a8b8b2', 'map-park': '#c4c49a', 'map-label': '#6b5d4a',
      p1: '#ee6a26', p2: '#1f1c1a', p3: '#7d8a4a', p4: '#c0392b', 'pin-bw': '2px', 'pin-border': '#f6eedc', 'pin-r': '8px',
      'stop-bg': '#1f1c1a', route: '#1f1c1a', 'route-w': '3.5', 'route-dash': '10 6', 'title-color': '#1f1c1a', 'tab-off': '#d9c9a5', step: '#9a8a70',
      board: '#ddd0b3', 'board-ink': '#1f1c1a', dline: '#ee6a26', 'dline-w': '3',
    },
    css: `
.search{background:#f6eedc;position:relative;overflow:hidden;padding-left:24px}
.search::before{content:'';position:absolute;left:0;top:0;bottom:0;width:10px;background:linear-gradient(90deg,#ee6a26 0 5px,#c24f16 5px 10px)}
.rb{box-shadow:0 3px 0 #1f1c1a}
.rb.on{background:#ee6a26;transform:translateY(3px);box-shadow:0 0 0 #1f1c1a}
.rb.all.on2{background:#1f1c1a;color:#ece1c9}
.bottom{left:50%;right:auto;transform:translateX(-50%);gap:6px;bottom:26px;background:#1f1c1a;padding:7px 7px 11px;border-radius:12px;box-shadow:0 8px 20px rgba(0,0,0,.3)}
.tab,.tab.big{width:82px;height:56px;border-radius:6px;border:0;background:linear-gradient(#4a4540,#2a2622);color:#ece1c9;box-shadow:0 5px 0 #000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font:15px/1 'Bebas Neue';letter-spacing:.1em}
.tab::after{content:attr(data-l)}
.tab .ic,.tab.big .ic{width:19px;height:19px}
.tab.big{background:linear-gradient(#f47c3c,#de5a18);transform:translateY(4px);box-shadow:0 1px 0 #6a2606;color:#fff}
.fab{border-radius:12px;width:56px;height:56px;bottom:30px;background:#f6eedc}
.card{background:linear-gradient(#ee6a26 0 6px,#c24f16 6px 10px,#f6eedc 10px);padding-top:20px}
.card::before{content:'SIDE A';position:absolute;right:12px;top:15px;font:13px 'Bebas Neue';letter-spacing:.12em;color:#ee6a26}
.card-sub{background:repeating-linear-gradient(transparent 0 19px,rgba(31,28,26,.18) 19px 20px);line-height:20px}
.card-name{font:400 27px 'Nanum Pen Script'}
.rt-name{font-size:48px;letter-spacing:.04em}
.rt-icon{font-size:30px}
.tray{background:linear-gradient(#ee6a26 0 8px,#c24f16 8px 14px,#f6eedc 14px);padding-top:22px}
.ftab{border-radius:6px 6px 0 0}
.row-main b{font:400 25px 'Nanum Pen Script'}
.dtitle{font-size:64px;top:96px;letter-spacing:.08em}
.ddate{top:158px;font:16px 'Bebas Neue';letter-spacing:.3em}
.drawing{transform:scale(.76);transform-origin:0 0;left:52px;top:256px}
.dtext{font:400 28px 'Nanum Pen Script';top:226px;left:48px;transform:rotate(-1deg);color:#1f1c1a}
.day-step{top:430px}
`,
    deco: {
      map: [D(22, 686, `<div style="font:13px 'Bebas Neue';letter-spacing:.14em;color:#1f1c1a;background:#f6eedc;border:2px solid #1f1c1a;border-radius:6px;padding:3px 8px">◀◀ REW · 1:24 · FF ▶▶</div>`)],
      dayBack: [
        D(22, 192, `<div style="width:276px;height:456px;border-radius:18px;background:#2a2623;box-shadow:0 10px 24px rgba(0,0,0,.3),inset 0 0 0 2px #4a4540"></div>`),
        D(34, 202, `<div style="width:252px;height:330px;border-radius:8px;background:linear-gradient(#f6eedc 0 270px,#ee6a26 270px 290px,#c24f16 290px 310px,#f6eedc 310px);"></div>`),
        D(38, 202, `<div style="font:13px 'Bebas Neue';letter-spacing:.2em;color:#ee6a26;margin-top:8px;margin-left:8px">SIDE A · TODAY MIX · 90 MIN</div>`),
        D(70, 544, `<div style="width:182px;height:70px;border-radius:30px;background:#ece1c9;border:3px solid #4a4540;display:flex;align-items:center;justify-content:space-around;padding:0 8px">${reel(50, '#1f1c1a', '#f6eedc')}<div style="width:40px;height:22px;background:#6b4a33;border-radius:4px"></div>${reel(50, '#1f1c1a', '#f6eedc')}</div>`),
        D(48, 626, `<div style="width:224px;height:12px;display:flex;justify-content:space-between">${'<i style="width:8px;height:8px;border-radius:50%;background:#4a4540;display:block"></i>'.repeat(5)}</div>`),
      ],
    },
  },

  // 4 ─────────────────────────────────────────────── MP3 플레이어
  {
    id: 'mp3', name: 'MP3 플레이어', en: 'DIGITAL PLAYER',
    desc: '2000년대 휴대용 디지털 음악기기',
    feel: '작은 LCD 화면, 원형 컨트롤러, 픽셀 폰트. 메뉴가 기기 내부 화면처럼 구성되는 UI',
    swatches: [['실버', '#c9d0d8'], ['블루', '#2f6fd6'], ['라임', '#b9e04a']],
    fonts: ['Silkscreen', 'VT323', 'Nanum+Gothic+Coding:wght@400;700'],
    routeIcon: '♪',
    vars: {
      bg: '#cfd5dc', surface: '#d4ec9a', 'surface-2': '#c3e07f', text: '#22381a', muted: '#4c6a36', line: '#22381a',
      accent: '#2f6fd6', a2: '#b9e04a', bw: '2px', 'r-card': '4px', 'r-pill': '4px', 'r-btn': '6px',
      shadow: 'none', 'shadow-sm': 'none', 'pin-shadow': 'none',
      'font-ui': "'Nanum Gothic Coding', monospace", 'font-title': "'Silkscreen', 'Nanum Gothic Coding', monospace", 'font-label': "'Silkscreen', monospace",
      'map-land': '#bcdc86', 'map-block': '#afd377', 'map-road': '#d4ec9a', 'map-major': '#8db75c', 'map-major-w': '7', 'map-water': '#88b062', 'map-park': '#9cc66a', 'map-label': '#2e4a1e',
      p1: '#22381a', p2: '#22381a', p3: '#22381a', p4: '#22381a', 'pin-r': '3px', 'pin-bw': '2px', 'pin-border': '#22381a',
      'stop-bg': '#22381a', 'stop-fg': '#d4ec9a', route: '#22381a', 'route-w': '3', 'route-dash': '4 4', 'title-color': '#22381a', 'tray-bg': '#d4ec9a', 'tab-off': '#b5d47a', step: '#22381a',
      'btn-bg': '#d4ec9a', 'btn-fg': '#22381a', 'status-ink': '#3b4654', board: '#b9c3ce', 'board-ink': '#1d2a3a', dline: '#22381a', 'dline-dash': '4 4', 'ping-hole': '#d4ec9a',
    },
    css: `
.scr{background:repeating-linear-gradient(90deg,#d7dce2 0 1px,#cbd1d8 1px 3px)}
.status{font-family:'Silkscreen';font-size:13px}
.scr-map .map,.scr-map .map-overlay{inset:44px 12px 210px 12px;border-radius:14px;overflow:hidden}
.scr-route .map,.scr-route .map-overlay{inset:44px 12px 12px 12px;border-radius:14px;overflow:hidden}
.map{box-shadow:inset 0 0 0 5px #6b7480}
.map-overlay{box-shadow:inset 0 0 0 5px #6b7480,inset 0 0 30px rgba(0,0,0,.25);background:linear-gradient(rgba(34,56,26,.07) 1px,transparent 1px) 0 0/3px 3px,linear-gradient(90deg,rgba(34,56,26,.07) 1px,transparent 1px) 0 0/3px 3px}
.top{top:56px;left:26px;right:26px}
.search{height:40px;border-width:2px;color:#22381a;font-family:'Silkscreen';font-size:13px;background:#d4ec9a}
.search span::after{content:'_';animation:none}
.profile{width:40px;height:40px;border-radius:6px;background:#d4ec9a;color:#22381a}
.rail{right:28px;top:108px;gap:6px}
.rb{width:38px;height:38px;font-size:16px;filter:grayscale(1) contrast(1.4)}
.rb.on,.rb.all.on2{background:#22381a;color:#d4ec9a;filter:none}
.rb.all{font-size:9px}
.pin{width:20px;height:20px;margin:-10px 0 0 -10px}
.pin span{display:none}
.pin:nth-child(6){display:none}
.pin.sel{width:26px;height:26px;margin:-13px 0 0 -13px;background:#2f6fd6;border-color:#22381a}
.card{background:#d4ec9a;border-width:2px;font-family:'Nanum Gothic Coding'}
.card::before{content:'▶ NOW PLAYING';display:block;font:9px 'Silkscreen';background:#22381a;color:#d4ec9a;margin:-12px -14px 8px;padding:4px 10px}
.card-ic{filter:grayscale(1) contrast(1.3);border:2px solid #22381a;border-radius:4px;background:#c3e07f}
.card-name{font:700 17px 'Nanum Gothic Coding'}
.bottom{left:50%;right:auto;transform:translateX(-50%);width:176px;height:176px;border-radius:50%;bottom:16px;background:radial-gradient(circle at 50% 50%,transparent 0 37px,#e9edf1 38px),conic-gradient(from 0deg,#f4f6f8,#c4cad1,#f4f6f8,#c4cad1,#f4f6f8);box-shadow:inset 0 2px 3px #fff,inset 0 -3px 6px rgba(0,0,0,.18),0 6px 14px rgba(0,0,0,.2);justify-content:center}
.bottom::before{content:'MENU';position:absolute;top:13px;left:0;right:0;text-align:center;font:10px 'Silkscreen';color:#5b6878}
.bottom::after{content:'▶❚❚';position:absolute;bottom:12px;left:0;right:0;text-align:center;font:13px 'Silkscreen';color:#5b6878;letter-spacing:-.1em}
.tab:not(.big){position:absolute;left:10px;top:50%;margin-top:-22px;width:44px;height:44px;background:none;box-shadow:none;border:0;color:#5b6878}
.tab.big{width:72px;height:72px;border:0;background:radial-gradient(circle at 40% 35%,#6fa2f2,#2f6fd6 60%,#1d4fa6);box-shadow:inset 0 2px 2px rgba(255,255,255,.6),0 2px 6px rgba(0,0,0,.3);color:#fff}
.fab{right:auto;left:calc(50% + 34px);bottom:79px;width:44px;height:44px;background:none;box-shadow:none;border:0;color:#5b6878}
.stop{border-radius:3px;width:26px;height:26px;margin:-13px 0 0 -13px;font:10px 'Silkscreen'}
.rtitle{top:204px}
.rt-icon{font:26px 'Silkscreen'}
.rt-name{font:700 32px 'Nanum Gothic Coding';background:#d4ec9a;padding:2px 10px;border:2px solid #22381a}
.step{color:#22381a}
.tray{left:12px;right:12px;bottom:12px;height:196px;border-radius:0 0 14px 14px;border:5px solid #6b7480;border-top:2px solid #22381a;box-shadow:none;font-family:'Nanum Gothic Coding'}
.ftabs{left:6px;top:-36px}
.ftab{height:34px;width:46px;border:2px solid #22381a;border-bottom:0;border-radius:4px 4px 0 0;filter:grayscale(1) contrast(1.3);background:#b5d47a}
.ftab.on{height:36px;background:#d4ec9a;filter:none}
.tray-tools{color:#22381a}
.row.on{background:#22381a;color:#d4ec9a;border-radius:2px}
.row.on small,.row.on .row-btns{color:#b5d47a}
.row-ic{font-family:'Silkscreen'}
.row-main b{font-weight:700;font-size:16px}
.day-bg{background:repeating-linear-gradient(90deg,#d7dce2 0 1px,#cbd1d8 1px 3px)}
.day-profile{width:40px;height:40px;border-radius:6px;background:#d4ec9a;color:#22381a}
.drail{gap:6px}
.drail .rb{filter:none}
.drail .share{background:#2f6fd6;color:#fff;border-color:#1d4fa6}
.dtitle{top:122px;left:24px;right:84px;font:32px 'Silkscreen';color:#22381a}
.ddate{top:166px;left:24px;right:84px;font:11px 'Silkscreen';color:#4c6a36;letter-spacing:.06em}
.drawing{transform:scale(.82);transform-origin:0 0;left:36px;top:206px}
.ping{filter:none}
.ping path{stroke:#22381a;stroke-width:1.5}
.dtext{font:700 15px 'Nanum Gothic Coding';color:#22381a;top:532px;left:36px;transform:none}
.day-step{left:22px;top:380px;color:#22381a}
`,
    deco: {
      map: [D(22, 560, `<div style="font:10px 'Silkscreen';color:#22381a;display:flex;gap:6px;align-items:center;width:330px"><span>02:14</span><div style="flex:1;height:8px;border:2px solid #22381a;background:linear-gradient(90deg,#22381a 55%,transparent 55%)"></div><span>04:05</span></div>`, 'z-index:21'),
        D(20, 612, `<div style="width:335px;text-align:center;font:9px 'Silkscreen';letter-spacing:.3em;color:#7b8794">ROOT·IN 2GB</div>`)],
      dayBack: [
        D(14, 100, `<div style="width:290px;height:466px;border-radius:14px;background:#d4ec9a;box-shadow:inset 0 0 0 5px #6b7480,inset 0 0 30px rgba(0,0,0,.2)"></div>`),
        D(14, 100, `<div style="width:290px;height:466px;border-radius:14px;background:linear-gradient(rgba(34,56,26,.07) 1px,transparent 1px) 0 0/3px 3px,linear-gradient(90deg,rgba(34,56,26,.07) 1px,transparent 1px) 0 0/3px 3px"></div>`),
        D(24, 110, `<div style="width:270px;display:flex;justify-content:space-between;font:9px 'Silkscreen';color:#22381a;border-bottom:2px solid #22381a;padding-bottom:3px"><span>▶ DIARY</span><span>■■■□ 10/03</span></div>`),
        D(24, 532, `<div style="width:270px;height:22px"></div>`),
        D(30, 566, `<div style="font:9px 'Silkscreen';letter-spacing:.3em;color:#7b8794">ROOT·IN 2GB</div>`, 'top:572px;left:110px'),
      ],
    },
  },

  // 5 ─────────────────────────────────────────────── 다이어리
  {
    id: 'diary', name: '다이어리', en: 'DIARY',
    desc: '개인 수첩을 꾸민 듯한 아날로그 감성',
    feel: '종이 배경 위에 포스트잇, 마스킹테이프, 스티커, 손글씨. 화면 자체가 한 페이지처럼 보이는 UI',
    swatches: [['베이지', '#efe3cc'], ['핑크', '#f0a3b2'], ['세이지', '#9db59a']],
    fonts: ['Gaegu:wght@400;700', 'Hi+Melody'],
    cats: ['☕', '🍝', '🌿', '🎀'], folders: ['🌷', '🧸', '📮'], routeIcon: '🌷',
    vars: {
      bg: '#f7f0e3', surface: '#fffdf7', 'surface-2': '#f7e2e4', text: '#4a3f3a', muted: '#9a8b80', line: 'rgba(74,63,58,.18)',
      accent: '#ee9aab', a2: '#9db59a', bw: '1px', 'r-card': '4px',
      shadow: '0 6px 14px rgba(74,63,58,.15)', 'shadow-sm': '0 2px 6px rgba(74,63,58,.12)',
      'font-ui': "'Gaegu', cursive", 'font-title': "'Nanum Pen Script', cursive", 'font-label': "'Gaegu', cursive",
      'map-land': '#f3ead9', 'map-block': '#efe4cf', 'map-road': '#fbf6ec', 'map-major': '#f6d3d9', 'map-water': '#cfe0df', 'map-park': '#d8e4cd', 'map-label': '#a08f84',
      p1: '#ee9aab', p2: '#9db59a', p3: '#e8b77a', p4: '#a9b8dc', 'pin-bw': '2px', 'pin-border': '#fffdf7',
      route: '#ee9aab', 'route-dash': '2 7', 'route-w': '4', 'title-color': '#4a3f3a', 'tab-off': '#f1dfd9', step: '#c9b3a8',
      board: '#ede2cf', 'board-ink': '#4a3f3a', dline: '#9a8b80', 'dline-dash': '1 6', 'dline-w': '3',
    },
    css: `
.map-overlay{background:radial-gradient(rgba(74,63,58,.18) 1px,transparent 1.3px) 0 0/16px 16px}
.search{position:relative;border-radius:6px;font-size:18px}
.search::before,.search::after{content:'';position:absolute;top:-8px;width:44px;height:18px;background:rgba(238,154,171,.6);transform:rotate(-8deg)}
.search::before{left:-10px}.search::after{right:-10px;transform:rotate(9deg);background:rgba(157,181,154,.65)}
.rb,.tab,.fab,.profile{border:1.5px dashed #c9b3a8}
.rb.on,.tab.big{border:2px dashed rgba(255,255,255,.85);box-shadow:0 0 0 3px #ee9aab,var(--shadow-sm)}
.rb.all.on2{background:#9db59a;border-color:rgba(255,255,255,.8);box-shadow:0 0 0 3px #9db59a}
.card{background:#fde3e8;border:0;transform:translate(-50%,-100%) rotate(-2deg);box-shadow:2px 8px 14px rgba(74,63,58,.18);border-radius:2px}
.card::after{display:none}
.card::before{content:'';position:absolute;left:50%;top:-10px;width:70px;height:20px;margin-left:-35px;background:rgba(157,181,154,.7);transform:rotate(3deg);background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.35) 0 4px,transparent 4px 8px)}
.card-ic{background:#fffdf7}
.card-name{font:700 22px 'Gaegu'}
.card-sub{font-size:15px}
.stop{font-family:'Gaegu';font-size:16px}
.rt-name{font-size:52px;font-weight:400;background:linear-gradient(transparent 58%,rgba(238,154,171,.5) 58% 88%,transparent 88%)}
.tray{background:repeating-linear-gradient(#fffdf7 0 31px,#e7d8cf 31px 32px);background-position:0 12px}
.ftab:nth-child(1){background:#f3d4d9}.ftab:nth-child(2){background:#d9e4d3}.ftab:nth-child(4){background:#efe0c4}.ftab:nth-child(5){background:#dfe0ef}
.ftab.on{background:#fffdf7}
.row-main b{font-size:21px}
.row-main small{font-size:15px}
.day-bg{background:radial-gradient(rgba(74,63,58,.18) 1px,transparent 1.3px) 0 0/18px 18px,#fbf5ea}
.dtitle{font-size:70px;font-weight:400;top:88px}
.dtitle span{background:linear-gradient(transparent 60%,rgba(238,154,171,.55) 60% 90%,transparent 90%);padding:0 6px}
.ddate{top:160px;font:700 16px 'Gaegu';letter-spacing:.06em}
.dtext{font-size:32px;top:624px;left:50px}
.drail .rb{border-style:dashed}
`,
    dayTitle: '<span>Today</span>',
    dayDate: '10월 3일 토요일 · 맑음 ☀',
    dayText: '성수에서 하루 종일 🌷',
    deco: {
      map: [D(24, 690, `<div style="width:92px;height:22px;background:rgba(238,154,171,.6);${rot(-6)}background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.4) 0 5px,transparent 5px 10px)"></div>`)],
      route: [D(42, 214, '<div style="font-size:30px;transform:rotate(-14deg)">🎀</div>')],
      dayBack: [
        D(8, 70, `<div style="display:flex;flex-direction:column;gap:46px">${'<i style="display:block;width:14px;height:14px;border-radius:50%;background:#e6d7c6;box-shadow:inset 0 2px 2px rgba(0,0,0,.18)"></i>'.repeat(13)}</div>`),
      ],
      day: [
        D(36, 230, `<div style="width:112px;height:100px;background:#fff6b8;box-shadow:1px 5px 10px rgba(74,63,58,.18);${rot(-5)}font:700 17px/1.25 'Gaegu';color:#6a5a50;padding:12px">오늘의 루트 4곳 ✔</div>`),
        D(64, 222, `<div style="width:54px;height:16px;background:rgba(157,181,154,.7);${rot(4)}"></div>`),
        D(240, 560, '<div style="font-size:42px;transform:rotate(12deg);filter:drop-shadow(0 0 0 #fff) drop-shadow(2px 0 #fff) drop-shadow(-2px 0 #fff) drop-shadow(0 2px #fff) drop-shadow(0 -2px #fff) drop-shadow(0 3px 3px rgba(0,0,0,.2))">🧸</div>'),
        D(250, 196, '<div style="font-size:28px;filter:drop-shadow(2px 0 #fff) drop-shadow(-2px 0 #fff) drop-shadow(0 2px #fff) drop-shadow(0 -2px #fff)">🌷</div>'),
      ],
    },
  },

  // 6 ─────────────────────────────────────────────── 폴라로이드
  {
    id: 'polaroid', name: '폴라로이드', en: 'POLAROID',
    desc: '즉석사진과 추억 기록 중심',
    feel: '콘텐츠가 폴라로이드 사진 카드로 표현됨. 날짜나 짧은 메모를 손글씨처럼 배치',
    swatches: [['화이트', '#fbfbf9'], ['레드', '#e2433b'], ['스카이블루', '#69b7e6']],
    fonts: ['Gowun+Dodum'],
    routeIcon: '📷',
    vars: {
      bg: '#f6f5f2', surface: '#ffffff', 'surface-2': '#f1f0ec', text: '#2b2b2b', muted: '#8c8c8c', line: 'rgba(0,0,0,.07)',
      accent: '#e2433b', a2: '#69b7e6', 'r-card': '3px', shadow: '0 8px 22px rgba(0,0,0,.16)',
      'font-ui': "'Gowun Dodum', sans-serif", 'font-title': "'Nanum Pen Script', cursive",
      'map-land': '#eef0ec', 'map-block': '#e6e8e3', 'map-road': '#ffffff', 'map-major': '#f3d7c9', 'map-water': '#b8dcf2', 'map-park': '#d3e8c9',
      p1: '#e2433b', p2: '#69b7e6', p3: '#f2b134', p4: '#5fae6a', 'pin-bw': '3px', 'pin-border': '#fff',
      route: '#e2433b', 'title-color': '#2b2b2b', step: '#c4c4c0',
      board: '#ecebe6', 'board-ink': '#2b2b2b', dline: '#e2433b', 'dline-w': '2.5',
    },
    card: ({ ic }) => `<div class="pol-photo"><span>☕</span></div><div class="pol-cap"><b>어니언 성수</b>${ic('pen', 'card-pen')}</div><div class="card-row card-row2">${ic('more')}<span class="pol-date">10.03 brunch</span>${ic('trash')}</div>`,
    css: `
.map{filter:saturate(.9) contrast(.97)}
.card{width:224px;padding:12px 12px 8px;border:0;transform:translate(-50%,-100%) rotate(-3deg);box-shadow:0 10px 26px rgba(0,0,0,.22)}
.card::after{display:none}
.pol-photo{height:132px;background:linear-gradient(180deg,#9fd3f2 0%,#cfe8f7 55%,#f3d9b9 56%,#e8c49b 100%);display:grid;place-items:center;font-size:60px;position:relative;overflow:hidden}
.pol-photo::after{content:'';position:absolute;inset:0;background:radial-gradient(circle at 75% 25%,rgba(255,255,255,.7),transparent 35%),linear-gradient(transparent,rgba(0,0,0,.08))}
.pol-cap{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:10px;font:400 30px 'Nanum Pen Script'}
.pol-cap b{font-weight:400}
.pol-date{font:400 20px 'Nanum Pen Script';color:#e2433b}
.card-row2{margin-top:0}
.rb.on,.tab.big{box-shadow:0 0 0 3px #fff,0 4px 12px rgba(226,67,59,.4)}
.rb.all.on2{background:#69b7e6}
.stop{border:3px solid #fff}
.rt-name{font-size:56px;font-weight:400}
.row-ic{width:44px;height:50px;background:#fff;padding:4px 4px 12px;box-shadow:0 2px 6px rgba(0,0,0,.2);transform:rotate(-4deg);font-size:20px;display:grid;place-items:center}
.row-ic::before{content:'';position:absolute}
.row + .row .row-ic{transform:rotate(3deg)}
.row-main b{font-size:17px}
.tray{border-top:0}
.ftab:nth-child(1){box-shadow:inset 0 3px 0 #e2433b}.ftab:nth-child(2){box-shadow:inset 0 3px 0 #f2b134}.ftab:nth-child(3){box-shadow:inset 0 3px 0 #69b7e6}.ftab:nth-child(4){box-shadow:inset 0 3px 0 #5fae6a}.ftab:nth-child(5){box-shadow:inset 0 3px 0 #e2433b}
.dtitle{font-size:66px;font-weight:400;top:82px}
.ddate{top:146px}
.drawing{transform:scale(.8);transform-origin:0 0;left:52px;top:224px}
.dtext{font-size:34px;top:560px;left:56px;transform:rotate(-3deg)}
`,
    dayText: '10.03 성수에서 하루 종일 ♥',
    deco: {
      dayBack: [
        D(256, 560, `<div style="width:84px;height:100px;background:#fff;padding:6px 6px 22px;box-shadow:0 6px 14px rgba(0,0,0,.18);${rot(14)}"><div style="height:100%;background:linear-gradient(#f6c9a8,#e2433b)"></div></div>`),
        D(26, 200, `<div style="width:276px;height:420px;background:#fff;box-shadow:0 14px 30px rgba(0,0,0,.18);${rot(-3)}padding:14px 14px 80px"><div style="height:100%;background:linear-gradient(180deg,#eaf5fc,#f7fbfd)"></div></div>`),
        D(130, 182, '<div style="width:80px;height:24px;background:rgba(105,183,230,.45);transform:rotate(-6deg)"></div>', 'z-index:9'),
      ],
      day: [
        D(118, 170, `<div style="display:flex;gap:0;height:6px;width:140px">${['#e2433b', '#f28a2b', '#f2c12e', '#5fae6a', '#69b7e6'].map((c) => `<i style="flex:1;background:${c}"></i>`).join('')}</div>`, 'top:178px'),
      ],
      route: [
        D(26, 214, `<div style="width:64px;height:76px;background:#fff;padding:5px 5px 18px;box-shadow:0 4px 10px rgba(0,0,0,.2);${rot(-10)}"><div style="height:100%;background:linear-gradient(#9fd3f2,#f3d9b9)"></div></div>`),
      ],
    },
  },

  // 7 ─────────────────────────────────────────────── 영화관
  {
    id: 'cinema', name: '영화관', en: 'CINEMA',
    desc: '극장·티켓·상영관에서 가져온 디자인',
    feel: '영화표 모양 카드, 어두운 배경, 조명 효과. 버튼이나 탭이 티켓·상영시간표처럼 표현됨',
    swatches: [['버건디', '#7a1a2a'], ['골드', '#d4af37'], ['블랙', '#140b0d']],
    fonts: ['Limelight', 'Nanum+Myeongjo:wght@700;800', 'Playfair+Display:wght@700;900'],
    cats: ['🍿', '🍷', '🌳', '🎟️'], folders: ['🎬', '🌙', '🍿'], routeIcon: '🎬',
    vars: {
      bg: '#140b0d', surface: '#22141a', 'surface-2': '#3a1c25', text: '#f4e6c8', muted: '#b29a86', line: 'rgba(212,175,55,.55)',
      accent: '#7a1a2a', 'on-accent': '#f4d77a', a2: '#d4af37', bw: '1.5px', 'r-card': '6px',
      shadow: '0 10px 30px rgba(0,0,0,.6)', 'shadow-sm': '0 4px 12px rgba(0,0,0,.5)',
      'font-ui': "'Nanum Myeongjo', serif", 'font-title': "'Limelight', 'Nanum Myeongjo', serif", 'font-label': "'Playfair Display', serif",
      'map-land': '#1c1214', 'map-block': '#24161a', 'map-road': '#3a272b', 'map-major': '#5c3b27', 'map-water': '#101b25', 'map-park': '#1d2519', 'map-label': '#8a6f5c',
      p1: '#d4af37', p2: '#b8304a', p3: '#e8d9b0', p4: '#9b6b2f', 'pin-shadow': '0 0 10px rgba(212,175,55,.7)',
      route: '#d4af37', 'route-w': '3', 'stop-bg': '#7a1a2a', 'stop-fg': '#f4d77a', 'title-color': '#d4af37', 'tab-off': '#2a1419', step: '#6a5048',
      'status-ink': '#f4e6c8', 'day-bg': 'radial-gradient(ellipse at 50% 40%,#3a1620 0%,#140b0d 70%)', dline: '#d4af37', 'dline-w': '2', 'ping-hole': '#140b0d',
      board: '#1a0f12', 'board-ink': '#f4e6c8',
    },
    card: ({ ic }) => `<div class="tk"><div class="tk-stub"><span>ADMIT<br>ONE</span></div><div class="tk-main"><small>NOW SHOWING · CAFÉ</small><b>어니언 성수</b><span>SCREEN 1 · 10.03 SAT · 11:00</span><div class="tk-acts">${ic('more')}${ic('pen')}${ic('trash')}</div></div></div>`,
    css: `
.map-overlay{background:radial-gradient(ellipse 60% 40% at 50% 52%,rgba(255,214,140,.14),transparent 70%),radial-gradient(ellipse at 50% 120%,rgba(122,26,42,.35),transparent 60%)}
.rb,.tab,.fab,.profile,.search{border-color:rgba(212,175,55,.6)}
.rb.on,.tab.big,.drail .share{background:radial-gradient(circle at 50% 35%,#a12a3d,#5e1220);border:1.5px solid #d4af37;box-shadow:0 0 0 3px rgba(212,175,55,.25),0 0 18px rgba(212,175,55,.45)}
.rb.all.on2{background:#d4af37;color:#22141a}
.pin{border:1.5px solid rgba(255,255,255,.4)}
.card{width:268px;background:transparent;border:0;box-shadow:none;padding:0;filter:drop-shadow(0 10px 18px rgba(0,0,0,.7))}
.card::after{display:none}
.tk{display:flex;color:#3a0f18;background:radial-gradient(circle at 0 50%,transparent 9px,#f4e6c8 9.5px) left/51% 100% no-repeat,radial-gradient(circle at 100% 50%,transparent 9px,#f4e6c8 9.5px) right/51% 100% no-repeat;border-radius:6px}
.tk-stub{width:58px;border-right:2px dashed #b8304a;display:grid;place-items:center;background:#7a1a2a;color:#f4d77a;border-radius:6px 0 0 6px;font:900 11px/1.2 'Playfair Display';letter-spacing:.12em;text-align:center;margin:0}
.tk-stub span{transform:rotate(-90deg);white-space:nowrap}
.tk-main{flex:1;padding:12px 16px 10px 18px;display:flex;flex-direction:column;gap:3px}
.tk-main small{font:700 9.5px 'Playfair Display';letter-spacing:.18em;color:#b8304a}
.tk-main b{font:800 21px 'Nanum Myeongjo'}
.tk-main span{font:700 10.5px 'Playfair Display';letter-spacing:.08em;color:#7a5a4a}
.tk-acts{display:flex;justify-content:flex-end;gap:14px;color:#7a5a4a;margin-top:2px}
.tk-acts .ic{width:17px;height:17px}
.stop{border:1.5px solid #d4af37;box-shadow:0 0 12px rgba(212,175,55,.6);font-family:'Playfair Display'}
.rlines line{filter:drop-shadow(0 0 4px rgba(212,175,55,.7))}
.rtitle{top:200px}
.rt-name{font-size:40px;padding:12px 22px;background:#22141a;border:2px solid #d4af37;text-shadow:0 0 12px rgba(212,175,55,.6);box-shadow:0 0 0 6px #22141a,0 0 0 8px rgba(212,175,55,.5),0 0 30px rgba(212,175,55,.25)}
.rt-name::before{content:'';position:absolute;inset:-9px;background:radial-gradient(circle,#ffe9a8 0 2.5px,transparent 3px) 0 0/14px 14px;-webkit-mask:linear-gradient(#000,#000) content-box exclude,linear-gradient(#000,#000);mask:linear-gradient(#000,#000) content-box exclude,linear-gradient(#000,#000);padding:4px;filter:drop-shadow(0 0 3px #ffd36b)}
.rt-pen{right:-36px}
.rt-icon{margin-bottom:22px}
.tray{background:#1f1216;border-top:1.5px solid rgba(212,175,55,.5)}
.ftab{border-color:rgba(212,175,55,.45)}
.ftab.on{background:#1f1216;color:#d4af37}
.row-main b{font-weight:800}
.row-f{font:700 11px 'Playfair Display';color:#22141a;background:#d4af37;padding:5px 7px;border-radius:3px;font-size:11px}
.row-f::before{content:'11:00 '}
.row + .row .row-f::before{content:'21:30 '}
.dtitle{font-size:50px;top:112px;text-shadow:0 0 18px rgba(212,175,55,.6)}
.ddate{top:172px;color:#b29a86;font-family:'Playfair Display'}
.drawing{transform:scale(.78);transform-origin:0 0;left:46px;top:240px}
.ping{filter:drop-shadow(0 0 6px rgba(212,175,55,.7))}
.dtext{font:800 18px 'Nanum Myeongjo';color:#f4e6c8;top:566px;left:44px;transform:none;letter-spacing:.02em}
.dtext::before{content:'오늘의 상영작 · ';color:#d4af37}
.day-step{color:#6a5048}
`,
    dayText: '성수에서 하루 종일',
    deco: {
      map: [D(18, 704, `<div style="font:700 10px 'Playfair Display';letter-spacing:.24em;color:#d4af37;border:1px solid rgba(212,175,55,.6);padding:5px 9px;background:rgba(20,11,13,.75)">★ SEONGSU CINEMA ★</div>`)],
      dayBack: [
        D(0, 0, `<div style="width:375px;height:74px;background:repeating-linear-gradient(90deg,#5e1220 0 14px,#7a1a2a 14px 22px,#4a0e1a 22px 30px);border-radius:0 0 50% 50%/0 0 26px 26px;box-shadow:0 6px 16px rgba(0,0,0,.6)"></div>`),
        D(-24, 40, '<div style="width:58px;height:760px;background:repeating-linear-gradient(90deg,#5e1220 0 10px,#7a1a2a 10px 16px,#4a0e1a 16px 22px);border-radius:0 0 40px 0;box-shadow:6px 0 16px rgba(0,0,0,.6)"></div>'),
        D(340, 40, '<div style="width:58px;height:760px;background:repeating-linear-gradient(90deg,#4a0e1a 0 6px,#7a1a2a 6px 14px,#5e1220 14px 22px);border-radius:0 0 0 40px;box-shadow:-6px 0 16px rgba(0,0,0,.6)"></div>'),
        D(40, 222, '<div style="width:250px;height:320px;background:radial-gradient(ellipse at 50% 40%,rgba(244,230,200,.12),rgba(244,230,200,.03) 70%);border:1px solid rgba(244,230,200,.12);box-shadow:0 0 40px rgba(244,230,200,.06)"></div>'),
        D(58, 92, `<div style="width:258px;height:92px;border-radius:8px;background:radial-gradient(circle,#ffe9a8 0 2.5px,transparent 3px) 0 0/15px 15px;-webkit-mask:linear-gradient(#000,#000) content-box exclude,linear-gradient(#000,#000);mask:linear-gradient(#000,#000) content-box exclude,linear-gradient(#000,#000);padding:6px;filter:drop-shadow(0 0 4px #ffd36b)"></div>`),
      ],
    },
  },

  // 8 ─────────────────────────────────────────────── 영화필름
  {
    id: 'film', name: '영화필름', en: 'FILM STRIP',
    desc: '아날로그 필름과 영화 제작 감성',
    feel: '필름 스트립 형태의 리스트, 프레임 단위 이미지 배치. 스크롤하면 필름이 움직이는 듯한 구성',
    swatches: [['블랙', '#111111'], ['아이보리', '#f3ecd8'], ['옐로우', '#f5c518']],
    fonts: ['Bebas+Neue', 'Courier+Prime:wght@400;700', 'Nanum+Gothic+Coding:wght@400;700'],
    folders: ['🎞️', '🌃', '🎥'], routeIcon: '🎞️',
    vars: {
      bg: '#111111', surface: '#1b1b1b', 'surface-2': '#2a2a2a', text: '#f3ecd8', muted: '#9b9584', line: 'rgba(243,236,216,.35)',
      accent: '#f5c518', 'on-accent': '#111', bw: '1.5px', 'r-card': '2px', 'r-pill': '2px', 'r-btn': '4px',
      shadow: '0 8px 20px rgba(0,0,0,.6)', 'shadow-sm': '0 3px 8px rgba(0,0,0,.5)',
      'font-ui': "'Nanum Gothic Coding', monospace", 'font-title': "'Bebas Neue', 'Nanum Gothic Coding', sans-serif", 'font-label': "'Courier Prime', monospace",
      'map-land': '#d9d4c6', 'map-block': '#cfc9b9', 'map-road': '#ece6d6', 'map-major': '#b9b19c', 'map-water': '#8f8f8a', 'map-park': '#b5b2a2', 'map-label': '#3a3832',
      p1: '#f5c518', p2: '#f3ecd8', p3: '#f5c518', p4: '#f3ecd8', 'pin-r': '3px', 'pin-bw': '2px', 'pin-border': '#111',
      'stop-bg': '#f5c518', 'stop-fg': '#111', route: '#111', 'route-w': '3', 'title-color': '#f3ecd8', 'tab-off': '#2a2a2a', step: '#f3ecd8',
      'status-ink': '#f3ecd8', 'day-bg': '#0d0d0d', dline: '#f3ecd8', 'dline-w': '2', 'ping-hole': '#111',
      board: '#151515', 'board-ink': '#f3ecd8',
    },
    css: `
.map{filter:grayscale(1) contrast(1.15) sepia(.12)}
.map-overlay{background:var(--noise),radial-gradient(ellipse at 50% 50%,transparent 55%,rgba(0,0,0,.55));opacity:.9;mix-blend-mode:multiply}
.scr-map::before,.scr-map::after,.scr-route::before,.scr-route::after,.scr-day::before,.scr-day::after{content:'';position:absolute;top:0;bottom:0;width:24px;z-index:45;background:radial-gradient(circle,transparent 0,transparent 0) ,#0b0b0b;-webkit-mask:linear-gradient(#000,#000),repeating-linear-gradient(transparent 0 9px,#000 9px 23px,transparent 23px 34px) 6px 0/12px 100% no-repeat;-webkit-mask-composite:xor;mask:linear-gradient(#000,#000) exclude,repeating-linear-gradient(transparent 0 9px,#000 9px 23px,transparent 23px 34px) 6px 0/12px 100% no-repeat}
.scr-map::before,.scr-route::before,.scr-day::before{left:0}.scr-map::after,.scr-route::after,.scr-day::after{right:0}
.status{padding:4px 40px 0 44px}
.top{left:32px;right:32px}
.rail,.drail{right:34px}
.fab{right:34px}
.step-l{left:26px}.step-r{right:26px}
.search{background:#111;color:#9b9584;font-family:'Courier Prime'}
.rb,.tab,.fab,.profile{background:#111;color:#f3ecd8}
.rb.all.on2{background:#f3ecd8;color:#111;font-family:'Courier Prime'}
.card{background:#111;border:1.5px solid #f3ecd8;padding-top:22px}
.card::after{border-color:#f3ecd8;background:#111}
.card::before{content:'▸ 24A        KODAK 400TX';white-space:pre;position:absolute;left:12px;top:7px;font:700 10px 'Courier Prime';color:#f5c518;letter-spacing:.06em}
.card-ic{background:#2a2a2a;border-radius:2px;filter:grayscale(1)}
.card-name{font-weight:700}
.pin span{filter:grayscale(1) contrast(1.4)}
.stop{font-family:'Courier Prime';font-weight:700;border:2px solid #111}
.rtitle{top:204px}
.rt-name{font-size:46px;letter-spacing:.04em;color:#111;background:#f5c518;padding:2px 12px 0;white-space:nowrap}
.rt-icon{filter:grayscale(1)}
.tray{left:24px;right:24px;background:#111;border:0;border-radius:0;box-shadow:none}
.tray::before{content:'';position:absolute;left:0;right:0;top:4px;height:6px;background:repeating-linear-gradient(90deg,#f3ecd8 0 8px,transparent 8px 18px);opacity:.85}
.ftabs{left:0}
.ftab{border-radius:0;background:#1b1b1b;border-color:#444;filter:grayscale(1)}
.ftab.on{background:#111;color:#f5c518;filter:none;border-color:#f5c518}
.tray-tools{top:18px}
.row{border:1.5px solid #f3ecd8;margin:28px 0 0;padding:10px}
.row + .row{border:1.5px solid #444;margin-top:8px;border-top:1.5px solid #444}
.row::before{content:'23';position:absolute;left:4px;top:-17px;font:700 10px 'Courier Prime';color:#f5c518}
.row + .row::before{content:'24'}
.row-ic{filter:grayscale(1)}
.row-btns{bottom:6px;right:10px}
.row.on{padding-bottom:30px}
.dtitle{font-size:72px;top:90px;letter-spacing:.12em}
.ddate{top:166px;font:700 12px 'Courier Prime';color:#f5c518}
.drawing{transform:scale(.76);transform-origin:0 0;left:62px;top:250px}
.dtext{font:700 14px 'Courier Prime';color:#f3ecd8;top:576px;left:54px;transform:none;letter-spacing:.04em}
.drail .rb{background:#111}
.drail .share{background:#f5c518;color:#111}
.day-profile{right:34px}
.day-step{left:26px}
`,
    dayText: 'SCENE 03 — 성수에서 하루 종일',
    deco: {
      dayBack: [
        D(38, 206, `<div style="width:262px;height:350px;background:#0b0b0b;border:2px solid #f3ecd8;box-shadow:inset 0 0 30px rgba(243,236,216,.08)"></div>`),
        D(38, 196, `<div style="width:262px;display:flex;justify-content:space-between;font:700 10px 'Courier Prime';color:#f5c518"><span>▸ 24</span><span>KODAK 400TX</span><span>24A</span></div>`, 'top:190px'),
        D(38, 560, `<div style="width:262px;display:flex;justify-content:space-between;font:700 10px 'Courier Prime';color:#f5c518"><span>25 ▸</span><span>ROOT·IN</span><span>25A</span></div>`),
        D(38, 608, `<div style="width:262px;height:86px;border:1.5px solid #444;display:flex;align-items:center;justify-content:center;font:700 11px 'Courier Prime';color:#555">NEXT FRAME ▸</div>`),
      ],
      map: [D(40, 700, `<div style="font:700 10px 'Courier Prime';color:#f5c518;background:#111;padding:3px 6px">▸ 12  KODAK 400TX  12A</div>`)],
    },
  },

  // 9 ─────────────────────────────────────────────── 카페
  {
    id: 'cafe', name: '카페', en: 'CAFÉ',
    desc: '따뜻하고 편안한 일상 공간',
    feel: '메뉴판 같은 카드, 둥근 버튼, 종이·우드 질감. 편안하고 정돈된 감성 앱 느낌',
    swatches: [['브라운', '#7a5236'], ['크림', '#f4ead8'], ['세이지', '#8fa98a']],
    fonts: ['Gowun+Batang:wght@400;700', 'Cormorant+Garamond:ital,wght@0,600;1,600;1,700'],
    cats: ['☕', '🥐', '🌿', '🍰'], folders: ['☕', '🌿', '📖'],
    vars: {
      bg: '#f4ead8', surface: '#fbf5ea', 'surface-2': '#ece0c9', text: '#4a3424', muted: '#8f7860', line: 'rgba(74,52,36,.22)',
      accent: '#7a5236', 'on-accent': '#fbf5ea', a2: '#8fa98a', bw: '1px', 'r-card': '14px',
      shadow: '0 8px 22px rgba(74,52,36,.18)', 'shadow-sm': '0 2px 8px rgba(74,52,36,.14)',
      'font-ui': "'Gowun Batang', serif", 'font-title': "'Cormorant Garamond', 'Gowun Batang', serif", 'font-label': "'Cormorant Garamond', serif",
      'map-land': '#efe3cd', 'map-block': '#e9dcc2', 'map-road': '#f8f0e1', 'map-major': '#dcc6a1', 'map-water': '#c3d4cf', 'map-park': '#cfd9bf', 'map-label': '#8f7860',
      p1: '#7a5236', p2: '#c08552', p3: '#8fa98a', p4: '#b56b5a', 'pin-bw': '2px', 'pin-border': '#fbf5ea',
      route: '#7a5236', 'route-dash': '1 7', 'route-w': '4', 'title-color': '#4a3424', 'tab-off': '#e6d7bb', step: '#c4ad8f',
      board: '#eadcc3', 'board-ink': '#4a3424', dline: '#7a5236', 'dline-dash': '1 6',
    },
    card: ({ ic }) => `<div class="menu-h">— Today's Pick —</div><div class="menu-line"><b>어니언 성수</b><i></i><span>☕</span></div><div class="menu-sub">Café · 성동구 아차산로9길 8</div><div class="card-row card-row2">${ic('more')}${ic('pen')}${ic('trash')}</div>`,
    css: `
.map-overlay{background:var(--noise);opacity:.18;mix-blend-mode:multiply}
.search{background:#fbf5ea}
.rb.on,.tab.big{box-shadow:0 0 0 3px #fbf5ea,0 0 0 4px rgba(122,82,54,.4),var(--shadow-sm)}
.rb.all.on2{background:#8fa98a;color:#fff}
.rb.all{font:italic 700 15px 'Cormorant Garamond'}
.bottom::before{content:'';position:absolute;left:50%;top:50%;width:210px;height:40px;margin:-6px 0 0 -105px;border-radius:20px;background:repeating-linear-gradient(90deg,#9b6b48 0 3px,#8a5d3d 3px 9px,#a5754f 9px 11px,#8f6141 11px 20px);box-shadow:0 6px 14px rgba(74,52,36,.3);z-index:-1}
.card{border:1px solid rgba(74,52,36,.35);box-shadow:0 0 0 4px #fbf5ea,0 0 0 5px rgba(74,52,36,.3),0 10px 24px rgba(74,52,36,.2);padding:12px 16px 8px}
.card::after{display:none}
.menu-h{text-align:center;font:italic 700 15px 'Cormorant Garamond';color:#8fa98a;letter-spacing:.06em;margin-bottom:6px}
.menu-line{display:flex;align-items:baseline;gap:6px}
.menu-line b{font:700 19px 'Gowun Batang'}
.menu-line i{flex:1;border-bottom:2px dotted rgba(74,52,36,.45);transform:translateY(-4px)}
.menu-sub{font:italic 600 14px 'Cormorant Garamond';color:#8f7860;margin-top:2px}
.card-row2 .ic{width:17px;height:17px}
.rt-name{font:italic 700 46px 'Cormorant Garamond';}
.rt-name{font-family:'Cormorant Garamond','Gowun Batang';font-style:normal}
.tray{background:#fbf5ea;border-top:1px solid rgba(74,52,36,.25)}
.tray::before{content:'Route Menu';position:absolute;left:18px;top:12px;font:italic 700 17px 'Cormorant Garamond';color:#8fa98a}
.row-main b{font-weight:700}
.row-main b::after{content:'';display:inline-block;width:60px;border-bottom:2px dotted rgba(74,52,36,.35);margin-left:8px;transform:translateY(-4px)}
.ftab{border-radius:14px 14px 0 0}
.day-bg::after{content:'';position:absolute;inset:0;background:var(--noise);opacity:.16;mix-blend-mode:multiply}
.dtitle{font:italic 700 60px 'Cormorant Garamond';top:96px}
.ddate{top:162px;font:italic 600 16px 'Cormorant Garamond';letter-spacing:.2em}
.drawing{transform:scale(.8);transform-origin:0 0;left:46px;top:236px}
.dtext{font:400 16px 'Gowun Batang';top:572px;left:50px;transform:none;color:#7a5236}
`,
    dayText: '오늘의 코스 · 브런치 → 산책 → 저녁',
    deco: {
      dayBack: [
        D(24, 196, `<div style="width:282px;height:420px;background:#fbf5ea;border:1px solid rgba(74,52,36,.3);box-shadow:0 0 0 6px #fbf5ea,0 0 0 7px rgba(74,52,36,.25),0 14px 30px rgba(74,52,36,.18);border-radius:6px"></div>`),
        D(110, 206, `<div style="font:italic 700 15px 'Cormorant Garamond';color:#8fa98a;letter-spacing:.1em">~ Today's Special ~</div>`),
        D(196, 560, '<div style="width:110px;height:110px;border-radius:50%;border:7px solid rgba(122,82,54,.13);filter:url(#wob2)"></div>'),
      ],
      day: [D(24, 640, '<div style="font-size:30px;transform:rotate(-20deg)">🌿</div>'), D(268, 640, '<div style="font-size:34px">☕</div>')],
      map: [D(22, 700, '<div style="font-size:26px;transform:rotate(-24deg)">🌿</div>')],
    },
  },
];
