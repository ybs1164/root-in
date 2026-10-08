# Supabase 설정 (로그인·프로필 동기화)

> 2026-10-07~09, DB 도입 1·2·3단계. 키가 없으면 앱은 예전처럼 이 기기에만 저장한다(로그인 버튼도 안 보임).

## 지금 되는 것 (1단계)
- 프로필 → 계정·약관·정책 → **카카오로 로그인** / 로그아웃 / 탈퇴(계정까지 삭제).
- 로그인하면 프로필(닉네임·@아이디·사진·소리·알림·디스플레이)을 계정과 맞춘다 (`services/accountSync.ts`):
  - 처음 로그인: 이 기기의 프로필이 계정 프로필이 됨. @아이디가 이미 쓰이고 있으면 계정 id로 만든 `user…`로.
  - 그 뒤 로그인(다른 기기 등): 계정 프로필이 이 기기 프로필을 덮음.
  - 로그인 중 바꾸면 바로 서버로 보냄(한 번에 하나씩, 가장 최근 것만). 다른 사람이 쓰는 @아이디면 원래 아이디로 되돌리고 안내.
  - 서버가 안 되면 이 기기 것은 그대로 두고 안내만.
- 제외 주소(집 등)는 서버에 올리지 않는다 — 계속 기기에만.

## 핀·루트·하루 동기화 (2단계)
화면은 지금처럼 이 기기 저장소(localStorage)만 읽는다. 로그인해 있으면 그 저장소를 계정 행과 맞춘다 (`services/cloudSync.ts`).
- 대상: 핀 카테고리 · 핀 · 루트 폴더 · 루트(코스 + 폴더 배정·순서) · 하루(날짜 화면 꾸미기, 핑 모양·선). 공유 횟수는 서버 몫이라 올리지 않음(3단계).
- **언제**: 로그인할 때(프로필 다음), 앱이 다시 앞으로 올 때(`visibilitychange`) 서버에서 받아 합침.
- **바뀐 것만 받기** (2026-10-08, `20261010000000_sync_cursor.sql`): 행마다 서버가 찍는 `server_updated_at`(트리거 — 폰 시계 아님)과 지움 표시 `deleted_at`. 지우기는 행을 지우지 않고 표시만 함. 컬렉션마다 마지막으로 받은 `server_updated_at`을 커서로 기억(`goodroot:sync:v1`의 `cursor`)해 다음엔 그 2분 전(`CURSOR_OVERLAP_MS`, 늦게 커밋된 쓰기 대비) 이후 행만 받음 — 지움 표시 포함, 받은 행만 3방향 병합하고 나머지는 이 기기 변경만 보냄(`mergeDelta`). 처음 동기화·다른 계정·커서가 21일보다 오래됨(`CURSOR_MAX_AGE_MS`)이면 전체를 읽음(지움 표시 없는 행만). 보내기에 실패하면 커서도 그대로라 다음에 같은 행을 다시 받음. 계정이 비어 있던 첫 동기화 뒤에는 찍힌 시각이 없어 한 번 더 전체를 읽음. 이 기기에서 바꾸면 1.5초 뒤 바뀐 행만 보냄(`PUSH_DELAY_MS`, 펜 획처럼 잦은 쓰기를 모음).
- **합치는 법**: 행마다 마지막으로 서버와 맞춘 내용의 해시(`goodroot:sync:v1`의 base)를 두고 3방향 비교 (`services/syncMerge.ts`).
  한쪽만 바꾼 행은 그쪽, 둘 다 바꿨으면 `updated_at`이 나중인 쪽(없으면 서버), 지운 것도 양쪽으로 전달. 한쪽이 지우고 다른 쪽이 고쳤으면 고친 것을 살림.
