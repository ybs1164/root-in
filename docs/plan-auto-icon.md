# 계획: 공공데이터로 핀 아이콘 미리 지정하기

> 2026-10-19 작성. 작업 번호 I0, I1 … 한 번에 하나씩.

## 지금 상태와 빈칸

- 핀에는 아이콘이 없고 **카테고리**에만 있다(`PinCategory.icon`). 새 핀은 기본 **미분류**라 지도에 모두 같은 핀 글리프로 보인다.
- 장소 스냅샷 `PlaceRef.category`는 사람이 읽는 글자 하나뿐이다. 카카오는 `'음식점 > 카페 > 베이커리카페'`를 받아 **마지막 토막만** 남기고(`kakaoPlaceSearch.ts` `shortCategory`), Photon은 OSM `osm_value`(예: `park`)만 남긴다. 분류 체계가 둘이고, 위계가 버려진다.
- 지도 길게 누르기·조준으로 만든 핀은 `searchService.reverse`의 주소·건물 이름만 있어 **분류 정보가 아예 없다**.

공공데이터가 실제로 메워 주는 곳은 세 군데다: ① 길게 누르기·조준 핀(좌표만 있음), ② 카카오 키가 없을 때(MapLibre + Photon, OSM 분류가 국내에선 비어 있는 일이 많음), ③ 카카오 분류에 기대지 않는 우리만의 기준. 검색으로 고른 카카오 장소는 카카오 분류만으로도 대부분 맞힌다 — 그래서 **분류 규칙은 출처마다 따로, 결과는 하나의 중간 코드로** 모은다.

## 정해 둔 기본값 (다르면 알려 주세요)

| 항목 | 기본값 | 이유 |
|---|---|---|
| 아이콘이 쓰이는 곳 | **미분류 핀**의 지도 글리프를 장소 종류 아이콘으로(색은 그대로 `--pin-0`) + 새 핀 카드에서 같은 아이콘의 내 카테고리가 **딱 하나**면 그걸 미리 골라 둠 | 사용자가 만든 카테고리 체계를 덮어쓰지 않는다. 미분류 핀이 모두 같은 모양이던 문제만 푼다 |
| 저장 위치 | `PlaceRef.kind?: PlaceKind` (스냅샷에 같이) | "이름·주소·좌표 스냅샷" 규칙과 같은 자리. 공유 링크·동기화에도 그대로 실려 감 |
| 1차 공공데이터 | 소상공인시장진흥공단 **상가(상권)정보** (공공데이터포털 파일 데이터, 분기 갱신) | 전국 상가 약 200만~250만 곳, 좌표 + 업종 대·중·소분류 코드. 키 없이 파일로 받음 |
| 2차 공공데이터 | 공공데이터포털 **전국 표준데이터**(도시공원·공중화장실·주차장·도서관·박물관미술관 등) + 한국관광공사 **TourAPI**(관광지·문화시설·레포츠·숙박) | 상가정보에 없는 공원·산·관광지를 채움 |
| 앱이 데이터를 받는 방법 | 빌드 스크립트가 **시군구별 작은 정적 파일**로 만들어 지도 데이터와 같은 곳에 둠(`korea/places/`), 필요할 때 그 시군구 하나만 받음 | 백엔드 없음 원칙, 지도 데이터 원격 호스팅 계획(`plan-data-hosting.md`)과 같은 길. API 키를 프론트에 안 넣음 |
| 실패 시 | `kind` 없음 → 지금처럼 일반 핀 | 네트워크 서비스는 reject하지 않는다는 규칙 |

## 라벨링 구조: 출처 코드 → PlaceKind → PinIcon

두 단계로 나눈다. 출처 분류를 바로 아이콘에 붙이면 아이콘을 바꿀 때마다 표 다섯 개를 고쳐야 하고, 공유 링크에 아이콘 이름이 박힌다.

```
카카오 category_name  ┐
OSM amenity/shop/…    │  출처별 매핑 표        domain/placeKinds.ts
상가정보 소분류 코드   ├──────────────────▶  PlaceKind  ──────────▶  PinIcon
표준데이터 종류        │  (가장 구체적인 것)    ('bakery')   (KIND_ICON)  ('bread')
TourAPI 분류 코드      ┘
```

