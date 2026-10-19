// Captures the main UI states at mobile and desktop widths so UI changes can
// be reviewed without a device. Usage (dev server must be running):
//   npm run shots                 -> all states, both widths
//   npm run shots -- calendar pin  -> only states whose name contains a filter
//   npm run shots -- minimap       -> TODAY's 미니맵 on six example days
// Output: ui-shots/<width>-<state>.png (git-ignored).
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = process.env.SHOTS_URL ?? 'http://localhost:5188';
const OUT = 'ui-shots';
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
  'rail-pins': async (page) => {
    await page.getByRole('button', { name: '핀', exact: true }).click({ timeout: 3000 });
    await page.getByRole('button', { name: /^카페 / }).first().click({ timeout: 3000 });
  },
  'new-pin': async (page) => { await click(page, '지도에 핀 꽂기'); },
  'calendar': async (page) => { await click(page, '달력'); },
  'calendar-month': async (page) => { await click(page, '달력'); await page.getByRole('button', { name: /달력 보기$/ }).click(); },
  'profile': async (page) => { await click(page, '프로필'); },
  'profile-account': async (page) => { await click(page, '프로필'); await click(page, '계정·약관·정책'); },
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
      geolocation: { latitude: 37.5447, longitude: 127.0582 }, permissions: ['geolocation'] });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await seed(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await settle(page);
      const reload = async (hash) => { await page.goto(`${BASE}/${hash}`); await page.reload(); await settle(page); };
      await run(page, vpName, reload);
      await settle(page, 1200);
      const file = `${OUT}/${vpName}-${state}.png`;
      await page.screenshot({ path: file });
      console.log(`✓ ${file}${errors.length ? `  (page errors: ${errors.join(' | ')})` : ''}`);
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
