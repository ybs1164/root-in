# DB 스키마 계획 (남은 단계)

> 2026-10-08. 지금 DB는 [supabase.md](supabase.md), 실제 정의는 `supabase/migrations/`.
> 여기 SQL은 **설계안**이다 — 기능을 만들 때 그 단계만 마이그레이션 파일로 옮긴다(안 쓰는 테이블을 미리 만들지 않음).
> 대시보드 SQL Editor 제약: 파일당 100줄 미만, `$$` 본문 안에는 따옴표를 쓰지 않는다.

## 전체 모양

```
auth.users ─┬─ profiles (1:1)            프로필·설정(settings jsonb: 소리·알림·디스플레이)
            ├─ pin_categories ─┐
            ├─ pins ───────────┘ category_id (FK 없음: 미분류 'none'·지운 카테고리)
            ├─ route_folders ──┐
            ├─ courses ────────┘ folder_id;  stops jsonb 안의 place.id ↔ pins.place.id
            ├─ days                       날짜 화면 꾸미기·선 스타일
            ├─ pings          (C, 새)     하루의 핑 하나 = 한 행
            ├─ shares         (D, 변경)   짧은 공유 링크 — 루트·하루·핀 묶음
            ├─ push_subscriptions (E, 새) 이 사람의 브라우저·폰 푸시 주소
            └─ share_milestones   (E, 새) 공유수 알림을 보낸 단계 (중복 방지 + 보낼 목록)
```

공통 규칙 (이미 있는 동기화 테이블과 같음):
- 키는 `(user_id, id)`, RLS는 `own rows`(본인 행만). 탈퇴하면 `auth.users` cascade로 전부 지워짐.
- 동기화되는 테이블은 `updated_at`(기기 시각, 둘 다 고쳤을 때 승자) + `server_updated_at`(트리거) + `deleted_at`(지움 표시) + `touch` 트리거 + `(user_id, server_updated_at)` 인덱스. 지움 표시 정리는 `purge_sync_tombstones()`에 그 테이블을 추가.
- 자주 바뀌는 모양은 jsonb, 서버에서 조회·필터할 값만 열로.
- 제외 주소(집 등)는 계속 서버에 없다.

---

## C. 핑 (`pings`) — 핑 기록 기능을 만들 때

핑 = 그날 다녀간 곳 하나(시각 + 장소). 지금은 임시 샘플(`SAMPLE_PING_DATES`)뿐이고 `days.pings` 열은 비어 있다.
**앱에서 가장 민감한 데이터(위치 기록)**라 날짜 행 안의 배열이 아니라 한 행씩 둔다 — 핑 하나만 고쳐도 그 행만 오가고, 지울 때도 그 핑만 지움 표시.

```sql
create table public.pings (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,                -- 이 핑이 보이는 날짜 화면 (한국 날짜, 앱이 정함)
  at timestamptz not null,          -- 방문 시각
  place jsonb not null check (octet_length(place::text) <= 4096),  -- PlaceRef { id, name, center, address? }
  shape text check (shape in ('pin', 'dot', 'star', 'heart')),     -- 길게 눌러 고른 모양, null = 기본
  updated_at timestamptz,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);
create index pings_day_idx on public.pings (user_id, day);
create index pings_sync_idx on public.pings (user_id, server_updated_at);
create trigger touch before insert or update on public.pings for each row execute function public.touch_sync_row();
alter table public.pings enable row level security;
create policy "own rows" on public.pings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.days drop column pings;  -- 쓰인 적 없음
```

앱 쪽에서 같이 할 것:
- **제외 주소 근처 핑은 올리지 않는다.** 서버는 제외 주소를 모르니 거를 수 없다 — 핑을 만들 때(또는 올리기 직전) `isExcluded`로 걸러 기기에만 둔다.
- 핑에 `id`가 생기므로, 지금 `pingKey`(`날짜|시각|이름`)로 저장하는 모양·선 스타일 키를 핑 id로 옮긴다: 모양은 `pings.shape`로, 선은 `days.looks.edges`의 키를 `fromId>toId`로(로컬 저장소 버전 올리고 마이그레이션).
- 동기화: `syncCollections.ts`에 `pingsCollection`, `syncBus`의 `SyncCollection`에 `'pings'`.
- 열기·장소 이름을 이벤트에 넣지 않는 규칙은 그대로(분석).

## ~~D. 공유 정리 (`shares`)~~ — 2026-10-08 적용 (`20261011000000_shares_revoke.sql`, 아래는 당시 설계)

```sql
alter table public.shares
  add column kind text not null default 'route' check (kind in ('route', 'day', 'pins')),
  add column revoked_at timestamptz,               -- 끊긴 링크: open_share가 아무것도 안 돌려줌
  add column add_count integer not null default 0, -- '루트 추가'까지 누른 수
  add column last_opened_at timestamptz;
```

