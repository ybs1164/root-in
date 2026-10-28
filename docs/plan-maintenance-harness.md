# 계획: 유지보수 하네스와 개선 사항

> 2026-10-23 작성. 작업 번호 MH0, MH1 … — 한 번에 하나씩, 끝나면 이 문서에 진행을 적는다.
> 목표: CLAUDE.md에 글로 적힌 규칙을 **기계가 지키게** 하고, 큰 파일을 고칠 때 깨진 것을 사람이 폰으로 찾기 전에 잡는다.

## 지금 상태 (2026-10-23 잰 값)

| 항목 | 값 | 문제 |
|---|---|---|
| `npm run check` | **2분 48초** (vitest 111초 — 그중 transform 89초·collect 203초·prepare 245초 누적) | 작업마다 돌리라는 규칙인데 너무 느려서 건너뛰고 싶어짐 |
| 테스트 | 84파일 · 597개 통과 · todo 4개 | 대부분 `domain/`·`services/` 순수 함수 |
| 컴포넌트 테스트 | 컴포넌트 43개 중 **0개** (vitest 환경이 `node`뿐) | 화면 동작은 `npm run shots`로 눈으로만 확인 |
| `src/App.tsx` | **1,954줄**, React 훅 호출 약 126개 | 오버레이·뒤로가기·전환 상태가 한 파일에 몰림 |
| `src/styles.css` | **8,705줄** 한 파일 | 안 쓰는 클래스를 찾을 길이 없음 |
| `CLAUDE.md` | **112KB** (줄 하나가 수천 자) | 세션마다 통째로 읽힘 — 컨텍스트를 크게 먹고, 옛 설명(달력 탭·테스트 브랜치)과 새 설명이 섞임 |
| CI | **없음** (`.github/workflows` 없음) | `main`에 깨진 빌드가 들어가도 모름 |
| 린트 | 없음 (ESLint·Prettier 없음) | 훅 의존성 빠짐(`exhaustive-deps`)을 못 잡음 |
| 에이전트 안내 | `.github/copilot-instructions.md`는 옛 내용("token-free MapLibre"), `AGENTS.md`는 스티커 선호만 | 다른 도구가 틀린 안내를 읽음 |

지금 지켜지고 있는 것 (테스트로 굳힐 대상): 컴포넌트 밖에서 `kakao.maps`·`maplibregl`·`fetch`를 부르는 곳 없음, 색은 `:root` 토큰만(`styles.test.ts`), 탈퇴는 `goodroot:` 접두사 키를 전부 지움(`settingsRepository`).

> **바로 정리할 것**: 지금 브랜치 `claude/map-data-hosting`에 카테고리 구독 작업(파일 18개)이 커밋 안 된 채 있다. 하네스 작업을 시작하기 전에 그 작업을 자기 브랜치로 옮겨 커밋해 둘 것.

---

## 1단계 — 안전망 (먼저, 작고 효과 큼)

### MH1. CI (GitHub Actions)
- `.github/workflows/check.yml`: PR·`main` 푸시마다 `npm ci` → `tsc -b` → `vitest run` → `vite build`. **키 없이** 돈다(CLAUDE.md 규칙 — 키 없이도 dev·테스트가 돌아야 함 — 을 CI가 증명).
- 빌드 결과 크기(`dist/assets/*.js` gzip 합)를 요약에 찍어 둠 — 번들이 갑자기 커지면 보임.
- **끝**: 일부러 타입 오류를 낸 PR이 빨간불.

### MH2. `check` 빠르게 (목표 60초 이하)
- 먼저 `tsc -b`와 `vitest run`을 따로 잼. collect·prepare가 큰 건 파일마다 큰 모듈(지도 데이터 도메인, `clipper-lib`, `posthog-js`)을 다시 불러오기 때문일 가능성 — `--reporter=verbose`로 느린 파일 상위 10개를 찾음.
- 후보: `pool: 'threads'`, 순수 함수 테스트 묶음에 `isolate: false`, 무거운 import를 테스트에서 가짜로, `setup.ts`가 하는 일 줄이기.
- 작업 중에 쓸 빠른 명령 `npm run check:changed` = `tsc -b` + `vitest related --run <바뀐 파일>`. 끝내기 전엔 여전히 전체 `check`.
- **끝**: 전체 `check` 시간을 이 문서에 전·후로 적음.

