import { describe, expect, it } from 'vitest';

// Every localStorage key the app has ever written, in one list
// (docs/plan-maintenance-harness.md MH4). The keys stay as constants next to
// their repositories; this test makes sure a new or bumped key is added here
// on purpose, with its migration tested.
type KeyInfo =
  | { status: 'current'; what: string }
  /** Read once to migrate into `into`, then removed. */
  | { status: 'legacy'; what: string; into: string }
  /** Nothing reads it any more; old values may still sit on users' phones. */
  | { status: 'unused'; what: string };

const KEYS: Record<string, KeyInfo> = {
  'goodroot:courses:v2': { status: 'current', what: '저장한 루트 (Course[])' },
  'goodroot:days:v1': { status: 'current', what: '날짜 화면 꾸밈·핑 모양' },
  'goodroot:diaries:v1': { status: 'current', what: '하루 기록 — 화면은 없지만 docs/todo.md에서 다시 씀' },
  'goodroot:group-seen:v1': { status: 'current', what: '그룹을 마지막으로 본 때 (새 핑 배지)' },
  'goodroot:opened-shares:v1': { status: 'current', what: '이 브라우저에서 연 짧은 링크 (한 번만 셈)' },
  'goodroot:pin-categories:v2': { status: 'current', what: '핀 카테고리' },
  'goodroot:kind-categories:v1': { status: 'current', what: '장소 종류 카테고리를 이 기기에 넣었는지' },
  'goodroot:pings:v1': { status: 'current', what: 'TODAY 핑' },
  'goodroot:pins:v1': { status: 'current', what: '핀' },
  'goodroot:privacy:v1': { status: 'current', what: '제외 주소' },
  'goodroot:profile:v1': { status: 'current', what: '프로필 (사진·아이디·알림·화면 모드)' },
  'goodroot:route-folders:v1': { status: 'current', what: '루트 폴더·배정·순서' },
  'goodroot:settings:v1': { status: 'current', what: '설정' },
  'goodroot:sync:v1': { status: 'current', what: '서버 동기화 표시' },
  'goodroot:location:v1': { status: 'current', what: '내 위치 켜짐 여부' },
  'goodroot:category-subs:v1': { status: 'current', what: '구독한 카테고리' },
  'goodroot:gallery-stars:v1': { status: 'current', what: '갤러리 즐겨찾기 (이 폰에만)' },
  'goodroot:group-order:v1': { status: 'current', what: 'We Now 그룹 순서' },
  'goodroot:visited-pins:v1': { status: 'current', what: '미분류 핀으로 만든 핑(가본 장소, 이 폰에만)' },
  'goodroot:member-seen:v1': { status: 'current', what: '그룹원을 마지막으로 본 때 (얼굴 배지)' },
  'goodroot:photo-comments:v1': { status: 'current', what: 'TODAY 사진 댓글 (이 폰에만)' },
  'goodroot:ping-photos:v1': { status: 'current', what: 'TODAY 핑 사진 (이 폰에만)' },
  'goodroot:anonymous-user-id': { status: 'current', what: '이 기기의 익명 사용자 id (버전 없는 옛 키)' },
  'goodroot:share-display-name': { status: 'current', what: '공유할 때 이름 (버전 없는 옛 키)' },
  'goodroot:analytics-debug': { status: 'current', what: '개발 중 분석 이벤트 콘솔 출력 스위치' },

  'goodroot:pin-categories:v1': { status: 'legacy', what: '세부 카테고리가 있던 카테고리', into: 'goodroot:pin-categories:v2' },
  'goodroot:travel-routes:v1': { status: 'legacy', what: '옛 TravelRoute', into: 'goodroot:courses:v2' },

  'goodroot:courses:v1': { status: 'unused', what: 'git 기록 이전 — v2부터 시작해 읽는 코드 없음' },
  'goodroot:decor:v1': { status: 'unused', what: '꾸미기 화면 카드 꾸밈 (2026-10-05부터 저장 안 함)' },
  'goodroot:decor:v2': { status: 'unused', what: '꾸미기 화면 카드 꾸밈 (2026-10-05부터 저장 안 함)' },
  'goodroot:wishlist:v1': { status: 'unused', what: '위시리스트 (2026-10-05 코드째 없앰)' },
};

/** Keys that predate the `goodroot:<name>:vN` rule. Don't add to this list. */
const UNVERSIONED = ['goodroot:anonymous-user-id', 'goodroot:share-display-name', 'goodroot:analytics-debug'];

const KEY_LITERAL = /['"`](goodroot:[a-z0-9-]+(?::v\d+)?)['"`]/g;

const read = (files: Record<string, string>) =>
  Object.entries(files).map(([path, text]) => ({
    path,
    keys: [...text.matchAll(KEY_LITERAL)].map((m) => m[1]),
  }));

const app = read(
  import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../test/**'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
);
const tests = read(
  import.meta.glob<string>(['../**/*.test.{ts,tsx}', '!./storageKeys.test.ts'], { query: '?raw', import: 'default', eager: true }),
);
const usedInApp = new Set(app.flatMap((f) => f.keys));
const usedInTests = new Set(tests.flatMap((f) => f.keys));

describe('localStorage keys (CLAUDE.md: goodroot:<name>:vN)', () => {
  it('finds the keys in the source', () => {
    expect(usedInApp.size).toBeGreaterThan(10);
  });

  it('every key the app uses is listed here', () => {
    expect([...usedInApp].filter((k) => !KEYS[k])).toEqual([]);
  });

  it('current and legacy keys are still read by the app; unused ones are not', () => {
    for (const [key, info] of Object.entries(KEYS)) {
      expect(usedInApp.has(key), `${key} (${info.status})`).toBe(info.status !== 'unused');
    }
  });

  it('new keys carry a version', () => {
    const unversioned = Object.keys(KEYS).filter((k) => !/:v\d+$/.test(k));
    expect(unversioned.sort()).toEqual([...UNVERSIONED].sort());
  });

  it('every legacy key has a migration test and migrates into a current key', () => {
    for (const [key, info] of Object.entries(KEYS)) {
      if (info.status !== 'legacy') continue;
      expect(usedInTests.has(key), `test that reads ${key}`).toBe(true);
      expect(KEYS[info.into]?.status, `${key} → ${info.into}`).toBe('current');
    }
  });

  it('a bumped key keeps its older version listed (so its migration is not forgotten)', () => {
    for (const key of Object.keys(KEYS)) {
      const m = /^(.*):v(\d+)$/.exec(key);
      if (!m) continue;
      for (let v = 1; v < Number(m[2]); v++) expect(KEYS[`${m[1]}:v${v}`], `${m[1]}:v${v}`).toBeDefined();
    }
  });
});