- **PlaceKind** — 앱이 정한 장소 종류 코드, 60~80개 정도. 아이콘보다 조금 잘게: `cafe`·`bakery`·`dessert`·`korean`·`chinese`·`japanese`·`western`·`chicken`·`pizza`·`burger`·`noodle`·`bar`·`pub`·`convenience`·`mart`·`clothing`·`bookstore`·`hotel`·`motel`·`camping`·`park`·`mountain`·`beach`·`museum`·`gallery`·`theater`·`cinema`·`amusement`·`hospital`·`pharmacy`·`bank`·`post`·`school`·`church`·`temple`·`gas`·`parking`·`restroom`·`station`·`bus_stop`·`airport`·`port`·`gym`·`swim`·`golf`·`bowling`·`salon`·`laundry`·`pet` …. 공유 링크·저장에 실리는 건 이 코드라, 아이콘을 다시 그려도 데이터는 그대로다.
- **KIND_ICON** — `PlaceKind → PinIcon` 한 장짜리 표. 지금 있는 89개 아이콘(`PIN_ICON_GROUPS`)으로 모두 덮는다. 예: `bakery→bread`, `dessert→cake`, `korean→food`, `chinese→noodles`, `japanese→sushi`, `pub→beer`, `motel→stay`, `temple→building`(전용 아이콘이 없으면 가까운 것), `mountain→mountain`, `bus_stop→bus`.
- **출처별 매핑 표** — 출처 코드(또는 경로 접두어) → PlaceKind.
  - 카카오: `category_name`의 **경로 접두어**로 맞춘다. 가장 긴 접두어가 이긴다: `'음식점 > 카페 > 베이커리카페'` → `bakery`, `'음식점 > 카페'` → `cafe`, `'음식점'` → `korean`이 아니라 `restaurant`(일반 식당). 카카오 그룹 코드(`CE7` 카페, `FD6` 음식점, `AT4` 관광명소, `CT1` 문화시설, `CS2` 편의점 …)는 경로가 안 맞을 때의 마지막 대체.
  - 상가정보: **소분류 코드**마다 하나(약 250개). 코드 하나도 빠짐없이 표에 있어야 한다 — 모르겠으면 명시적으로 `null`(일반 핀).
  - OSM(Photon): `amenity`·`shop`·`tourism`·`leisure`·`natural` 키·값 쌍.
  - 표준데이터: 파일 종류가 곧 종류(`도시공원` → `park`, `공중화장실` → `restroom`).
  - TourAPI: 분류 코드 → PlaceKind.

### 표를 만드는 방법 (사람 손이 드는 곳)

1. 원본 분류 목록을 그대로 뽑는다: 상가정보 소분류 코드·이름 전체, 카카오 경로는 테스트 검색 결과 + 알려진 목록, TourAPI 분류표.
2. 스크립트가 **키워드 규칙으로 초안**을 채운다(`카페`→`cafe`, `제과|베이커리`→`bakery`, `치킨`→`chicken` …). 규칙에 안 걸리면 빈칸.
3. 사람이 CSV(`scripts/place-kinds/mapping-<출처>.csv`: `code, name, kind, note`)를 훑어 고친다. 소분류 약 250줄이라 한두 시간.
4. CSV → `src/domain/placeKinds.data.ts`를 생성(손으로 안 고침). 테스트가 지킨다:
   - 모든 `kind`가 `PlaceKind`에 있고, 모든 `PlaceKind`가 `KIND_ICON`에 있고, 모든 아이콘이 `PIN_ICONS`에 있다.
   - 상가정보 소분류 코드가 **하나도 빠짐없이** 표에 있다(새 분기 데이터에 코드가 추가되면 빌드가 깨져서 알게 됨).
5. **평가 세트**: 실제 장소 200곳(동네·종류를 섞어서, 이름·좌표·사람이 정한 정답 kind)을 `src/test/fixtures/placeKinds.eval.json`에 두고 맞힌 비율을 테스트에서 잰다. 목표: 아이콘 기준 90% 이상, **틀린 아이콘보다 일반 핀이 낫다** — 확신이 없으면 `null`.

## 공공데이터를 장소에 붙이는 방법 (좌표 + 이름 맞추기)

상가정보에는 카카오 장소 id가 없다. 그래서 **가까이 있고 이름이 비슷한 것**을 찾는다.

