# root-in

> 앱 이름은 **root-in** (2026-09-29, 구 goodRoot). 로고는 `components/Logo.tsx` — i 글자 전체가 핀(끝이 기준선을 찍음). 저장소 키 접두사 `goodroot:`와 프리뷰 이름 `goodroot-dev`는 기존 데이터·설정 호환을 위해 그대로 둔다.

코스(데이트·여행·맛집 탐방 등 순서 있는 장소 목록)를 지도에 만들고 링크로 공유하는 **모바일 우선** 웹 앱.
React 19 + Vite 7 + TypeScript. 지도는 **카카오맵 JS SDK**(키 없으면 MapLibre로 대체). 백엔드 없음 (localStorage + URL 해시).
서비스 범위는 **국내 한정**이다 (카카오맵이 국내만 지원).

**현재 계획: [docs/plan-m0-m1.md](docs/plan-m0-m1.md)**(M1 잔여: 1.7, 1.8)과 **[docs/plan-m2-prototype.md](docs/plan-m2-prototype.md)**(핀·하단 바·일일 루트 프로토타입) — 작업 번호(0.1, 1.2, P1.3 …)로 참조한다.

## 명령
- `npm run check` — 타입체크 + 테스트. 작업을 끝냈다고 말하기 전에 반드시 통과시킬 것
- `npm test` / `npm run test:watch`
- 개발 서버: `.claude/launch.json`의 `goodroot-dev` (포트 5188) — Bash로 띄우지 말고 preview로
- UI 검증은 모바일 폭(`resize_window` preset `mobile`, 375px)을 기본으로 하고, 데스크톱 폭도 깨지지 않는지 본다

## 카카오 키
- `.env.local`에 `VITE_KAKAO_JS_KEY=<JavaScript 키>` (예시: `.env.example`). `.env.local`은 커밋하지 않는다.
- 카카오 개발자 콘솔 → 플랫폼 → Web에 `http://localhost:5188`과 배포 도메인을 등록해야 SDK가 동작한다.
- **REST API 키는 프론트에 절대 넣지 않는다.** 장소 검색은 JS SDK의 `services` 라이브러리(JS 키 + 도메인 제한)로만 한다.
- 키가 없거나 SDK 로드가 실패하면 자동으로 대체 구현(MapLibre + Photon 검색)으로 동작해야 한다. 키 없이도 `npm run dev`와 테스트가 돌아가야 한다.

## 작업 규칙
- 한 번에 계획의 작업 하나. 끝나면 `src/test/m1-acceptance.test.ts`의 해당 `it.todo`를 실제 테스트로 바꾼다.
- 지도 SDK는 `src/map/`의 `CourseMap` 인터페이스 뒤에만 둔다. 컴포넌트에서 `kakao.maps.*`나 `maplibregl`을 직접 부르지 않는다.
- 외부 API(카카오 Places, Photon)는 `services/`의 인터페이스 뒤에 둔다. 컴포넌트에서 `fetch` 금지.
- 네트워크 서비스는 실패해도 **reject하지 않고** 대체값을 돌려준다 (검색 실패 → `[]`).
- 길찾기(실제 이동 경로)는 만들지 않는다. 지도에는 스톱 사이 **직선**, 거리·시간은 직선거리 기반 **추정치("약 N분")**, 실제 안내는 구간별 **카카오맵 길찾기 링크**로 넘긴다.
  - 예외: 어떤 도로를 그릴지 고르기 위한 **내부 경로 계산**은 허용한다 (`src/map/roadRoute.ts`). 계산된 경로 자체는 화면에 그리지 않고, 거리·시간·안내에도 쓰지 않는다.
- 장소는 외부 id만이 아니라 **이름·주소·좌표 스냅샷**을 같이 저장한다 (`PlaceRef`). 외부 장소 데이터를 크롤링하거나 대량 캐시하지 않는다.
- 테스트에서 실제 네트워크 호출 금지 — `vi.stubGlobal('fetch', …)` 사용. 카카오 SDK는 테스트에서 가짜 객체로 대체한다.
- 공유 링크로 들어온 데이터는 신뢰하지 않는다: 모양 검증, 문자열 길이 제한, 좌표 범위 확인.
- 공유 링크 포맷을 바꿀 때 이전 버전 링크는 계속 열려야 한다 (디코드 테스트로 보장).
- localStorage 키에는 버전을 붙이고(`goodroot:<name>:vN`), 올릴 때 마이그레이션을 넣는다.
- UI 문구는 한국어. 주석은 기존처럼 "왜"를 설명하는 영어.

## 모바일 UI 규칙
- 전체 화면 지도 + 상단 검색바(우측 ⚙ 설정) + 하단 시트 + 하단 바(📅 달력 · 📍 핀 · ✨ 추천). 데스크톱(≥900px)에서는 하단 시트가 왼쪽 패널로 바뀌고 하단 바는 그 아래에 붙는다.
- 터치 대상 최소 44px, 입력창 글자 16px 이상 (iOS 자동 확대 방지), `100dvh`와 `env(safe-area-inset-*)` 사용.
- 호버에만 의존하는 기능 금지. 색은 `styles.css`의 `:root` 토큰만 쓴다 (`src/test/styles.test.ts`가 검사). 핀 색은 `--pin-1…8`.

## 구조
- `src/domain/` — 순수 함수 (코스 편집·검증, 거리/시간 추정)
- `src/services/` — 저장소·공유·장소 검색 (인터페이스 + 구현)
- `src/map/` — `CourseMap` 인터페이스와 카카오/MapLibre 구현
- `src/lib/` — 카카오 SDK 로더, 길찾기 링크, 현재 사용자
- `src/hooks/` — React 상태 연결 (`useCourseDraft`, `useDiaryDay`, `usePins`, `useSettings` …)
- `src/components/` — UI
- `src/types/` — 도메인 타입
- `src/test/` — 테스트 공용 설정·픽스처·M1 인수 체크리스트
