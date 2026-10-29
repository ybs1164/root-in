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
- 대상: 핀 카테고리 · 핀 · 루트 폴더 · 루트(코스 + 폴더 배정·순서) · 하루(날짜 화면 꾸미기, 핑 모양·선) · 투데이 핑(`pings`, 2026-10-08 — 제외 주소 근처의 `local` 핑은 빼고, 받아 쓸 때도 그대로 둠). 공유 횟수는 서버 몫이라 올리지 않음(3단계).
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
- **링크 끊기·추가 수** (2026-10-08, `20261011000000_shares_revoke.sql`): 루트를 지우면(지움 표시, 어느 기기에서든) 서버 트리거가 그 루트의 링크에 `revoked_at`을 찍어 끊음 — `open_share`가 아무것도 안 돌려줘 받는 쪽은 '공유 링크를 열 수 없어요'. 지운 루트가 되살아나도 링크는 끊긴 채이고, 링크 복사는 끊긴 링크를 다시 쓰지 않고 새로 만듦. 받은 루트 팝업의 '루트 추가'는 `count_share_add(slug)`로 `add_count`+1(주인 제외, 실패해도 추가는 됨, 같은 사람이 여러 번 누르면 여러 번 셈). 셀 때 `last_opened_at`도 찍음. `kind`(`route`·`day`·`pins`)는 나중의 하루·핀 묶음 짧은 링크용, 지금은 늘 `route`.
- 보안: `shares`·`profiles`는 이제 **본인만 select**(목록으로 남의 공유·설정을 볼 수 없음). 남이 보는 건 `open_share`가 돌려주는 공개 정보뿐. 링크를 여러 브라우저로 열어 횟수를 부풀리는 것은 막지 않음(익명 열기라 막을 신원이 없음).

## 카테고리 구독 (2026-10-23)
- `20261023000000_category_shares.sql`: 핀 카테고리를 링크(`#c=<slug>`)로 공유하면 받는 사람이 **구독**해서 계속 따라감. 테이블 `category_shares`(slug·owner_id·category_id·snapshot·revoked_at, 카테고리당 살아 있는 링크 하나 — 부분 unique 인덱스), RLS는 주인만. 받는 쪽은 `open_category_share(slug)`(anon 가능) — 스냅샷·주인 닉네임·사진 경로·`mine`.
- 스냅샷은 **주인 폰이 만들어 올림**(`{ v: 1, c: { n, ic, co }, p: [{ i, n, c, a?, y?, m? }] }`, 핀 500개까지): 제외 주소는 서버에 없으니 폰에서 빼고 올림. 공유 중인 카테고리의 핀·모양·제외 주소가 바뀌면 2초 뒤 다시 올림(`hooks/useCategoryShares.ts` `useSharedCategories`). 카테고리를 지우면(지움 표시, 어느 기기든) 트리거가 링크를 끊음. '공유 중지'도 `revoked_at`.
- 구독은 **받는 폰에만** 저장(`goodroot:category-subs:v1` — slug·내 카테고리 id·주인 이름·주인 모양·구독이 넣은 장소 id). 카테고리와 핀은 평범한 내 것이라 그대로 동기화되지만, 다른 기기에서는 구독(자동 갱신)이 이어지지 않음. 앱을 열 때·앞으로 올 때·5분마다 다시 읽어 `domain/categoryShare.ts` `followCategory`로 맞춤.

