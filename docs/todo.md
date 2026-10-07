# 나중에 구현할 것 (TODO)

> 2026-10-04 작성. 옛 달력 패널(`CalendarSheet`)과 공유 시트(`ShareSheet`)를 지우면서 화면이 사라진 기능들.
> 지운 UI 코드는 git 기록에 있다: 커밋 메시지 "Remove the old calendar panel" 직전 버전의
> `src/components/CalendarSheet.tsx`, `DiaryList.tsx`, `DiaryEditor.tsx`, `DiaryView.tsx`, `DiaryTimeline.tsx`,
> `ShareSheet.tsx`, `src/hooks/useDiary.ts`, `useDiaryDay.ts`, `useIncomingDiary.ts`.

## 1. 하루 링크 (`#diary=`)

지금 상태: 받은 하루 링크를 열어도 **아무 화면도 뜨지 않는다**(해시가 그대로 남은 채 앱 홈).
CLAUDE.md의 "이전 버전 링크는 계속 열려야 한다" 규칙의 임시 예외 — 이 항목을 구현하면서 다시 지킨다.

- [ ] **받은 하루 열기** — `#diary=` 토큰을 읽어(`readDiaryToken` → `decodeSharedDiary`) 그날 장소·시간을 보여 주는 화면.
  달력 페이지(`CalendarZoom`) 안의 어떤 화면으로 열지 정하기 (예: 받은 하루를 DAY 화면처럼 핑·선으로).
  링크가 잘렸거나 깨졌으면 "공유받은 하루 루트를 열 수 없어요" 안내 후 해시 지우기(`clearDiaryFromLocation`).
- [ ] **내 하루 공유 링크 만들기** — 하루 공유 팝업(`DayShareSheet`)의 비활성 "링크 복사" 버튼을 여기에 연결.
  지금 그날 데이터는 꾸미기(`goodroot:days:v1`)와 임시 핑(`SAMPLE_PING_DATES`)뿐이라, 링크에 무엇을 담을지(핑·시간·장소) 먼저 정하기.
- [ ] (옛 패널에 있던 것) 하루 기록·계획 편집, "루트-인"(지금 위치를 그날 기록에 추가) — 새 달력에서 다시 만들지 결정.

남겨 둔 코드 (테스트 포함, 다시 쓸 수 있음):
- `services/diaryShareService.ts` — `#diary=` 인코드·디코드·검증, 공유 문구 (`diaryShareService.test.ts`)
- `services/diaryRepository.ts` — 하루 기록 `goodroot:diaries:v1` 저장소 (기존 사용자 데이터가 이 키에 남아 있을 수 있음). 위시리스트(`goodroot:wishlist:v1`)는 2026-10-05에 코드째 없앰 — 남은 값은 아무도 안 읽음
- `services/shareTargets.ts` — `planShare({ kind: 'day' })` 공유 제목·요약·링크·문구
- `domain/diary.ts`, `lib/geolocation.ts`(루트-인), `lib/clipboard.ts`(링크 복사)

## 2. 코스·핀 묶음 공유 창

지금 상태: 공유 시트(`ShareSheet`)를 지웠고, 원래도 코스·핀 묶음 공유를 여는 버튼이 없었다.
받는 쪽: `#share=`(루트)는 '<이름>님의 루트예요.' 팝업(`SharedRouteDialog`) → 루트 추가로 내 루트에 저장하고 수정 모드로 연다.
`#pins=`(핀 묶음)의 받는 창(`SharedPinsView`)은 2026-10-05에 지웠다 — 지금은 열리지 않는다.

- [x] **받은 루트 팝업의 보낸 사람 정보** — 2026-10-09: 짧은 링크(`#s=`)는 서버 `open_share`에서 보낸 사람 닉네임·사진·연 횟수를 받음 (docs/supabase.md 3단계). 긴 `#share=` 링크는 이름만.
- [ ] **받은 핀 묶음** — `#pins=`를 다시 열지, 루트 팝업처럼 바꿀지 정하기 (`decodeSharedPinSet`은 남아 있음).

- [ ] **경로(코스) 공유** — 어디서 열지 정하기 (예: 경로 줄을 눌렀을 때 나오는 작은 버튼(폴더 옮기기·삭제) 옆에 공유).
  창은 다른 가운데 팝업처럼 탑승권(`ticket-dialog`): 위에 경로 이름·정류장 요약, 아래 칸에 링크 복사·SNS 공유.
- [ ] **핀 묶음 공유** — 어디서 열지 정하기 (예: 핀 목록에서 고른 카테고리의 핀들). 30개 제한·잘린 개수 안내는 `planShare`에 이미 있음.
- [ ] 보내는 사람 이름은 프로필 닉네임(`getDisplayName`)을 그대로 쓰기.

남겨 둔 코드:
- `services/shareTargets.ts` — `planShare({ kind: 'course' | 'pins' })` (`shareTargets.test.ts`)
- `services/courseShareService.ts`, `services/pinShareService.ts` — 링크 만들기·읽기
- `lib/clipboard.ts` — 복사 (클립보드 API가 막히면 textarea로 대체)