- 후보: 핀 좌표에서 **40m 안**의 상가.
- 이름 비교: 공백·괄호·`(주)`·지점명(`성수점`) 떼고 정규화한 뒤 포함 관계 또는 글자 bigram 유사도 0.6 이상.
- 길게 누르기·조준(이름이 없거나 건물 이름뿐): 이름 비교 없이 **15m 안의 상가가 한 종류뿐**일 때만 붙인다. 같은 건물에 카페·식당·미용실이 섞여 있으면 `null`. (I0 측정: 상가 근처의 약 19%만 이 조건에 맞음 — 보너스로 여긴다.)
- 상호명 키워드(치킨·카페·베이커리·마라탕 …)가 있으면 업종 코드보다 먼저 본다 — 원본 업종이 틀린 행이 있다.
- 우선순위: 카카오 경로 매칭 > 상가정보(이름 일치) > TourAPI·표준데이터 > OSM > 상가정보(거리만) > `null`.

## 작업

### I0. 데이터 확인 ✅ 2026-10-19 — 결과는 [scripts/place-kinds/README.md](../scripts/place-kinds/README.md)
- 상가정보 20260630: 277만 곳, 소분류 247개, WGS84, 이용허락 제한 없음, 시군구 256개 → gzip 약 42MB(파일 중간 141KB).
- 상가정보엔 공원·관광지·영화관·학교·은행 등이 **없다** → I7(표준데이터·TourAPI)의 비중이 계획보다 크다.
- 좌표만으로는 15m 안 상가의 81%가 다른 업종과 섞여 있어, 길게 누르기 핀에서 답이 나오는 건 약 19%. 이름 비교가 주력.
- 업종이 틀린 행이 있어(치킨집이 `백반/한정식`) 상호명 키워드를 업종 코드보다 먼저 본다.
- TourAPI: 이용허락 제한 없음, 개발 키 하루 1,000회 — 사용자가 활용 신청해야 함.

원래 할 일:
- 상가정보 최신 분기 파일 받아 열 이름·업종 코드 체계·행 수·좌표계(WGS84인지)를 확인하고 `scripts/place-kinds/README.md`에 적는다. 2023년쯤 업종 분류가 바뀌었으니 **지금 코드 체계** 기준으로 한다.
- 라이선스: 공공누리 유형 확인 → 출처 표시 문구를 프로필의 약관 및 정책 자리(`terms`)에 넣을 목록에 적는다. TourAPI는 키 발급·이용 조건(출처 표시, 상업 이용) 확인.
- 크기 추정: 시군구별로 나눈 압축 파일 크기 → `plan-data-hosting.md`의 용량 표에 더한다.

### I1. PlaceKind와 아이콘 표 ✅ 2026-10-19
- `src/domain/placeKinds.ts`: kind 99개, `KIND_ICON`·`isPlaceKind`·`kindIcon`.
- `scripts/place-kinds/mapping-semas.csv`: 소분류 247개 중 137개에 kind(상가 277만 곳 중 194만 곳 = 70%), 110개는 일반 핀(부동산·컨설팅·학원·수리 등). 초안은 `draft_semas_mapping.py`의 키워드 규칙으로 만들었고 **사람 검토 전** — `note` 열이 판단이 갈린 줄.
- 테스트(`placeKinds.test.ts`): 모든 kind의 아이콘이 고르기 목록에 있음, 247개 코드 빠짐없이 한 번씩, CSV의 kind가 모두 알려진 값.

원래 할 일:
- `src/domain/placeKinds.ts`: `PlaceKind` 유니온, `KIND_ICON`, `kindIcon(kind)`.
- 테스트: 모든 kind에 아이콘, 모든 아이콘이 `PIN_ICONS`에 있음.

### I2. 카카오·OSM 분류 → kind ✅ 2026-10-19
- `src/domain/placeKindRules.ts`: `kindFromKakao(경로, 그룹 코드)` — 경로를 `>`로 나눠 **가장 깊은 토막부터** 토막 하나 전체에 패턴을 맞춤(끝의 브랜드 이름은 자연히 건너뜀), 아무것도 안 맞으면 그룹 코드(`CE7`·`FD6`…), 그래도 없으면 `null`. `kindFromOsm(key, value)` — 키·값 표.
- `PlaceRef.kind?` 추가, 카카오·Photon 검색 결과가 채움(`category` 글자는 그대로). 카카오 경로 표는 알려진 예시로 만든 것이라 실제 검색 결과로 I8 평가 때 다시 본다.
- 아직 공유 링크·동기화 행 변환은 필드를 골라 담아서 `kind`가 **빠진다** — I3에서 싣는다. 기기 저장(localStorage)에는 핀 스냅샷과 함께 남는다.

