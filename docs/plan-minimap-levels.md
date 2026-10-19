> **지난 계획(2026-10-19).** 지금은 상세 하나·중간 거리 하나만 남았다 — [plan-minimap-design.md](plan-minimap-design.md) 맨 위 결정 참고.

# 미니맵 추상화 단계 분리 계획 — 거리 × 지도 형태

> 2026-10-14 작성·구현. 거리는 3단계에서 **5단계**로 바꿈: 구간(핑→다음 핑)마다 방향은 두고 길이를 '구간 길이의 기하평균' 대비 거듭제곱(0 균등 · 0.25 강하게 · 0.5 중간(기본) · 0.75 약하게 · 1 실제, `legLayout`), 실제 지도는 핑의 이동을 거리 역제곱 가중으로 따라 휨(`bendField`). 지도 방향은 하루에 하나(중간 단계 기준). 실제가 아닐 때 상세는 핑 묶음(1.5km)마다 그 주변 동만 섬으로(`lumpAreas` power), 데이터는 묶음마다 따로 받아 합침(`terrainService`). 아래 3장의 3단계 표는 첫 구현 기록.

## 1. 지금 단계를 정하는 곳

| 위치 | 하는 일 |
|---|---|
| `src/domain/miniMap.ts:17` `MiniMapId` · `MINI_MAPS` | 단계 하나의 축: `none`(없음) → `blob`(덩어리) → `streets`(거리) → `whole`(지도) → `detail`(상세) |
| `src/domain/miniMap.ts:28` `nextMiniMap` | 날짜 화면 스위치 한 번에 다음 단계로 순환 |
| `src/domain/miniMap.ts:313` `miniMapLayers` | 추상 형태(덩어리·거리·지도)의 땅 모양 생성 |
| `src/domain/miniMap.ts:547` `terrainParts` | 상세 = 실제 읍면동 도형 |
| `src/domain/miniMap.ts:502` `viewPoints` | **핑 위치**를 정함: `detail`이면 `uniformProjection`(실제 비율 + 회전 `bestBearing`), 아니면 `layoutPings` |
| `src/domain/dayPings.ts:84` `layoutPings` | 가로·세로를 **각각** 최소~최대로 늘려 상자를 채움 (거리 비율이 깨짐) |
| `src/components/DayPings.tsx` | `miniMap` → `useTerrain` → 데이터가 없으면 `detail`을 `whole`로 대체 |
| `src/components/CalendarZoom.tsx` `onMap` | 날짜 화면 ↓ 스위치 줄의 지도 버튼(순환) |
| `src/components/DecorTools.tsx` `MAP_TOOL` · `DecorTray` `minimap` | 꾸미기 화면의 미니맵 카드 창 |
| `src/lib/shareImage.ts` `drawMiniMap` · `renderShareImage` | 공유 이미지에 같은 단계를 그림 (detail 실패 → whole) |
| `src/services/dayRepository.ts` `readDecor` | `DayDecor.miniMap` 저장·검증 |

## 2. 문제: 한 축에 두 가지가 섞여 있다

`MiniMapId` 하나가 사실은 두 가지를 동시에 바꾼다.

1. **거리(배치) 추상화** — 핑끼리의 거리를 얼마나 실제대로 보여 주나
   - `none`·`blob`·`streets`·`whole`: `layoutPings` — 축마다 따로 늘림. 방향 순서만 맞고 거리 비율은 무시.
   - `detail`: `uniformProjection` — 한 배율, 실제 비율(회전만 허용).
2. **지도 형태 추상화** — 땅을 얼마나 실제처럼 그리나
   - 덩어리(원 + 막대) → 거리(덩어리 + 가짜 격자) → 지도(하나의 둥근 땅) → 상세(실제 읍면동).

그래서 생기는 문제:
- "실제 거리 비율로 보되 땅은 둥근 덩어리"나 "상세 지도인데 핑은 고르게 퍼짐" 같은 조합이 불가능.
- 상세 데이터가 없을 때 `whole`로 대체되면 **형태만이 아니라 거리 배치도 같이 바뀌어** 핑이 튀어 버린다.
- 덩어리의 뭉침 기준 `CHUNK_GAP = 0.95`가 늘린 단위 상자 기준이라 실제 거리와 무관하다(사실상 거의 항상 한 덩어리).

## 3. 목표 모델: 두 축

### 거리 단계 `MapDistance`
| id | 이름 | 배치 |
|---|---|---|
| `relative` | 고르게 | 지금의 `layoutPings` (축별 늘림, 상자를 꽉 채움) |
| `squashed` | 압축 | 실제 방향 유지, 중심에서의 거리를 `r → r^0.5`(또는 log)로 눌러 먼 곳은 당기고 가까운 곳은 벌림 — 한 동네 + 먼 한 곳 같은 날에 핑이 뭉치지 않게 |
| `true` | 실제 | `uniformProjection` (한 배율, `bestBearing` 회전) |

### 형태 단계 `MapShape`
`none` · `blob` · `streets` · `whole` · `detail` — 지금 `MiniMapId`를 그대로 형태 축으로 쓴다.

### 핵심: 투영 하나를 핑과 땅이 같이 쓴다
세 거리 단계는 모두 **연속 함수**(축별 아핀, 방사 왜곡, 회전+배율)이므로 `LonLat → MapPoint` 투영 함수 하나로 표현할 수 있고, 그 함수를 핑에도 실제 읍면동 도형에도 똑같이 적용하면 **모든 조합이 가능**하다. (예: `relative × detail` = 실제 읍면동을 축별로 늘린 지도 — 형태가 찌그러지는 것 자체가 추상화.)

