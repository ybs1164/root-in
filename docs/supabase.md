# Supabase 설정 (로그인·프로필 동기화)

> 2026-10-07, DB 도입 1단계. 키가 없으면 앱은 예전처럼 이 기기에만 저장한다(로그인 버튼도 안 보임).

## 지금 되는 것 (1단계)
- 프로필 → 계정·약관·정책 → **카카오로 로그인** / 로그아웃 / 탈퇴(계정까지 삭제).
- 로그인하면 프로필(닉네임·@아이디·사진·소리·알림·디스플레이)을 계정과 맞춘다 (`services/accountSync.ts`):
  - 처음 로그인: 이 기기의 프로필이 계정 프로필이 됨. @아이디가 이미 쓰이고 있으면 계정 id로 만든 `user…`로.
  - 그 뒤 로그인(다른 기기 등): 계정 프로필이 이 기기 프로필을 덮음.
  - 로그인 중 바꾸면 바로 서버로 보냄(한 번에 하나씩, 가장 최근 것만). 다른 사람이 쓰는 @아이디면 원래 아이디로 되돌리고 안내.
  - 서버가 안 되면 이 기기 것은 그대로 두고 안내만.
- 핀·루트·하루는 아직 이 기기에만 있다 (2단계에서 올림). 로그아웃해도 이 기기 데이터는 남는다.
- 제외 주소(집 등)는 서버에 올리지 않는다 — 계속 기기에만.

## 처음 설정
1. [supabase.com](https://supabase.com)에서 프로젝트 만들기 — 리전은 **Northeast Asia (Seoul)**.
2. SQL Editor에서 `supabase/migrations/20261007000000_init.sql`을 실행 (또는 Supabase CLI `supabase db push`).
   테이블·RLS·`avatars` 버킷·`delete_my_account`·`open_share` 함수가 만들어진다.
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
- `hooks/useAccount.ts` — App에 연결. `ProfileSheet`의 `account` prop.

## 다음 단계
2. 핀·카테고리·루트·폴더·하루 저장소의 Supabase 구현 (로컬 먼저, 서버로 동기화) + 첫 로그인 때 이 기기 데이터 올리기. 이때 `getCurrentUserId()`를 계정 id로 바꾼다.
3. 짧은 공유 링크(`shares`, `open_share`)와 공유 횟수(`Course.shareCount`, 받은 루트 팝업의 보낸 사람 사진).
4. 알림(트리거 → Edge Function → Web Push).