원래 할 일:
- `KakaoPlaceResult`에 `category_group_code` 타입 추가. `toPlaceRef`가 **전체 경로**로 `kindFromKakao()`를 불러 `place.kind`를 채운다(`category` 글자는 지금처럼 마지막 토막).
- `photonPlaceSearch.ts`도 `osm_key`·`osm_value`로 `kindFromOsm()`.
- 이것만으로 검색으로 꽂은 핀 대부분이 맞는 아이콘을 갖는다 — 공공데이터 없이 먼저 출시해 볼 수 있는 단계.
- 테스트: 경로 접두어 우선순위, 모르는 경로 → `null`.

### I3. 저장·공유·동기화에 `kind` 싣기 ✅ 2026-10-19
- 공유 링크: 코스(`#share=` v2)·하루(`#diary=`)·핀 묶음(`#pins=`)의 정류장·핀에 선택 필드 `y`(PlaceKind). 버전은 그대로 — 옛 링크는 `y`가 없을 뿐, 옛 디코더는 모르는 필드를 무시. 디코드는 `isPlaceKind`를 통과한 값만 받는다.
- 동기화: 핀은 `place` jsonb에 그대로 실려 올라가고, 받을 때 `cleanPlaceKind`로 모르는 값을 지움. 루트 정류장(`stopFrom`)도 `kind`를 골라 담음. 서버 스키마 변경 없음.
- 기기 저장: 핀은 불러올 때(`readStoredPins`) 모르는 `kind`를 지움. 루트 저장소는 원래 검사 없이 읽는 곳이라 그대로 두었다 — 화면에 쓰는 `kindIcon`이 모르는 값을 `null`로 막는다.
- 테스트: `src/services/placeKindTransport.test.ts`.

원래 할 일:
- `PlaceRef.kind?`. 불러오기·공유 링크 디코드에서 **목록에 있는 값만** 받고 나머지는 버림(받은 데이터는 신뢰하지 않음). 옛 링크는 `kind` 없이 그대로 열림 — 디코드 테스트.
- `syncCollections.ts`의 핀 행 변환에 `kind` 추가(Supabase 마이그레이션에 열 하나 또는 place JSON 안).
- localStorage 형식은 필드 추가뿐이라 키 버전은 그대로.

### I4. 미분류 핀에 kind 아이콘 ✅ 2026-10-19
- `domain/pin.ts` `pinStyle(categories, categoryId, place)`: 미분류(지워진 카테고리 포함)면 `kindIcon(place.kind) ?? 'pin'`, 색은 `--pin-0` 그대로. 사용자 카테고리는 언제나 그 카테고리 모양. 지도 마커·핀 카드 GROUP 칸·경로 정류장 모양·공유 카드 아이콘이 이걸 씀(고르기 목록은 그대로 `categoryStyle`).
- `suggestCategory(categories, kind)`: kind 아이콘과 같은 아이콘의 내 카테고리가 딱 하나면 그 id, 아니면 미분류. 새 핀 카드가 처음 그룹으로 쓰고, kind가 늦게 붙어도(I6) 손으로 고르기 전이면 다시 맞춤.
- 확인(모바일 375px, Photon 흉내): 공원→나무, 빵집→빵, 호프→맥주, kind 없음→핀, 카페 카테고리 핀은 kind와 상관없이 카페 컵; 검색한 카페는 '카페' 그룹으로, 공원은 미분류 + 나무로 시작.
- 남은 것: 새 핀 카드가 떠 있는 동안 지도의 미리보기 마커는 여전히 일반 핀(`courseMap` preview 변형) — 바꾸려면 `CourseMap` 인터페이스에 아이콘을 넘겨야 함.

원래 할 일:
- `categoryStyle`/지도 마커가 미분류 핀이면 `kindIcon(pin.place.kind) ?? 'pin'`. 색은 `--pin-0` 그대로.
- 새 핀 카드: `kind` 아이콘과 같은 아이콘을 가진 내 카테고리가 딱 하나면 그룹 기본값으로(여럿·없음이면 미분류).
- `npm run shots`로 지도·카드 확인.

### I5. 상가정보 빌드 스크립트 ✅ 2026-10-19
- `scripts/place-kinds/build_places.py --src <zip>` → `public/korea/places/<시군구>.json` 256개 + `index.json`. 사용법·파일 모양·이름 정규화는 [scripts/place-kinds/README.md](../scripts/place-kinds/README.md).
- 20260630: 192만 곳, gzip 24.5MB(파일 중간 86KB). 계획 때 추정(42MB)보다 작다 — kind 없는 업종과 중복을 뺐다.
- 이름 정규화 예시는 `name-cases.json` — I6의 TS 정규화 테스트도 이 파일을 읽어 두 쪽이 같게 한다.
- 계획과 다른 점: 술집 업종은 상호명 낱말로 바꾸지 않는다(유흥 주점 이름의 "카페").