- **처음 로그인한 기기**: 이 기기의 핀·루트가 계정에 더해짐(합집합). 기본 카테고리는 계정에 이미 카테고리가 있으면 '이미 맞춘 것'으로 쳐서, 계정에서 지운 기본 카테고리가 되살아나지 않음.
- **로그아웃**: 이 기기 데이터는 그대로. 같은 계정으로 다시 로그인하면 이어서 합침.
  **다른 계정으로 로그인**하면 이 기기 데이터를 그 계정 것으로 바꿈(앞 계정 것은 그 계정 서버에 있음 — 단 보내지 못한 마지막 변경은 사라짐). 빈 계정이면 기본 카테고리부터.
- 서버가 안 되면 이 기기 것은 그대로 두고 프로필 창에 안내, 다음에 앱을 다시 열면 또 시도. 반쯤 받아온 상태로 합치지 않음(모두 받은 뒤에만).
- 서버에서 받은 행도 저장소 값처럼 검증한다 (`services/syncCollections.ts` — 카테고리·핀은 저장소 검사 그대로, 루트 정류장 좌표·글자 수, 하루는 `parseDays`). 다른 날짜의 키는 그 날 행으로 못 들어옴.
- 로컬 행의 `userId`는 계속 이 기기 id(`getCurrentUserId()`), 서버 행은 계정 id(`user_id`, RLS). 그래서 로그인·로그아웃으로 로컬 데이터를 옮기거나 다시 쓸 일이 없다.
- 저장소가 쓸 때 `syncBus.localWrote`로 알리고, 받아와서 바꾸면 `onPulled`로 화면(usePins·useCourses·useRouteFolders·CalendarZoom)이 다시 읽음. 받아 쓴 것은 다시 올리지 않음(`withoutEcho`).

## 짧은 공유 링크·공유 횟수 (3단계)
- 꾸미기 화면(경로 카드)의 **링크 복사**: 로그인 중이면 `shares`에 행을 만들고 `https://…/#s=<slug>`(10자) 복사. 같은 루트·같은 내용이면 이미 만든 링크를 다시 씀(횟수가 한 행에 모임). 로그인 안 했거나 실패하면 예전 긴 `#share=` 링크. 둘 다 제외 주소 정류장은 빠짐.
- 행에는 긴 링크와 똑같은 토큰을 넣음(`snapshot = { token }`) — 받는 쪽은 긴 링크와 같은 디코드·검증을 거침.
- **받기**: `#s=` 링크는 `open_share(slug, count_open)` RPC 하나로 엶 — 토큰, 연 횟수, 보낸 사람(닉네임·@아이디·사진 경로). 이 브라우저에서 처음 열 때만 셈(`goodroot:opened-shares:v1`), 주인이 열면 안 셈. 받은 루트 팝업에 보낸 사람 사진·닉네임과 '지금까지 n번 공유됐어요.'.
- **공유 횟수**(`Course.shareCount`, 경로 줄 `N Shares`): 로그인 중 동기화 뒤와 앱이 다시 앞으로 올 때 내 `shares`의 `open_count`를 루트별로 더해 채움(`services/shareCounts.ts`). 서버 값이라 동기화 행에는 없음(올리지 않음).
- 보안: `shares`·`profiles`는 이제 **본인만 select**(목록으로 남의 공유·설정을 볼 수 없음). 남이 보는 건 `open_share`가 돌려주는 공개 정보뿐. 링크를 여러 브라우저로 열어 횟수를 부풀리는 것은 막지 않음(익명 열기라 막을 신원이 없음).

