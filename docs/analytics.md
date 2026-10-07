# 사용 분석 (PostHog)

> 2026-10-08. 목적은 하나: 기능·UI가 직관적인지 — 사람들이 어디서 막히는지 — 보기. 마케팅·개인 추적용이 아니다.

## 켜기
`.env.local`에 PostHog 프로젝트 키(`phc_…`)를 넣는다. 비워 두면 아무것도 보내지 않고 라이브러리도 안 불러온다.
```
VITE_POSTHOG_KEY=phc_...
VITE_POSTHOG_HOST=https://us.i.posthog.com   # EU 프로젝트면 https://eu.i.posthog.com
```
PostHog 프로젝트 설정에서 **Discard client IP data**를 켠다.

키 없이 개발 중에 이벤트를 보려면 브라우저 콘솔에서 `localStorage.setItem('goodroot:analytics-debug', '1')` 후 새로고침 → 콘솔에 `[analytics] 이벤트 {속성}`.

## 원칙
- **행동만 보낸다.** 좌표·주소·장소 이름·메모·닉네임은 절대 안 보냄. 이벤트와 속성은 `services/analytics.ts`의 `EventProps`에 타입으로 정해져 있어 다른 값은 못 넣는다.
- 클릭 자동 수집(화면 글자를 읽음)·페이지뷰·세션 리플레이는 꺼 둠. 나가는 모든 이벤트의 URL은 도메인+경로만(`scrubEvent` — 공유 링크 `#share=`에 루트 전체가 들어 있음).
- 컴포넌트는 PostHog를 직접 부르지 않고 `analytics.track()`만. 실패해도 앱에 영향 없음.
- **출시 전에**: 수집 동의 화면, 개인정보처리방침(프로필 '약관 및 정책' 자리)에 수집 항목 기재.

## 이벤트 (퍼널 3개)
| 퍼널 | 이벤트 | 속성 | 언제 |
|---|---|---|---|
| 핀 꽂기 | `pin_card_opened` | `source`: search · long_press · pin_button · aim | 새 핀 카드가 뜸 |
| | `pin_saved` | `source`, `uncategorized`, `has_memo` | ✓로 핀을 꽂음 |
| | `pin_card_dismissed` | `source` | 꽂지 않고 카드가 닫힘(바깥 탭·Esc·다른 탭·다른 검색) |
| 루트 만들기 | `route_build_started` | `method`: plus · drag | + 또는 핀에서 끌어 시작 |
| | `route_build_ready` | `stops` | 2곳이 되어 생성 창이 뜸 |
| | `route_created` | `stops`, `has_note`, `in_folder` | 생성 |
| | `route_build_cancelled` | `stops`(가장 많았던 수) | 만들지 않고 끝남 |
| 공유 | `share_started` | `kind`: route · day | 공유 버튼 |
| | `share_blocked_need_home` | `kind` | 집 주소가 없어 프로필로 감 |
| | `share_studio_opened` | `kind` | 꾸미기 화면이 뜸 |
| | `share_completed` | `kind`, `method`: system_share · save_image · copy_link, `ok` | 버튼마다(시스템 공유 취소도 `ok: false`) |
| | `share_studio_closed` | `kind`, `completed` | 꾸미기 화면을 닫음 |

PostHog에서 Funnel 인사이트로 위 순서대로 단계를 걸면 된다(예: `share_started` → `share_studio_opened` → `share_completed`(ok = true)).

## 다음
1. 헤맴 신호: 아깝게 실패한 길게 누르기(0.45초 전 뗌), 반응 없는 탭, 같은 곳 연타, 되돌리기 연타.
2. 조작 발견: 숨은 제스처(길게 누르기 모양, 한붓그리기, 달력 오므리기, 밀어서 지도로…) 처음 쓴 시점.
3. 세션 리플레이(글자 전부 가림, 제외 주소·사진 영역 제외, 10~20% 표본) + 앱 안 한 문항 설문.