원래 할 일:
- `scripts/place-kinds/build_places.py`: CSV → 소분류 코드를 kind로(I1~I2의 생성된 표 공유) → `kind`가 `null`인 행 버림 → 시군구 코드별 `korea/places/<sigungu>.json`
  - 행 모양: `[정규화한 이름, 경도×1e5 정수, 위도×1e5 정수, kind 번호]` — 숫자 배열로 작게.
  - 매장 원본 이름·주소·전화 같은 건 넣지 않는다(맞추기에 필요한 것만).
- 파이썬 테스트: 코드 매핑 누락 시 실패, 좌표 국내 범위.

### I6. 앱에서 공공데이터로 보충 ✅ 2026-10-19
- `domain/placeMatch.ts`: `normalizePlaceName`(build_places.py와 같은 규칙 — `name-cases.json`을 두 쪽 테스트가 같이 읽음), `namesMatch`(같음 · 2자 이상 포함 · 글자쌍 유사도 0.6), `matchKind`(40m 안 이름 맞는 가장 가까운 곳 → 아니면 고른 지점일 때만 15m 안이 한 종류).
- `services/placeKindService.ts`: 점 → 시군구 코드(`StaticAdminAreaService.sggCodeAt` — korea/admin의 시군구 코드가 상가정보와 256개 모두 같음) → `korea/places/<코드>.json` 하나(메모리 캐시) → `matchKind`. 실패는 모두 `null`. 고른 지점(`pin:` id)의 이름이 주소이거나 아직 '지정한 위치'면 이름 비교를 안 한다(주소엔 가게 이름이 너무 많이 들어 있음).
- App: 새 핀 카드의 장소에 `kind`가 없으면 찾아서 채움, 이름이 늦게 붙으면 그 이름으로 다시. 카드는 I4대로 아이콘·그룹 제안을 따라감.
- 확인(375px, Photon 흉내, 실제 성동구 파일): OSM 분류가 없는 검색 결과 '에이플러스에이'(15m 안 다른 업종 5곳) → 이름으로 피자; 이름 없는 조준 지점(40m 안 빵집 하나) → 빵.
- 한계: 시군구 경계 40m 안의 가게는 옆 시군구 파일에 있으면 못 찾음. 카카오 검색 결과는 대개 이미 kind가 있어 조회하지 않음.

원래 할 일:
- `services/placeKindService.ts`: `PlaceKindService.lookup(center, name?) → Promise<PlaceKind | null>`. 좌표 → 시군구(이미 있는 행정구역 데이터로) → 그 파일 하나 fetch(메모리 캐시) → 위 맞추기 규칙. 실패하면 `null`, reject 안 함.
- 언제 부르나: `kind`가 없는 장소로 새 핀 카드를 열 때(길게 누르기·조준·Photon 결과). 카드가 떠 있는 동안 답이 오면 아이콘이 바뀜.
- 테스트: `vi.stubGlobal('fetch')`로 파일 흉내, 이름 일치·거리만·여러 종류 섞임 → `null`.

### I7. 표준데이터·TourAPI (선택, 하루씩)
- 표준데이터(공원·화장실·도서관·박물관)는 I5 스크립트에 출처만 추가.
- TourAPI는 키가 필요하므로 **빌드 때만** 스크립트에서 받아 파일로 굳힌다(프론트·저장소에 키 없음, `.env.local`의 스크립트 전용 변수).

### I8. 측정 (2시간)
- 평가 세트 정확도 테스트(I1의 5번).
- PostHog: 새 핀을 꽂을 때 `kind` 출처(`kakao`·`public`·`osm`·`none`)와 사용자가 그룹을 바꿨는지 — 장소 이름·좌표는 넣지 않음, `EventProps`·`docs/analytics.md`에 추가.

## 하지 않을 것
- 카카오 장소 데이터 대량 수집·캐시 (기존 규칙).
- 사용자가 이미 정한 카테고리를 자동으로 바꾸기.
- 서버 API로 실시간 조회(공공 API 키를 프론트에 둘 수 없고, 백엔드 없음 원칙).