## 처음 설정
1. [supabase.com](https://supabase.com)에서 프로젝트 만들기 — 리전은 **Northeast Asia (Seoul)**.
2. **대시보드 SQL Editor에는 한 번에 100줄까지만 붙여 넣어진다** — 그보다 긴 파일(init은 169줄)은 잘려서 이상한 오류가 난다.
   Supabase CLI(`supabase db push`)를 쓰거나, 잘라서 붙여 넣을 것. 처음 init이 중간에 멈춘 DB는 `supabase/repair/`(100줄 미만 세 파일)로 마무리.
   SQL Editor에서 `supabase/migrations/`의 파일을 이름 순서대로 실행 (또는 Supabase CLI `supabase db push`).
   `20261007000000_init.sql` — 테이블·RLS·`avatars` 버킷·`delete_my_account`·`open_share` 함수,
   `20261008000000_sync.sql` — 동기화용 변경(`order` → `position`, 폴더 `icon`, 하루 `looks`, 길이 검사는 클라이언트로),
   `20261009000000_shares.sql` — 공유·프로필 select를 본인만으로, `open_share(slug, count_open)`이 보낸 사람 정보까지,
   `20261010000000_sync_cursor.sql` — 동기화 테이블에 `server_updated_at`(트리거)·`deleted_at`, `pins.geom`을 서버가 `place.center`에서 채움(트리거), 행 크기 상한(NOT VALID — 새 쓰기만 검사), `purge_sync_tombstones()`.
   **이 마이그레이션을 먼저 적용하고 나서 클라이언트를 배포**할 것 — 새 클라이언트는 이 열을 읽어서, 적용 전 DB에서는 동기화가 실패(프로필 창 안내)한다.
   지움 표시는 30일 뒤 지운다: Integrations → Cron(pg_cron)에 매일 `select public.purge_sync_tombstones();` 등록. 그 전까지 지운 핀·루트의 내용이 서버에 남아 있음.
3. Project Settings → API의 Project URL과 **anon(public)** 키를 `.env.local`에:
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
   **service_role 키는 절대 프론트(.env의 VITE_*)에 넣지 않는다.**
4. 카카오 로그인
   - 카카오 개발자 콘솔 → 내 애플리케이션 → 카카오 로그인 활성화, Redirect URI에
     `https://<ref>.supabase.co/auth/v1/callback` 등록. 보안 → Client Secret 발급·활성화.
   - 동의 항목: 닉네임·프로필 사진. 이메일(account_email)은 비즈 앱이 아니면 받을 수 없으니
     Supabase 쪽에서 이메일 없이 가입을 허용해야 한다(아래).
   - Supabase → Authentication → Sign In / Providers → Kakao: REST API 키를 Client ID로, Client Secret 입력,
     "Allow users without an email"(이메일 없는 사용자 허용) 켜기.
     *(REST API 키는 Supabase 서버 설정에만 들어간다 — 프론트에는 여전히 JS 키뿐.)*
   - Authentication → URL Configuration: Site URL은 배포 주소, Redirect URLs에
     `http://localhost:5188/**`와 배포 도메인 추가.

## 구조
- `lib/supabase.ts` — 키가 있을 때만 `@supabase/supabase-js`를 동적 import (키 없는 빌드엔 라이브러리가 아예 안 들어감). PKCE 흐름이라 로그인 결과가 `?code=`로 돌아와 공유 링크 해시(`#share=`)와 안 겹침, 쓰고 나면 `clearLoginReturn`이 주소창에서 지움.
- `services/authService.ts` — 로그인·로그아웃·탈퇴 (`AuthService` 인터페이스, reject 안 함).
- `services/remoteProfileService.ts` — `profiles` 행 + `avatars/<uid>/avatar.jpg`.
- `services/profileSync.ts` — 행 ↔ `Profile` 변환(서버 값도 저장소 값처럼 검증).
- `services/accountSync.ts` — 로그인 때 합치기·변경 보내기 (React 밖, 테스트 있음).
- `hooks/useAccount.ts` — App에 연결. `ProfileSheet`의 `account` prop. 프로필 동기화 뒤 `cloudSync`를 돌림.
- `services/shareLinkService.ts`(짧은 링크 만들기·열기·횟수) · `shareCounts.ts`(횟수를 루트에) · `hooks/useIncomingCourse.ts`의 `resolveIncoming`.
- `services/cloudSync.ts`(엔진) · `syncMerge.ts`(3방향 병합·해시) · `syncCollections.ts`(저장소 ↔ 행) · `remoteDataService.ts`(Supabase 읽기 1000행씩·쓰기 200행씩) · `syncBus.ts`(저장소 쓰기 알림).

## 다음 단계
4. 알림(트리거 → Edge Function → Web Push).