- **`kind`**: 하루 링크(`#diary=`)·핀 묶음 링크도 짧은 링크로 만들 때 같은 테이블을 쓴다([todo.md](todo.md) 1·2). `course_id`는 루트일 때만.
- **루트를 지우면 링크도 끊김** — 서버 트리거로(앱 수정 없이, 다른 기기에서 지워도):
  ```sql
  create function public.revoke_shares_of_deleted_course() returns trigger
  language plpgsql security definer set search_path = pg_catalog as $$
  begin
    if new.deleted_at is not null and old.deleted_at is null then
      update public.shares set revoked_at = now()
       where owner_id = new.user_id and course_id = new.id and revoked_at is null;
    end if;
    return new;
  end
  $$;
  create trigger revoke_shares after update of deleted_at on public.courses
    for each row execute function public.revoke_shares_of_deleted_course();
  ```
  (지운 루트가 '고친 쪽이 이김'으로 되살아나도 링크는 끊긴 채 — 새로 공유하면 새 링크.)
- **`open_share`**: `where s.slug = share_slug and s.revoked_at is null`, 열 때 `last_opened_at = now()`. 끊긴 링크는 앱이 '공유 링크를 열 수 없어요'로 안내(이미 있는 깨진 링크 처리).
- **`count_share_add(share_slug text)`**: `open_share`처럼 `security definer`, 주인이 아니면 `add_count + 1`. 받은 루트 팝업의 '루트 추가'에서 부름(실패해도 무시).
- 연 사람의 IP·계정은 계속 저장하지 않는다.

## E. 알림 — 4단계 (트리거·예약 → Edge Function → Web Push)

```sql
create table public.push_subscriptions (
  endpoint text primary key check (char_length(endpoint) <= 1000),
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()  -- 앱을 열 때마다 갱신; 오래된 건 정리
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "own rows" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 공유수 알림: 루트마다 넘은 단계 한 행. 보낼 목록(sent_at null)이자 중복 방지.
create table public.share_milestones (
  owner_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  milestone integer not null check (milestone in (10, 100, 1000, 10000, 100000, 1000000)),
  reached_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (owner_id, course_id, milestone)
);
alter table public.share_milestones enable row level security;
create policy "own rows read" on public.share_milestones for select using (owner_id = auth.uid());
```

**공유수 알림** 흐름:
1. `shares.open_count`가 바뀌면 트리거가 그 루트의 모든 링크 합계를 내고, 새로 넘은 단계를 `share_milestones`에 `insert … on conflict do nothing`(같은 단계는 한 번만).
2. Database Webhook(`share_milestones` INSERT) → Edge Function `send-push`: 주인의 `profiles.settings.shareAlerts`에 그 단계가 켜져 있으면(**설정이 없으면 모두 켜짐** — 앱 기본값과 같게) `push_subscriptions`로 보냄, `sent_at` 기록. 푸시 서비스가 410(만료)을 주면 그 구독 행을 지움.
3. 알림 문구에 루트 이름은 넣되 장소·주소는 넣지 않는다.

**투데이 알림** 흐름: 테이블 필요 없음. pg_cron이 한국 시간 7·9·12·16·20·23시 정각(UTC로 22·0·3·7·11·14시)에 Edge Function을 부르고, 함수는 `settings.pingAlerts`에 그 시각이 있는(없으면 모두 켜짐) 사람에게 보냄. 인원이 많아지면 `profiles`에 `(settings -> 'pingAlerts')` GIN 인덱스.

- VAPID 비공개 키·service_role 키는 Edge Function 비밀값에만. 프론트에는 VAPID 공개 키만(`VITE_VAPID_PUBLIC_KEY`).
- 앱 안 알림함(받은 알림 목록)이 필요해지면 그때 `notifications` 테이블을 더한다 — 지금 계획엔 없음.

---

## 하지 않기로 한 것
- **장소 테이블 정규화·모두의 장소 모으기**: 장소는 핀·정류장마다 스냅샷(jsonb)으로 둔다. 외부 장소 데이터를 대량으로 쌓지 않는 원칙, 그리고 다른 사람의 위치 기록을 모으지 않기 위해.
- **사용 이벤트를 DB에 복제**: 분석은 PostHog에만([analytics.md](analytics.md)).
- **지울 때 행 내용 바로 비우기**: 지움 표시 행은 30일 뒤 `purge_sync_tombstones`가 지움(2026-10-08, pg_cron `purge-sync-tombstones` 매일 자정 UTC).

## 순서
1. ~~A·B: 바뀐 것만 받기, 크기 상한~~ (2026-10-08, `20261010000000_sync_cursor.sql`)
2. ~~D: 루트를 지우면 링크 끊기, 루트 추가 수~~ (2026-10-08, `20261011000000_shares_revoke.sql`)
3. **C** — 핑 기록 기능과 함께(제외 주소 거르기, 모양·선 키 옮기기 포함).
4. **E** — 알림 기능과 함께(서비스 워커·구독 화면·Edge Function).