```ts
// domain/miniMap.ts
export type MapDistance = 'relative' | 'squashed' | 'true';
export interface MiniMapView { distance: MapDistance; shape: MiniMapId }

/** 거리 단계별 투영: 핑과 (있다면) 땅 도형의 바깥 점 `reach`까지 상자에 맞춤. 기울임은 마지막에. */
export function stopProjection(centers: LonLat[], distance: MapDistance, reach: LonLat[] = []): (c: LonLat) => MapPoint;
```

- `viewPoints(centers, view, terrain)` → `stopProjection` + `tiltPoint`. `style === 'detail'` 분기를 없앤다.
- `terrainParts(shapes, centers, project)` → 투영을 인자로 받음(지금의 `terrainProject`는 `distance: 'true'` 경우가 됨).
- `miniMapLayers(points, shape)`는 이미 화면 점을 받으므로 그대로.
- **대체(fallback)는 형태만**: 상세 데이터가 없으면 `shape`만 `whole`로, `distance`는 그대로 → 핑이 안 튐.
- 덩어리 뭉침은 **실제 미터**로 판단(예: 600m 이내면 한 덩어리, `CHUNK_GAP_M`) — 거리 단계를 바꿔도 덩어리 구성이 같다. 원 반지름은 화면 기준 그대로.

## 4. 작업 순서

1. **도메인 분리** (`domain/miniMap.ts`)
   - `MapDistance`, `MAP_DISTANCES`(라벨 고르게·압축·실제), `isMapDistance`, `nextMapDistance`.
   - `stopProjection` 구현: `relative` = `layoutPings`를 함수형으로(`min/max` 고정 후 임의 좌표에 적용 가능하게), `squashed` = 중심·최대 반경 기준 방사 왜곡 후 상자 맞춤, `true` = 지금 `uniformProjection` + `bestBearing`.
   - `viewPoints`·`terrainParts` 시그니처 변경, `clusterPoints`에 미터 기준 버전.
   - `dayPings.layoutPings`는 남겨 두고(다른 곳에서도 씀) 내부에서 공용 함수 사용.
2. **저장** (`domain/decor.ts`, `services/dayRepository.ts`)
   - `DayDecor.mapDistance?: MapDistance` 추가(없으면 기본).
   - 기본값은 옛 데이터와 같게 보이도록: `miniMap === 'detail'`이면 `true`, 아니면 `relative` (`defaultDistance(shape)`). 필드가 선택값이고 없을 때 이렇게 유도하므로 `goodroot:days:v1` 버전은 안 올림.
   - `isBlankDecor`에 `mapDistance` 추가. 동기화 행 변환(`syncCollections.ts`)이 `decor`를 통째로 싣는지 확인하고, 필드 목록을 쓰면 같이 맞춤.
3. **날짜 화면** (`CalendarZoom.tsx`, `DayPings.tsx`, `DecorTools.tsx`)
   - ↓로 펼치는 스위치 줄에 버튼 둘: 지도 형태(지금 버튼, 형태만 순환) + 거리(새 버튼, 고르게 → 압축 → 실제 순환; 형태가 `none`이면 핑 배치만 바뀜). 아이콘 후보: 형태 `Map`, 거리 `Ruler`.
   - `DayPings`: `useTerrain`은 `shape === 'detail'`일 때만, 투영은 `distance`로.
4. **꾸미기 화면** (`ShareStudio.tsx`, `DecorTray` `minimap`)
   - 창 맨 위에 거리 3칸 알약 줄(고르게·압축·실제), 그 아래 지금처럼 형태 미리보기 격자 — 미리보기는 고른 거리 단계로 다시 그림(`mapPreviews` 의존성에 `mapDistance`).
5. **공유 이미지** (`lib/shareImage.ts`)
   - `drawStops`·`drawMiniMap`에 `view` 전달, 대체는 형태만.
6. **테스트** (`domain/miniMap.test.ts`)
   - 거리 단계: `true`는 두 구간 길이 비율이 실제와 같음(회전 무관), `relative`는 지금 `layoutPings`와 같은 결과, `squashed`는 방향(각도) 유지 + 먼 핑 비율이 줄어듦.
   - 같은 `distance`면 핑 위치가 형태와 무관(`viewPoints`가 shape에 안 바뀜) — 대체 시 안 튀는 것 보장.
   - `relative × detail`: 투영된 읍면동 안에 그 핑이 들어 있음.
   - 저장: 옛 `{ miniMap: 'detail' }` → `distance: 'true'`, `{ miniMap: 'blob' }` → `relative`.
   - 덩어리 뭉침이 미터 기준이라 거리 단계를 바꿔도 덩어리 수가 같음.
7. `npm run check`, 모바일 375px로 날짜 화면·꾸미기 화면 확인, `npm run shots`.

## 5. 정할 것 (결정 필요)

- **조합 제한 여부**: 모든 조합 허용(권장 — 투영 공용화로 비용이 거의 없음) vs `detail`은 `true`만.
- **압축 함수**: `sqrt`(권장, 자연스러움) vs `log`(차이가 큰 날에 강함). 테스트 데이터로 비교 후 결정.
- **스위치 두 개 vs 하나**: 날짜 화면 스위치 줄이 4개로 늘어난다. 하나로 두려면 형태 순환은 짧게 탭, 거리는 길게 눌러 말풍선(핑 모양 고르기와 같은 `folder-picker`)도 가능.
- **기울임(tilt)**: 지금은 모든 형태에 고정 적용. 세 번째 축(정면/비스듬히)으로 뺄지는 이번 범위 밖.
