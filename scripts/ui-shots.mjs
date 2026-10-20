// Captures the main UI states at mobile and desktop widths so UI changes can
// be reviewed without a device. Usage (dev server must be running):
//   npm run shots                 -> all states, both widths
//   npm run shots -- calendar pin  -> only states whose name contains a filter
//   npm run shots -- minimap       -> TODAY's 미니맵 on six example days
//   npm run shots -- mainmap       -> the main map: 4 places × 3 scales, with drag frame timing (docs/plan-mainmap-style.md M0)
//   npm run shots -- silhouettes   -> 미니맵 outlines, before | after, filled in one colour (the silhouette test)
//   SHOTS_SCHEME=dark npm run shots -- mainmap -> the same in the phone's dark mode (…-dark.png)
// Output: ui-shots/<width>-<state>.png (git-ignored).
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = process.env.SHOTS_URL ?? 'http://localhost:5188';
const OUT = 'ui-shots';
// SHOTS_SCHEME=dark: the phone in dark mode (files get a -dark suffix).
const DARK = process.env.SHOTS_SCHEME === 'dark';
const filters = process.argv.slice(2);

const VIEWPORTS = {
  mobile: { width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  desktop: { width: 1280, height: 800, deviceScaleFactor: 1 },
};

const place = (id, name, lng, lat, category, address) => ({ id, name, center: [lng, lat], category, address });
const P = {
  onion: place('osm:N-onion', '어니언 성수', 127.0582, 37.5447, 'cafe', '서울 성동구 아차산로9길 8'),
  galbi: place('osm:N-galbi', '성수 갈비집', 127.0557, 37.5431, 'restaurant', '서울 성동구 성수이로 88'),
  forest: place('osm:W-forest', '서울숲', 127.0374, 37.5444, 'park', '서울 성동구 뚝섬로 273'),
};
const SEONGSU = {
  title: '성수 데이트 코스',
  theme: 'date',
  travelMode: 'walk',
  stops: [
    { place: P.onion, memo: '브런치 + 빵 포장' },
    { place: P.galbi, memo: '점심은 여기' },
    { place: P.forest, memo: '해 질 때 산책 🌳' },
  ],
  note: '카페에서 브런치 먹고 서울숲 산책',
  sharedBy: '지우',
  sharedAt: '2026-09-28T03:00:00.000Z',
};

// Seed storage through the app's own modules (served by Vite) so the stored
// shape always matches the current repositories.
async function seed(page) {
  await page.evaluate(async (course) => {
    const { courseRepository } = await import('/src/services/courseRepository.ts');
    const { diaryRepository } = await import('/src/services/diaryRepository.ts');
    const { getCurrentUserId } = await import('/src/lib/currentUser.ts');
    const uid = getCurrentUserId();
    await courseRepository.save(uid, course);
    await courseRepository.save(uid, { ...course, title: '을지로 노포 투어', theme: 'food', stops: course.stops.slice(0, 2), sharedBy: undefined });
    const { pinRepository } = await import('/src/services/pinRepository.ts');
    const cats = ['cafe', 'food', 'togo'];
    await pinRepository.saveAll(uid, course.stops.map((s, i) => ({
      id: `shot-pin-${i}`, userId: uid, place: s.place, categoryId: cats[i], memo: s.memo, createdAt: course.sharedAt,
    })));
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // TODAY's pings (the calendar's day screen), as if pinned on the spot.
    const { savePings } = await import('/src/services/pingRepository.ts');
    savePings(course.stops.map((s, i) => ({
      id: `shot-ping-${i}`, day: today, at: new Date(`${today}T${['10:30', '13:00', '17:40'][i]}:00`).toISOString(),
      name: s.place.name, center: s.place.center,
    })));
    await diaryRepository.save(uid, {
      date: today, title: '', travelMode: 'walk',
      stops: course.stops.map((s, i) => ({ ...s, time: ['10:30', '13:00', '17:40'][i] })),
    });
  }, SEONGSU);
}

async function shareHash(page, key) {
  return page.evaluate(async ([course, key]) => {
    if (key === 'share') {
      const { encodeSharedCourse } = await import('/src/services/courseShareService.ts');
      return `#share=${encodeSharedCourse(course).token}`;
    }
    const { encodeSharedDiary } = await import('/src/services/diaryShareService.ts');
    const diary = { date: '2026-09-27', title: '', travelMode: 'walk', sharedAt: course.sharedAt, sharedBy: course.sharedBy,
      stops: course.stops.map((s, i) => ({ ...s, time: ['10:30', '13:00', '17:40'][i] })) };
    return `#diary=${encodeSharedDiary(diary).token}`;
  }, [SEONGSU, key]);
}

// 미니맵 behind TODAY's pings (docs/plan-minimap-design.md D8): example days that
// each stress the real map differently.
const MINI_DAYS = {
  // Three spots on one street, within 200 m.
  street: [['어니언 성수', 127.0582, 37.5447], ['성수 갈비집', 127.0571, 37.5440], ['소품샵', 127.0590, 37.5436]],
  // Four in 성수 and one across the Han river.
  river: [['어니언 성수', 127.0582, 37.5447], ['성수 갈비집', 127.0557, 37.5431], ['대림창고', 127.0539, 37.5418], ['서울숲', 127.0374, 37.5444], ['압구정 로데오', 127.0396, 37.5272]],
  one: [['어니언 성수', 127.0582, 37.5447]],
  // Seoul to Busan in a day.
  far: [['서울역', 126.9707, 37.5547], ['해운대', 129.1604, 35.1587]],
  // Six along 종로, one after another.
  row: [0, 1, 2, 3, 4, 5].map((k) => [['광화문', '종각', '종로3가', '종로5가', '동대문', '신설동'][k], 126.977 + k * 0.009, 37.5705 + k * 0.0004]),
  // Two places in the same building.
  same: [['1층 카페', 127.0582, 37.5447], ['3층 서점', 127.05822, 37.54471]],
};
/** Today's pings are the day's spots (and no pins nearby, so no 후보 ghost); then the day screen. */
async function miniMapDay(page, spots, reload) {
  await page.evaluate(async (spots) => {
    const { savePings } = await import('/src/services/pingRepository.ts');
    const { pinRepository } = await import('/src/services/pinRepository.ts');
    const { getCurrentUserId } = await import('/src/lib/currentUser.ts');
    await pinRepository.saveAll(getCurrentUserId(), []);
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    savePings(spots.map(([name, lng, lat], i) => ({
      id: `mini-${i}`, day: today, at: new Date(`${today}T${String(9 + i * 2).padStart(2, '0')}:00:00`).toISOString(), name, center: [lng, lat],
    })));
  }, spots);
  await reload('');
  await click(page, '달력');
  // The pins wait for the real map (none for these stops: they land on the page alone).
  await page.locator('.pings__map').first().waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

// The main map (docs/plan-mainmap-style.md M0): places that each test the base
// map differently, at three scales (meters per CSS pixel) — 시군구, 읍면동, 블록.
const MAIN_PLACES = {
  seongsu: [127.056, 37.544],
  river: [127.04, 37.535],
  jongno: [126.99, 37.5705],
  yangpyeong: [127.4875, 37.4917],
};
const MAIN_SCALES = { gu: 40, dong: 12, block: 1.5 };

/**
 * Puts the map on `center` at `mpp` (fitting a span that wide), through the
 * dev hook in createCourseMap. The app's own first move to "my location" can
 * land after this, so it checks and fits again until the map stays put.
 */
async function mainMapAt(page, center, mpp) {
  // Let the start-up settle first. On this PC some pages come up starved: the
  // web fonts never load and the map keeps a stale, scaled frame. Those are
  // reloaded (the missing font is the sign).
  for (let tries = 0; tries < 5; tries++) {
    await page.waitForFunction(() => globalThis.__courseMap, null, { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(3000);
    // (fonts.check is also true when the font was never declared: the stylesheet itself may have failed.)
    if (await page.evaluate(() => [...document.fonts].some((f) => f.family.includes('Oswald') && f.status === 'loaded'))) break;
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  for (let tries = 0; tries < 4; tries++) {
    const stayed = await page.evaluate(async ([[lng, lat], mpp]) => {
      const half = (mpp * innerWidth) / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
      const none = { top: 0, right: 0, bottom: 0, left: 0 };
      await globalThis.__courseMap.fitPoints([[lng - half, lat], [lng + half, lat]], none, 0);
      // Areas are fetched and rounded in the worker after the move settles,
      // slowly on a busy PC: wait until the map's sources have been quiet for
      // 3 s (MapLibre; a fixed wait for Kakao).
      const engine = globalThis.__courseMap.map;
      await new Promise((done) => {
        if (!engine?.on) return setTimeout(done, 6000);
        let quiet;
        const wait = () => { clearTimeout(quiet); quiet = setTimeout(finish, 3000); };
        const finish = () => { engine.off('sourcedata', wait); done(); };
        engine.on('sourcedata', wait);
        wait();
        setTimeout(finish, 40000);
      });
      const [x, y] = globalThis.__courseMap.getCenter();
      return Math.abs(x - lng) < half / 20 && Math.abs(y - lat) < half / 20;
    }, [center, mpp]);
    if (stayed) break;
  }
  // Headless, MapLibre sometimes keeps the old frame after the areas arrive
  // with no move to follow: a resize repaints it.
  // (MapLibre only: wait for that frame to be drawn.)
  await page.evaluate(() => new Promise((done) => {
    const engine = globalThis.__courseMap.map;
    globalThis.__courseMap.resize();
    if (!engine?.once) return setTimeout(done, 500);
    // A real (1px there and back) move, then the frame after it is rendered.
    engine.panBy([1, 0], { duration: 0 });
    engine.panBy([-1, 0], { duration: 0 });
    engine.once('render', () => engine.once('idle', () => setTimeout(done, 300)));
    engine.triggerRepaint();
    setTimeout(done, 8000);
  }));
}

/**
 * Frame timing while the map is dragged for a second (4× slower CPU, like a
 * low-end phone): logged next to the shot, the M0 baseline for M8.
 */
async function panFrames(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const box = await page.locator('.map').first().boundingBox();
  const x = (box?.x ?? 0) + (box?.width ?? 375) / 2;
  const y = (box?.y ?? 0) + (box?.height ?? 812) / 2;
  const frames = page.evaluate(() => new Promise((done) => {
    const times = [];
    const tick = (t) => { times.push(t); if (t - times[0] < 1000) requestAnimationFrame(tick); else done(times); };
    requestAnimationFrame(tick);
  }));
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) await page.mouse.move(x - i * 6, y - i * 3);
  await page.mouse.up();
  const times = await frames;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const gaps = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);
  return `${gaps.length} frames/s, p95 ${Math.round(gaps[Math.floor(gaps.length * 0.95)] ?? 0)}ms`;
}

/** docs/plan-minimap-silhouette.md: every example day's outline before | after (scripts/silhouette-sheet.ts). */
async function silhouetteSheet(page) {
  await page.setViewportSize({ width: 1000, height: 1900 });
  await page.evaluate(async () => {
    const { drawSheet } = await import('/scripts/silhouette-sheet.ts');
    await drawSheet();
  });
}

const settle = (page, ms = 1500) => page.waitForTimeout(ms);
const click = (page, name) => page.getByRole('button', { name }).first().click({ timeout: 3000 });

// Each state starts from a fresh page with seeded storage.
const STATES = {
  'home': async () => {},
  'search': async (page) => {
    await page.getByRole('searchbox').or(page.locator('input[type=search], input')).first().fill('성수 카페');
    await settle(page, 3000);
  },
  'rail-route': async (page) => { await click(page, '경로'); },
  // A saved route on the map: its stops, lines (on their casings) and names.
  'route-shown': async (page) => {
    await click(page, '경로');
    await page.getByText('성수 데이트 코스').first().click({ timeout: 3000 });
    await settle(page, 4000);
  },
  'rail-pins': async (page) => {
    await page.getByRole('button', { name: '핀', exact: true }).click({ timeout: 3000 });
    await page.getByRole('button', { name: /^카페 / }).first().click({ timeout: 3000 });
  },
  'new-pin': async (page) => { await click(page, '지도에 핀 꽂기'); },
  // TODAY opens from We Now's TODAY tile (the calendar tab is gone, test build 2026-10-19).
  'calendar': async (page) => { await click(page, 'We Now'); await click(page, /^TODAY/); },
  'calendar-month': async (page) => { await click(page, 'We Now'); await click(page, /^TODAY/); await click(page, '월 달력'); },
  'profile': async (page) => { await click(page, '프로필'); },
  'profile-account': async (page) => { await click(page, '프로필'); await click(page, '설정'); await click(page, '계정 관리'); },
  'profile-edit': async (page) => {
    await click(page, '프로필');
    await click(page, '아이디 수정');
    await page.keyboard.type('My ID!');
  },
  'categories': async (page) => {
    await page.getByRole('button', { name: '핀', exact: true }).click({ timeout: 3000 });
    await click(page, '핀 카테고리 편집');
  },
  'category-form': async (page) => {
    await page.getByRole('button', { name: '핀', exact: true }).click({ timeout: 3000 });
    await click(page, '핀 카테고리 편집');
    await click(page, '카테고리 추가');
  },
  ...Object.fromEntries(Object.entries(MINI_DAYS).map(([day, spots]) => [`minimap-${day}`, (page, vp, reload) => miniMapDay(page, spots, reload)])),
  ...Object.fromEntries(Object.entries(MAIN_PLACES).flatMap(([where, center]) => Object.entries(MAIN_SCALES).map(([scale, mpp]) => [
    `mainmap-${where}-${scale}`,
    // Shot first, then the drag timing (the drag must not leave its frame in the shot).
    async (page, vp, reload, shoot) => {
      await mainMapAt(page, center, mpp);
      const at = await page.evaluate(() => globalThis.__courseMap.getCenter().map((v) => v.toFixed(4)).join(','));
      const engine = await page.evaluate(() => globalThis.__courseMap.constructor.name.replace('CourseMap', ''));
      await shoot();
      return { note: `${engine}, ${await panFrames(page)}, at ${at}`, shot: true };
    },
  ]))),
  'silhouettes': async (page) => { await silhouetteSheet(page); },
  'shared-course': async (page, vp, reload) => { await reload(await shareHash(page, 'share')); },
  'shared-diary': async (page, vp, reload) => { await reload(await shareHash(page, 'diary')); },
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const failures = [];
for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  for (const [state, run] of Object.entries(STATES)) {
    if (filters.length && !filters.some((f) => state.includes(f) || vpName.includes(f))) continue;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, ...vp, locale: 'ko-KR',
      // The main map states place the map themselves: no location, so the app never moves it to "me".
      geolocation: { latitude: 37.5447, longitude: 127.0582 }, permissions: state.startsWith('mainmap') ? [] : ['geolocation'],
      colorScheme: DARK ? 'dark' : 'light' });
    const page = await ctx.newPage();
    // The dev server can take a while to serve the first page on a busy machine.
    page.setDefaultNavigationTimeout(90000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await seed(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await settle(page);
      const reload = async (hash) => { await page.goto(`${BASE}/${hash}`); await page.reload(); await settle(page); };
      const file = `${OUT}/${vpName}-${state}${DARK ? '-dark' : ''}.png`;
      // Headless Edge sometimes hands back an old composited frame of the WebGL
      // map: a throwaway capture first makes it composite a fresh one.
      const shoot = async () => {
        await page.screenshot();
        await page.waitForTimeout(500);
        await page.screenshot({ path: file });
      };
      const result = await run(page, vpName, reload, shoot);
      const note = typeof result === 'string' ? result : result?.note;
      if (!result?.shot) {
        await settle(page, 1200);
        await shoot();
      }
      console.log(`✓ ${file}${note ? `  ${note}` : ''}${errors.length ? `  (page errors: ${errors.join(' | ')})` : ''}`);
    } catch (e) {
      failures.push(`${vpName}-${state}`);
      await page.screenshot({ path: `${OUT}/${vpName}-${state}.FAILED.png` }).catch(() => {});
      console.log(`✗ ${vpName}-${state}: ${e.message.split('\n')[0]}`);
    }
    await ctx.close();
  }
}
await browser.close();
if (failures.length) process.exitCode = 1;
