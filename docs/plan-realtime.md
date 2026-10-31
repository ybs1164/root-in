# 계획: 그룹 대화와 사진 댓글을 실시간으로

> 2026-10-31 작성. 작업 번호 R0, R1 … 한 번에 하나씩.
>
> **2026-10-31 진행**: R0~R3·R5 코드 끝, R1 단위 테스트 있음. 남은 것: 마이그레이션을 Supabase에 적용하고 대시보드에서 공개 채널 끄기, R4의 두 기기 확인(이 PC 개발 서버엔 Supabase 키가 없어 서버와 붙여 보지 못함). 계획과 달라진 점: 내 알림을 `by`로 거르지 않고 **이미 화면에 있는 줄의 id면 무시**(같은 계정의 다른 폰에서 쓴 것도 보이게).

## 지금은 어떻게 읽나

- **그룹 대화**(`GroupChat`): 열 때 `group_feed(gid)`를 한 번 읽고, 열려 있는 동안 **30초마다**(`REFRESH_MS`) + 큰 사진을 닫을 때 + 내가 보낸 직후 다시 읽음. 남이 쓴 메시지는 최대 30초 늦게 보임.
- **큰 사진 댓글**(`PhotoViewer` → `PhotoCommentList` → `usePhotoComments`): 사진을 열 때 `photo_comments(path)`를 한 번, 내가 단 직후 한 번. **사진을 열어 둔 동안 남이 단 댓글은 다시 열 때까지 안 보임.**
- 서버 표 `group_messages`·`photo_comments`·`group_photos`는 RLS가 켜져 있고 select 정책이 없음 — 읽기는 전부 security definer 함수(`group_feed`·`photo_comments`)로만. 이름(그룹 별명·닉네임)도 그 함수가 붙임.
- 클라이언트에 Realtime을 쓰는 곳은 아직 없음. `@supabase/supabase-js` 2.117에 들어 있음(`lib/supabase.ts`).

## 방식: DB에서 보내는 "바뀌었어요" 알림 + 지금 함수로 다시 읽기

Supabase Realtime의 **Broadcast from Database**(트리거에서 `realtime.send`)로, 줄이 생길 때 **비공개 채널**에 짧은 알림만 보낸다. 앱은 알림을 받으면 지금처럼 `group_feed`·`photo_comments`로 다시 읽는다.

| 고른 것 | 이유 |
|---|---|
| Broadcast(트리거) — Postgres Changes 아님 | Postgres Changes는 표에 select RLS 정책이 있어야 해서 지금 "함수로만 읽기" 원칙을 깸(REST로 표를 직접 읽을 길이 생김). 구독자마다 RLS를 다시 검사해서 느리고, Supabase도 새 앱에는 Broadcast를 권함 |
| 알림에는 **본문을 안 넣음**(종류·id·보낸 사람 id·사진 path만) | 이름 붙이기·권한 검사·검증(`readFeed`·`readComments`)이 지금처럼 한 길로만 감. 추방·나가기 뒤 소켓이 아직 붙어 있어도(채널 권한은 들어올 때만 검사) 새 글 내용은 못 받음 — 다시 읽기는 RPC가 막음 |
| 채널 둘: `group:<gid>`, `photo:<path>` | 대화는 그룹 단위, 큰 사진은 그 사진 하나만 듣기(갤러리 MY 탭처럼 그룹이 여럿이어도 사진 하나면 됨) |
| 폴링은 남김, 느리게 | 소켓이 끊긴 동안(앱이 뒤로 간 폰, 나쁜 망)의 안전망. 연결돼 있으면 2분, 아니면 지금처럼 30초 |

알림 모양(JSON, `event`는 `feed`):

```json
{ "kind": "message" | "comment" | "photo", "id": "<uuid>", "by": "<user uuid>", "path": "<사진 path, 메시지면 없음>" }
```

## 작업

### R0 — 서버: 트리거와 채널 권한 (`supabase/migrations/20261107000000_realtime_group_events.sql`)

- 트리거 함수(security definer, `search_path = pg_catalog`):
  - `group_messages` insert → `realtime.send(알림, 'feed', 'group:' || group_id, true)`
  - `group_photos` insert → `group:<group_id>` (대화에 사진 줄이 생기므로)
  - `photo_comments` insert → `photo:<path>` 한 번 + 그 path를 받은 그룹마다 `group:<gid>`(`group_photos`에서 찾음 — 대화에 댓글 줄이 생기므로)
  - `realtime.send`는 실패해도 경고만 내고 insert를 막지 않음(Supabase 함수 자체가 예외를 삼킴) — 그래도 트리거 안에서 한 번 더 감싸 둠.
- `realtime.messages` select 정책(`authenticated` — 게스트(익명 로그인)도 여기 듦):
  - `realtime.topic() ~ '^group:<uuid>$'` 이면 `is_group_member(그 uuid)`
  - `realtime.topic() like 'photo:%'` 이면 `can_see_photo(그 뒤)`
  - insert 정책은 없음 — 클라이언트가 채널에 직접 보내지 못하게(알림은 트리거만).
- 대시보드: Realtime 설정에서 **공개 채널 허용 끄기**(Private only). [docs/supabase.md](supabase.md)에 적기.
- 확인: SQL 편집기에서 메시지 한 줄 넣고 Realtime Inspector로 `group:<gid>`에 알림이 오는지, 그룹원이 아닌 계정으로는 채널 가입이 거절되는지.