### MH3. 아키텍처 규칙 테스트 (`src/test/architecture.test.ts`)
`styles.test.ts`처럼 소스를 글자로 읽어 검사 — 새 의존성 없이.
- `kakao.maps`·`maplibregl`은 `src/map/`에서만.
- `fetch(`는 `src/services/`(와 `lib/`의 SDK 로더)에서만.
- `posthog`는 `services/analytics.ts`에서만, 컴포넌트는 `analytics.track()`만.
- Supabase 클라이언트(`supabase.from`·`.rpc`)는 `services/`에서만.
- service_role·REST API 키 같은 이름이 `src/`에 없음.
- **끝**: 규칙마다 일부러 어긴 줄을 넣으면 실패하는 걸 한 번 확인.

### MH4. 저장소 키 목록 하나로 (`services/storageKeys.ts`)
- 지금 `goodroot:*:vN` 키가 15개 파일에 흩어져 있다(16종, 옛 버전 포함). 키를 한 곳에 모으고, 각 키에 "지금 쓰는 버전 / 옛 버전(마이그레이션만 읽음) / 아무도 안 읽음"을 적음.
- 테스트: 소스 안의 `'goodroot:` 글자는 이 파일에만 있음; 버전이 오른 키는 옛 키를 읽는 마이그레이션 테스트가 있음.
- 덤: 아무도 안 읽는 옛 키(`decor:v1/v2`, `wishlist:v1` 등)를 앱 시작 때 지우는 정리 한 줄 — 사용자 폰의 쓰레기 값 제거.

### MH5. 옛 링크가 계속 열리는지 (링크 표본)
- `src/test/fixtures/links/`에 형식마다 **실제로 만들어졌던 링크**를 버전별로 저장(`#share=` 각 버전, `#s=`, `#c=`, `#g=`, `#pins=`, `#diary=`). 새 형식이 생기면 표본 하나 추가가 규칙.
- 테스트: 모든 표본이 디코드되고 결과 모양이 같음(스냅숏). `#pins=`·`#diary=`는 "지금은 화면 없음" 예외로 표시 — `docs/todo.md`를 구현하면 그 표시를 지움.
- 같은 디코더에 망가진 입력(잘린 토큰, 아주 긴 문자열, 범위 밖 좌표, 이상한 유니코드) 수백 개를 던져 **절대 throw 안 하고** 거부만 하는지(간단한 손수 만든 퍼저, 시드 고정).

### MH6. 분석 이벤트에 개인 정보 없음
- 테스트: `EventProps`의 모든 속성 이름이 금지 목록(`lat`, `lng`, `address`, `name`, `memo`, `nickname` …)에 안 걸림, `docs/analytics.md` 표의 이벤트 이름과 `EventProps` 키가 서로 같음.
- 개발 빌드에서 `track()`이 문자열 값 길이·좌표처럼 보이는 숫자를 경고.

---

## 2단계 — 안내 문서 다이어트 (MH7은 1단계와 병행 가능)