## 처음 설정
1. [supabase.com](https://supabase.com)에서 프로젝트 만들기 — 리전은 **Northeast Asia (Seoul)**.
2. **대시보드 SQL Editor에는 한 번에 100줄까지만 붙여 넣어진다** — 그보다 긴 파일(init은 169줄)은 잘려서 이상한 오류가 난다.
   Supabase CLI(`supabase db push`)를 쓰거나, 잘라서 붙여 넣을 것. 처음 init이 중간에 멈춘 DB는 `supabase/repair/`(100줄 미만 세 파일)로 마무리.
   SQL Editor에서 `supabase/migrations/`의 파일을 이름 순서대로 실행 (또는 Supabase CLI `supabase db push`).
   `20261007000000_init.sql` — 테이블·RLS·`avatars` 버킷·`delete_my_account`·`open_share` 함수,
   `20261008000000_sync.sql` — 동기화용 변경(`order` → `position`, 폴더 `icon`, 하루 `looks`, 길이 검사는 클라이언트로),
   `20261009000000_shares.sql` — 공유·프로필 select를 본인만으로, `open_share(slug, count_open)`이 보낸 사람 정보까지,
   `20261010000000_sync_cursor.sql` — 동기화 테이블에 `server_updated_at`(트리거)·`deleted_at`, `pins.geom`을 서버가 `place.center`에서 채움(트리거), 행 크기 상한(NOT VALID — 새 쓰기만 검사), `purge_sync_tombstones()`.
   `20261011000000_shares_revoke.sql` — 공유에 `kind`·`revoked_at`·`add_count`·`last_opened_at`, 루트를 지우면 링크를 끊는 트리거, `open_share`가 끊긴 링크엔 null, `count_share_add`.
   `20261012000000_pings.sql` — 투데이 핑 테이블(`pings`, 동기화 열·RLS), 안 쓰던 `days.pings` 열 삭제, `purge_sync_tombstones`에 핑 추가.
   `20261016000000_groups.sql` — We Now 그룹(`groups`·`group_members`, 모임원만 select), `create_group`·`join_group`·`rename_group`·`leave_group`·`my_groups(day)`(모임원 그날 핑의 시각·좌표만). 109줄이라 SQL Editor에는 둘로 나눠 붙일 것(`add_group_member`까지 / 나머지).
   `20261017000000_group_kick.sql` — 그룹원 추방 `kick_group_member(gid, member)`(만든 사람만, 자기 자신은 안 됨).
   `20261018000000_group_alias_delete.sql` — 그룹원 별명 `group_members.alias`·`set_group_alias`, 그룹 삭제 `delete_group`(만든 사람만), `my_groups`가 별명도 돌려줌.
   `20261019000000_group_alias_default.sql` — 그룹에 들어올 때 프로필 닉네임을 그 그룹의 이름(`alias`)으로 넣고, 이미 있는 그룹원도 채움; 이름은 비울 수 없음.
   `20261020000000_group_ping_names.sql` — `my_groups`가 핑마다 장소 이름(80자)도 보냄(포커스한 그룹원의 장소 이름 표시용, 주소는 여전히 안 보냄).
   `20261027000000_group_photos.sql` — 카메라 사진 전송: 공개 버킷 `group-photos`(1MB JPEG, 자기 `<uid>/` 폴더에만 쓰기) · `group_photos`(그룹마다 한 줄 — 고른 그룹만 봄, 모임원만 select) · `send_group_photo(gids, on_day, at_time, ping_center, place_name, photo_path)`(내가 속한 그룹에만 넣고 넣은 수를 돌려줌) · `my_groups`가 그룹원 핑에 그 그룹으로 보낸 사진 핑(`photo` = 버킷 경로)을 섞어 보냄. 80줄.
   `20261029000000_avatar_select.sql` — `avatars` 버킷에 자기 폴더 select 정책(upsert가 이걸 요구 — 없으면 프로필 사진 올리기가 실패해 다른 그룹원에게 사진이 안 보였음).
   `20261030000000_group_ping_days.sql` — 그룹 달력: `group_ping_days(gid, from_day, to_day)`(모임원만, 62일까지)가 그 기간 날마다 핑을 찍은(또는 그 그룹에 사진을 보낸) 그룹원 id만 `{ day, user_id }`로 돌려줌 — 장소·시각은 안 보냄. 없으면 클라이언트가 날마다 `my_groups`로 대신 읽음.
   `20261031000000_group_member_color.sql` — 그룹원 색: `group_members.color`(0~19, 그룹 안에서 겹치지 않음 `unique (group_id, color)`; 있던 그룹원은 `slot` 값 그대로), 들어올 때 아무도 안 쓰는 가장 앞 색(`add_group_member`), `set_group_color(gid, new_color)`는 내 색만 바꾸고 다른 그룹원이 쓰는 색이면 false, `my_groups`가 `color`를 같이 보냄. 없으면 클라이언트는 색을 `slot`으로 침.
   `20261101000000_group_met_days.sql` — 갤러리 만난 날: `group_met_days(gids, days)`(내가 속한 그룹만, 30그룹·400일까지)가 그날 같은 장소(50m 안)에 핑이나 보낸 사진이 있는 그룹원 쌍을 `{ group_id, day, user_a, user_b }`로 — 장소·시각은 안 보냄. 없으면 클라이언트가 날마다 `my_groups`로 대신 셈. 즐겨찾기는 서버에 없음(이 폰에만).
   `20261102000000_photo_hearts.sql` — 갤러리 하트: `photo_hearts`(사진 `path`·보낸 사람·받는 사람·`seen_at`, 내가 누른 것만 읽을 수 있음), `heart_photo(path, heart)`(그 사진이 내 그룹에 있고 내 사진이 아닐 때만 — 넣기/빼기), `heart_news()`(아직 안 보여 준 내 사진의 하트, 누른 사람 이름·장소 이름, 50개), `hearts_seen(upto)`. 개수는 어디로도 안 보냄.
   `20261103000000_group_profiles.sql` — 그룹별 프로필: `group_members.own_profile`(통합/개별)·`photo_path`(avatars 버킷 내 폴더 `g<랜덤>.jpg`), `set_group_profile(gid, own, new_alias, new_photo)`(사진: null 그대로·'' 없앰·경로 바꿈, 바뀐 옛 사진 경로를 `old_photo`로 돌려줘 앱이 지움), `my_groups`가 그룹이 보여 줄 사진·이름과 내 줄의 저장된 개별 값(`group_alias`·`group_photo`)을 보냄.
   `20261104000000_photo_comments.sql` — 큰 사진 댓글: `photo_comments`(사진 `path`·쓴 사람·글 200자, 직접 읽기 없음), `comment_photo(photo_path, comment)`(그 사진이 내 그룹에 있을 때만 — 내 사진도, 1분에 30개까지, 새 id), `photo_comments(photo_path)`(그 사진이 내 그룹에 있을 때 오래된 순 200개, 쓴 사람 이름(같이 있는 그룹의 이름 → 닉네임)·`mine`). TODAY 사진(`ping:<id>`)의 댓글은 서버에 안 감(`goodroot:photo-comments:v1`). 적용 전에는 큰 사진 아래 '댓글을 불러오지 못했어요.'
   `20261105000000_group_chat.sql` — 그룹 대화: `group_messages`(그룹·쓴 사람·글 200자, 직접 읽기 없음), `send_group_message(gid, message)`(모임원만, 1분에 30개, 새 id), `group_feed(gid)`(모임원만 — 그 그룹에 온 사진(`path`·장소 이름) + 그 사진들의 댓글(글·사진 `path`·장소) + 대화 메시지를 최근 300개, 사람은 id와 `mine`만). 적용 전에는 대화 화면에 '대화를 불러오지 못했어요.'
   **이 마이그레이션들을 먼저 적용하고 나서 클라이언트를 배포**할 것 — 새 클라이언트는 이 열을 읽어서, 적용 전 DB에서는 동기화가 실패(프로필 창 안내)한다.
   지움 표시는 30일 뒤 지운다: Integrations → Cron(pg_cron)에 매일 `select public.purge_sync_tombstones();` 등록. 그 전까지 지운 핀·루트의 내용이 서버에 남아 있음.
3. Project Settings → API의 Project URL과 **anon(public)** 키를 `.env.local`에:
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
   새 공개 키는 `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`로 설정해도 된다(anon 키보다 우선).
   Android 배포용 설정은 `.env.production.local`에 두고, `npm run android:sync`가 `/auth/v1/settings` 응답을 확인한 뒤 빌드한다. 설정이 빠졌거나 연결이 실패하면 APK 생성 전 중단한다. `android:apk`도 실제 번들에 현재 서버 설정이 들어 있는지 확인한다. 서버 없는 로컬 시험만 두 스크립트에 `--local-only`를 명시한다. 일반 웹 개발·CI는 키 없이도 그대로 실행된다. 빌드 설정 검사는 `node --test scripts/android-config.check.mjs`로 실행한다.
   **service_role 키는 절대 프론트(.env의 VITE_*)에 넣지 않는다.**
4. 카카오 로그인
   - 카카오 개발자 콘솔 → 내 애플리케이션 → 카카오 로그인 활성화, Redirect URI에
     `https://<ref>.supabase.co/auth/v1/callback` 등록. 보안 → Client Secret 발급·활성화.
   - 동의 항목: 닉네임·프로필 사진. 이메일(account_email)은 비즈 앱이 아니면 받을 수 없으니
     Supabase 쪽에서 이메일 없이 가입을 허용해야 한다(아래).
   - Supabase → Authentication → Sign In / Providers → Kakao: REST API 키를 Client ID로, Client Secret 입력,
     "Allow users without an email"(이메일 없는 사용자 허용) 켜기.
     *(REST API 키는 Supabase 서버 설정에만 들어간다 — 프론트에는 여전히 JS 키뿐.)*
   - **We Now 게스트**(카카오 없이 그룹 쓰기): Authentication → Sign In / Providers → **Allow anonymous sign-ins** 켜기, 그리고 게스트가 나중에 카카오로 로그인할 때 같은 계정에 이어지도록 Authentication → **Allow manual linking** 켜기. 끄면 We Now가 '그룹을 불러오지 못했어요'로 남음. 익명 가입 남용이 걱정되면 같은 화면의 CAPTCHA·속도 제한을 켤 것.
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
남은 스키마 설계(핑·공유 정리·알림): [schema-plan.md](schema-plan.md).
4. 알림(트리거 → Edge Function → Web Push).