### R1 — 클라이언트: `services/groupLive.ts`

- 인터페이스 `GroupLive`: `watch(topic: LiveTopic, onEvent: (e: LiveEvent) => void): () => void`, `LiveTopic` = `{ group: string } | { photo: string }`. 상태 `onStatus(cb)`(`live` | `off`)로 연결 여부를 알려 줌.
  - 같은 topic은 채널 하나를 함께 씀(참조 수). 마지막 구독이 풀리면 `removeChannel`.
  - `client.channel(topic, { config: { private: true } })`, 구독 전에 `client.realtime.setAuth()`(로그인·게스트 전환·토큰 갱신 뒤에도 — `onAuthStateChange`에서 다시).
  - 받은 알림은 모양 검사(`readLiveEvent` — kind 셋 중 하나, uuid, path는 `group-photos` 규칙)로 거르고 아니면 버림. **reject 안 함**; 키가 없거나 SDK가 없으면 아무것도 안 하는 `watch`(상태는 늘 `off`).
  - `SUBSCRIBED`가 다시 오면(재연결) `onEvent({ kind: 'resync' })` 한 번 — 끊긴 동안 놓친 걸 다시 읽게.
- 개발용 더미(`src/dev/groupDemoService.ts`): 같은 인터페이스의 메모리 버전 — 더미 그룹에 메시지·댓글을 쓰면 그 자리에서 알림. (원하면 개발용으로 더미 유저 1이 몇 초 뒤 답글을 다는 것도 — 두 기기 없이 실시간을 볼 수 있게.)
- 테스트 `groupLive.test.ts`: 가짜 클라이언트(`channel().on().subscribe()` 흉내)로 참조 수·잘못된 알림 버리기·resync·키 없을 때.

### R2 — 대화 실시간 (`GroupChat`)

- `useGroupLive({ group: group.id }, …)` 훅으로 알림을 받으면 **250ms 모아서** `read()` 한 번(알림이 몰려도 읽기는 한 번).
- 이미 화면에 있는 줄의 알림은 무시 — 내가 보낸 것은 보낸 직후 이미 읽음(같은 계정의 다른 폰에서 쓴 것은 새 줄이라 읽음).
- 폴링: `live`면 2분, `off`면 30초. 앱이 앞으로 올 때(`lib/native.ts`의 앞/뒤 알림, 웹은 `visibilitychange`) 바로 한 번 읽음.
- 새 줄이 오면 지금 규칙 그대로 맨 아래로 — 단 사용자가 위로 올려 읽는 중이면(바닥에서 80px 넘게 떨어져 있으면) 끌어내리지 않고, 아래에 작은 '새 메시지' 알약(누르면 맨 아래로). 이 알약은 이번에 같이 넣을지 정할 것.

### R3 — 큰 사진 댓글 실시간 (`usePhotoComments`)

- 그룹 사진(`ping:`이 아닌 path)이 열려 있는 동안 `{ photo: path }`를 들음 → 알림이면 `groupService.comments(path)` 다시 읽기(같은 250ms 모으기, 내 것은 무시). TODAY 사진은 그대로(이 폰에만).
- 사진을 넘기면(path가 바뀌면) 구독도 바뀜. 갤러리·그룹 지도·대화 어디서 열어도 같은 훅이라 한 번에 됨.
- 댓글 목록이 150px 넘게 스크롤된 채 새 댓글이 오면 맨 아래로 내림(댓글은 짧아서 알약 없이).

### R4 — 끊김·복귀 점검과 두 기기 확인

- 안드로이드 WebView에서 앱을 뒤로 보냈다가 오면 소켓이 끊겨 있음 → supabase-js가 다시 붙고(R1 resync) + 앞으로 올 때 읽기(R2)로 메워지는지.
- 확인 방법: 미리보기 창 + **다른 브라우저 프로필**(같은 브라우저 탭은 localStorage를 같이 써서 같은 게스트가 됨)로 같은 그룹에 들어가 서로 메시지·댓글 → 1초 안에 보이는지. 하나를 오프라인으로 했다 돌리기.
- 무료 한도: 동시 연결 200·메시지 월 200만 — 지금 규모에선 여유. 한 사람은 소켓 하나(채널 여럿이 한 소켓을 씀).

### R5 — 문서

- [docs/supabase.md](supabase.md)에 '실시간' 절(채널 이름·알림 모양·정책·대시보드 설정), `CLAUDE.md` We Now 절의 '30초마다' 문구 고치기.

## 이번에 안 하는 것 (같은 채널로 나중에 쉽게 붙음)

- 그룹 지도의 새 핑·사진(`useGroups`는 1분 폴링 그대로) — `group_photos` 알림은 R0에서 이미 나가니 `useGroups`가 들으면 됨. TODAY 핑은 `pings` 동기화를 거쳐서 따로.
- 하트 소식(`useHeartNews`, 1분), 사진 낙서(`usePhotoDecor`) — 낙서는 `photo:<path>`에 `decor` 종류를 더하면 됨.
- 입력 중 표시·읽음 표시·푸시 알림(앱이 꺼져 있을 때는 Realtime으로 안 됨 — FCM/APNs 따로).
- 다시 읽기를 줄이는 `group_feed_since(gid, after)`(지금은 알림마다 최근 300줄을 다시 읽음 — 느려지면).