### MH7. CLAUDE.md 쪼개기
- CLAUDE.md에는 **규칙·명령·구조·문서 색인만**(목표 10KB 이하). 화면별 상세 설명은 `docs/spec/`로 옮김: `map.md`(지도·핀·카테고리), `routes.md`(경로 폴더·만들기·수정·보기), `today.md`(TODAY·핑·달력), `decor.md`(꾸미기·스티커·공유 카드), `we-now.md`, `profile-settings.md`, `share-links.md`, `motion.md`(공용 연출 `stop-drop`·`settle`·`pop-in` …).
- 옮기면서 옛 설명을 지움: 달력 탭·달력 페이지 설명(테스트 브랜치가 #37로 합쳐졌으니 지금 앱 기준으로), "테스트 버전" 표시, 날짜별 변경 이력(필요하면 git 기록).
- CLAUDE.md에 "이 화면을 고치면 `docs/spec/<파일>`도 고친다" 한 줄.
- `.github/copilot-instructions.md`·`AGENTS.md`는 CLAUDE.md를 가리키는 짧은 안내로 바꾸고, 스티커 선호는 `docs/sticker-assets.md`로.
- **끝**: 내용이 사라진 게 없는지 옛 CLAUDE.md의 고유 식별자(컴포넌트·클래스·키 이름)가 새 문서 어딘가에 다 있는지 스크립트로 확인.

---

## 3단계 — 화면 회귀 하네스 (큰 리팩터링 전에 필요)

### MH8. 결정적 실행 모드
- `?harness` (개발 서버에서만): 시각 고정(TODAY 날짜), 위치 고정(가짜 `useMyLocation`), 애니메이션 끄기(`prefers-reduced-motion` + 연출 시간 0), 카카오 대신 MapLibre + 로컬 데이터, 분석·동기화 꺼짐, 표본 데이터 주입(지금 `ui-shots.mjs`가 하는 것을 앱 쪽 한 곳으로).
- `ui-shots`도 이 모드를 씀 → 찍을 때마다 같은 그림.

### MH9. 스크린숏 비교 (`npm run shots:diff`)
- 기준 이미지를 `ui-shots/baseline/`(커밋 안 함, 로컬) 또는 별도 저장소에 두고, 새로 찍은 것과 픽셀 비교(작은 차이 허용) → 바뀐 화면만 HTML 한 장에 전·후·차이로.
- 일부러 바꾼 화면은 `shots:accept`로 기준 교체.
- 지도 타일 부분은 가리고 비교(데이터가 바뀌면 흔들림).

### MH10. 핵심 흐름 E2E (Playwright, 이미 의존성에 있음)
키 없이 개발 서버 + `?harness`로, 화면 폭 375px:
1. 지도 길게 누르기 → 새 핀 카드 → ✓ → 핀이 생기고 새로고침 뒤에도 있음
2. 경로 창 → 핀 셋을 끌어 이어 루트 만들기 → 생성 → 목록에 있음 → 수정 모드에서 정류장 빼기
3. 받은 루트 링크(`#share=` 표본) 열기 → 루트 추가 → 수정 모드
4. TODAY: 근처 핀 후보 핑 추가 → 핑 삭제 확인 팝업
5. 꾸미기: 스티커 붙이기 → 되돌리기, 날짜 화면 꾸밈이 새로고침 뒤에도 있음
6. 폰 뒤로가기 순서(`useBackButton`의 겹 순서)대로 한 겹씩 닫힘
- CI(MH1)에서 돌림. 한 흐름이 30초를 넘으면 쪼갬.

### MH11. 컴포넌트 단위 테스트 자리 (선택)
- 파일 단위로 `// @vitest-environment happy-dom`을 쓸 수 있게 `happy-dom` + `@testing-library/react` 추가. 상태가 복잡한 것부터: `useBackdropTap`, `usePageSwipe`의 넘어감 판정, `CategoryManager` 끌어 옮기기, `PlacePickDialog`.
- 순수 함수로 뺄 수 있는 판정은 먼저 `domain/`으로 빼는 게 우선 (지금 방식 유지).

---

## 4단계 — 구조 개선 (3단계 하네스가 있은 뒤)

### MH12. App.tsx 나누기
- 기능별 훅으로 한 번에 하나씩(PR 하나에 하나): `useRouteView`(경로 보기·`<` `>`·도착 연출 `landedRoute`), `useRouteBuild/Edit`, `usePinCard`, `useTodayOverlay`(`todayOpen`·`pingRemove`), `useGroupView`(`groupFitted`), `useSettingsOverlay`.
- 뒤로가기 목록을 "등록식"으로: 오버레이가 스스로 `useBackLayer(order, close)`를 부르게 — 새 오버레이를 만들 때 App 목록에 넣는 걸 잊는 일을 없앰(CLAUDE.md의 주의 사항이 사라짐).
- **끝**: App.tsx 800줄 이하, 매 단계 MH10 E2E 통과.

### MH13. styles.css 나누기 + 안 쓰는 CSS
- `src/styles/` 아래 화면별 파일(`tokens.css`, `map.css`, `routes.css`, `today.css`, `decor.css`, `dialogs.css`, `motion.css` …), `styles.css`는 import 목록만. `styles.test.ts`는 모든 파일을 읽게.
- 스크립트: CSS 클래스 중 `src/**/*.tsx`·`*.ts`에 글자로 안 나오는 것 목록(동적으로 만든 클래스는 허용 목록) → 확인 후 지움.

### MH14. 죽은 코드 찾기
- `knip`(또는 `ts-prune`)으로 안 쓰는 파일·export. 후보: 옛 `TravelRoute`/`useTravelRoutes`(m1 todo "legacy TravelRoute UI … removed"), 화면 없는 `diary*`(단 `docs/todo.md`가 다시 쓸 것은 남김 — 목록에 이유 적기).
- 남은 `it.todo` 4개는 지금도 의미 있는지 정리(카카오 공유 템플릿 2개는 기능이 없어졌으면 지움).

### MH15. 동기화 저장소 짝 맞추기 검사
- CLAUDE.md 규칙 "동기화되는 저장소를 바꾸면 `syncCollections.ts` 행 변환과 `syncBus.localWrote`도 맞출 것"을 테스트로: 동기화 대상 저장소마다 (저장 → 행 변환 → 되돌린 값이 같음) 왕복 테스트 + 저장 함수가 `localWrote`를 부르는지.

---

## 5단계 — 운영 관측·배포

### MH16. 오류 보고
- `window.onerror`·`unhandledrejection` → PostHog 예외 이벤트(메시지·스택·화면 이름만, 좌표·이름 없음 — MH6 규칙 적용). 키가 없으면 아무것도 안 함.
- 설정 → 약관 및 정책 아래에 빌드 정보(버전·커밋 짧은 해시·빌드 날짜, `vite define`) — 버그 신고 때 어떤 빌드인지.

### MH17. 서버(Supabase) 검사
- 마이그레이션 파일 이름이 날짜순·겹치지 않음(테스트).
- 가능하면 CI에서 `supabase start`(Docker)로 마이그레이션을 처음부터 적용 + RLS 확인 SQL 몇 개(남의 행을 못 읽음, `my_groups`가 주소를 안 보냄). 무거우면 주 1회 예약 실행.
- 클라이언트의 RPC 응답 검증(`readGroups` 등)이 서버 함수마다 있는지 목록화.

### MH18. 지도 데이터 호스팅 확인
- 예약 실행(주 1회): `VITE_MAP_DATA_URL`의 `files.json`을 받아 표본 파일 몇 개가 열리고 크기·해시가 맞는지. 깨지면 이슈.

### MH19. 의존성·안드로이드
- Dependabot(주 1회, 묶어서) — CI가 있으니 안전하게 올릴 수 있음.
- 안드로이드 디버그 APK 빌드를 `main`에서만 CI로(선택, JDK·Gradle 캐시).

### MH20. Claude Code 작업 하네스 (선택)
- `.claude/settings.json` 훅: `.env.local` 편집·`service_role` 글자 쓰기 막기, 파일 편집 뒤 그 파일의 관련 테스트만 빠르게(`check:changed`) — 느리면 끔.
- 자주 쓰는 확인 명령을 프로젝트 스킬로: "화면 바꿈 → shots:diff → E2E" 순서.

---

## 순서 제안

1. 커밋 안 된 카테고리 구독 작업 정리 (위 '바로 정리할 것')
2. **MH1 → MH2 → MH3 → MH4 → MH5** (1주 안쪽, 하나하나 작음)
3. **MH7** (문서만 — 언제든, 앞당길수록 매 세션이 가벼워짐)
4. **MH8 → MH10 → MH9**
5. **MH12 → MH13 → MH14**, 사이사이 MH6·MH15
6. 5단계는 배포를 넓히기 전에

## 진행

- **MH1 (2026-10-23)**: `.github/workflows/check.yml` — PR·`main` 푸시·수동 실행, Node 22, `npm ci` → `tsc -b` → `vitest run` → `vite build` → 실행 요약에 파일별 gzip 크기. 커밋 `2ff6292`을 `.env.local` 없는 깨끗한 checkout에서 같은 순서로 돌려 통과 확인(Windows; tsc 통과, 테스트 80파일 579개 + todo 4, 빌드 1분 17초). 빌드 경고: `index` 720KB(gzip 234KB)·`maplibreCourseMap` 1,059KB(gzip 287KB)가 500KB 넘음 — 나중에 코드 분할 후보. 아직 GitHub에서 실제로 돈 적은 없음(리눅스 대소문자 구분은 첫 실행에서 확인), 'MH1 끝' 조건(일부러 깨진 PR이 빨간불)도 그때.
