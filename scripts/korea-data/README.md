# 전국 다각형 지도 데이터

대한민국 전체 Geofabrik/OpenStreetMap 추출본을 수집하고, 도로 사이의 땅을 단순한 다각형으로 만들어 앱에 포함한다. 특정 도시나 검색 결과만 수집하는 방식이 아니다.

## 수집·검증 결과

- 전체 도로 객체: **1,816,596건**. 원본 PBF와 수집 파일 ID 대조에서 누락·추가·중복 모두 0건.
- 도형으로 만들 수 없는 좌표 1개짜리 객체 1건도 수집본에 보존한다.
- 닫힌 OSM 섬 해안선 3,938개, 물 영역 29,047개를 반영한다.
- 정적 지도 파일은 총 **5,343개**, 약 **498.9MB**다. 앱은 현재 화면에 필요한 파일만 읽으며, 배포 시 `public/korea` 전체를 포함해야 한다.
- 네 단계 합계 **887,484개** 다각형이다. 이 합계는 확대 단계별 표현을 합한 수이며 실제 도시 블록의 고유 개수가 아니다.
- 앱 타입 검사, 테스트 179개 및 구역 생성 회귀 테스트 6개 통과. 구역 중심 생성 방식으로 변경 후 서울 상세와 제주를 모바일·데스크톱에서 확인했으며, 실제 화면의 구역 면적 생략 기준도 검사했다.

| 단계 | 파일 수 | 다각형 수 |
|---|---:|---:|
| 거리 | 4,921 | 826,297 |
| 도시 | 392 | 47,565 |
| 광역 | 26 | 10,954 |
| 전국 | 4 | 2,668 |

## 재생성

```powershell
python -m pip install -r scripts/korea-data/requirements.txt
python scripts/korea-data/build.py
python scripts/korea-data/test_blocks.py
python scripts/korea-data/audit.py
python scripts/korea-data/validate.py
npm run check
npm run build
```

개발 서버가 실행 중이면 `node scripts/korea-data/preview.mjs`로 전국·서울·부산·제주·울릉도·독도를 모바일과 데스크톱에서 확인하고 `ui-shots/korea`에 저장한다. 기본 서버는 `http://localhost:5188`, 브라우저는 설치된 Microsoft Edge다. `SHOTS_URL`, `BROWSER_CHANNEL` 환경 변수로 바꿀 수 있다. 키 없는 MapLibre 실행 환경에서 사용한다.

전체 도로 수집이 이미 완료된 경우 `python scripts/korea-data/build.py --reuse-roads`로 원본 도로 파일을 재사용해 도형만 다시 만들 수 있다. 고정된 원본의 예상 도로 건수도 확인한다. 일부 단계만 바꿀 때는 `--levels city,region`을 추가한다. 기존 manifest가 있어야 하며, 지정하지 않은 단계는 유지한다.

중단 후에는 `--resume`을 추가하면 동일한 원본·경계·도로 등급·면적 기준으로 생성이 완료된 타일을 재사용한다. 타일 4개를 병렬 처리하며, 각 파일은 임시 파일에서 원자적으로 교체한다. `validate.py`는 타일별 생성 기준이 현재 기준과 일치하는지도 검사한다.

- 원본: https://download.geofabrik.de/asia/south-korea-260929.osm.pbf
- 기준 시각: 2026-09-29T20:22:51Z. 공식 MD5를 확인한 뒤 처리한다.
- `data/korea/south-korea.osm.pbf`: 전체 국내 OSM 원본. Git에서는 제외한다.
- `data/korea/roads.jsonl`: 모든 `highway` way의 ID, 태그, 전체 좌표를 보존한 수집 결과. 공사 중 도로·터널 등도 포함한다.
- `public/korea/manifest.json`: 원본 SHA256, 도로 분류별 건수, 누락된 도형 수, 표현 단계별 파일 목록 및 다각형 수.
- `public/korea/{detail,city,region,country}/*.json`: 앱에서 현재 화면에 필요한 지역만 읽는 정적 다각형 파일. 배포에 반드시 포함한다.

## 표현

| 표시 범위 (타일 단계) | 화면 축척 | 격자 크기 | 도로 틈 너비 | 도형 단순화 | 도로 범위 |
|---|---:|---:|---:|---:|---|
| 읍·면·동 / 생활권 (`detail`) | 12m/px 미만 | 0.05° | 18m | 2m | 생활도로·보행로·서비스도로·산책로까지 |
| 시·군·구 (`city`) | 12 이상 ~ 60m/px 미만 | 0.2° | 65m | 8m | `tertiary` 이상과 해당 연결도로; 주거도로·골목·보행로 생략 |
| 시·도 (`region`) | 60 이상 ~ 250m/px 미만 | 1° | 300m | 40m | `secondary` 이상과 해당 연결도로; `tertiary` 이하 생략 |
| 전국 (`country`) | 250m/px 이상 | 4° | 1,300m | 150m | `motorway`, `trunk`, `primary`와 해당 연결도로 |

행정 단위는 표시 범위를 설명하는 기준이며, 행정 경계나 법정 도로 분류(국도·지방도·시도 등)를 판정하는 것은 아니다. 가져온 OSM `highway` 등급에 따라 도로를 선별한다. 확대하면 하위 도로를 추가하고 축소하면 생략한다. 화면 가로 폭과 위도를 반영한 m/px를 사용하므로 두 지도 SDK와 모바일·데스크톱에서 같은 축척 기준을 적용한다. 요청할 파일이 48개를 초과하면 다음 축소 단계로 전환한다. manifest의 `scaleLabel`, `maxMetersPerPixel`, `roadClasses`에서 생성 기준을 확인할 수 있다.

### 구역 기준의 표현과 생략

지도는 도로선을 직접 그리지 않고 **도로가 나누는 구역(다각형)**을 채워 표현한다. 도로 교차점을 연결한 뒤 육지 경계와 함께 닫힌 구역을 구성한다. 구역을 실제로 나누지 않는 막다른 가지, 독립된 선, 고리에 진입하는 줄기 도로는 버퍼를 만들기 전에 제거한다. 따라서 큰 구역 내부로 파고드는 도로 틈이 생기지 않는다. 구역을 나누는 통과 도로와 닫힌 고리의 경계는 유지한다.

정적 데이터 생성 단계에서는 면적 기준 생략을 제거했다. 작은 구역도 유지하고, 오목한 구역과 물 구멍이 있는 구역을 구멍 없는 볼록 다각형들로 나눈다. 인접 구역의 합집합이 볼록할 때만 병합하며, 더 이상 볼록하게 합칠 수 없는 상태까지 반복한다. 원본 데이터의 도로 버퍼와 바다·강·호수는 비워 둔다. 화면에서는 아래의 큰 묶음 정책을 추가로 적용한다.

여유 영역에서 먼저 구역을 생성하고 타일로 자르기 전 `areaM2`를 기록한다. 여유 영역 너머로 이어지는 구역은 `continuesBeyondTile`로 표시한다. 타일 경계의 작은 조각도 그대로 유지한다. 수역은 주변 볼록 다각형들 사이의 빈 공간으로 보존한다. `blockPolicy`는 `convex-complete-v3`, `minBlockAreaM2`는 0이다.

화면 표시 단계는 `src/domain/districtRendering.ts`에서 수행한다. 원본 조각의 개수가 아니라 균일한 화면 격자의 육지 점유를 표본으로 사용한다. 가장 멀리 떨어진 표본으로 중심점을 초기화하고 Lloyd 반복으로 약 24개의 묶음을 고르게 배치한다. 중심점 사이의 볼록 Voronoi 셀을 만든 뒤 경계 양쪽을 2.5 CSS px씩 줄인다. 묶음 내부의 작은 도로·삼각형 변·타일 이음새는 표시하지 않는다.

각 셀은 큰 원으로 침식한 뒤 같은 원으로 다시 팽창시키는 opening으로 둥글게 만든다. 내접 반경의 90%를 공통 곡률로 사용하므로 짧은 변에 붙은 뾰족한 끝이 남지 않는다. 전국·해안·섬 화면에서는 묶음별 육지 표본 범위로 셀을 제한해 바다 전체를 채우지 않는다. 세부 해안선과 내부의 작은 수역·도로는 시각적으로 일반화되며, 남은 경계는 실제 도로 중심선을 의미하지 않는다. 실제 이동 경로 안내에는 사용하지 않는다.

이동·줌 변경마다 화면 좌표로 다시 묶는다. 보통 화면당 24개이며 육지 표본이 거의 없는 화면은 더 적을 수 있다. 큰 구역 사이의 기본 간격은 줌과 관계없이 5 CSS px이고, 둥근 모서리 사이와 바다는 더 넓다. 작업은 Worker에서 수행하며 이전 화면 요청은 취소한다. `districtRendering.test.ts`와 `preview.mjs`에서 구역 수, 볼록성, 둥근 정도, 줌별 간격을 확인한다.

## 행정구역 지도 (`public/korea/admin`) — 앱이 실제로 그리는 데이터

앱은 도로로 땅을 나누지 않고 **행정구역**으로 나눈다. 화면 가운데(모바일 핀 화면에서는 위 시트에 가리지 않은 부분의 가운데)에 있는 구역 하나만 한 단계 아래로 나눠 진하게 그리고, 주변은 속을 생략한 통짜 모양으로 옅게 그린다.

| 화면 축척 | 가운데 구역 → 나누는 단위 | 주변 |
|---|---|---|
| 120m/px 이상 | 시도 → 시군구 | 다른 시도 |
| 8 ~ 120m/px | 시군구 → 읍면동 | 다른 시군구 |
| 8m/px 미만 | 읍면동 → 구획 | 다른 읍면동 |

**구획**: 읍면동 아래에는 공개 경계가 없어서, 읍면동을 주요 도로(tertiary 이상)로 먼저 자르고, 그래도 15만㎡보다 큰 조각은 생활도로(residential·unclassified)로 한 번 더 자른다. 면을 닫지 못하는 막다른 길은 자르지 않는다. 작은 조각(1차 2만㎡·읍면동의 1.5%, 2차 4만㎡·2.5% 미만)은 가장 길게 맞닿은 이웃에 합친다. 전국 23,432개, 도시 읍면동 하나에 보통 5~9개.

```powershell
python scripts/korea-data/build_admin.py
```

- 원본: [vuski/admdongkor](https://github.com/vuski/admdongkor) `HangJeongDong_ver20260701.geojson` → `data/korea/`에 받아 둔다. 통계청 SGIS 행정동 경계(공공누리 제1유형, 출처표시) 기반이며 가공분은 CC BY 4.0. 지도에 출처를 표시한다.
- 출력: `sido.json`(시도 전체), `sgg/<시도코드>.json`(그 시도의 시군구), `dong/<시군구코드>.json`(그 시군구의 읍면동), `section/<시군구코드>.json`(그 시군구 읍면동들의 구획, 코드 `<읍면동코드>-<번호>`). 구획용 도로는 `roads.jsonl`에서 뽑아 `data/korea/section-roads.pkl`에 캐시한다. 일반구(수원시 권선구 등)는 시군구 하나로 친다. 시군구·시도 모양은 읍면동을 합쳐서 만든다. 합계 약 32MB이고 화면마다 필요한 부모 파일만 읽는다.
- 화면 처리(`src/domain/adminAreas.ts`): 화면 픽셀 좌표에서 각 구역을 (간격 + 반지름)만큼 줄였다가 반지름보다 조금 더 키우고 다시 줄인다(오프닝 + 클로징). 볼록·오목 꼭짓점이 모두 원호가 되고 이웃 사이에 약 4px 간격이 생긴다. 그다음 윤곽을 2px 간격으로 다시 찍어 앞뒤 최대 10px 창의 이동평균을 두 번 적용해, 남은 울퉁불퉁한 부분을 완만한 곡선으로 편다. 반지름(나뉜 구역 10px, 생략된 이웃 18px)과 평균 창은 화면에서 작은 구역일수록 줄여서 작은 구역이 쪼그라들지 않게 한다. 지름 몇 px짜리 점은 버린다. Worker에서 계산한다.
- 브라우저 없이 모양 확인: `npx vite-node scripts/area-preview.ts <폴더>` → 역삼1동 구획·강남구 읍면동·경기도 시군구를 SVG로 저장.

## 기본 지도 (`public/korea/base`) — 이전 방식 (현재 앱에서 그리지 않음)

앱은 이제 구역 다각형 대신 `build_base.py`가 만든 **육지·공원 다각형 + 등급별 도로선**을 그린다. 물(바다·강·호수)은 육지 다각형이 없는 곳이 배경색으로 보이는 것이다. 위의 볼록 구역 타일은 도로 틈 폭이 한 가지로 굳어 있어 큰 길·작은 길 폭을 다르게 할 수 없기 때문이다.

```powershell
python scripts/korea-data/build_base.py                       # 전체 (PBF 면 정보는 data/korea/base-areas.pkl에 캐시)
python scripts/korea-data/build_base.py --levels detail --bbox 126.9,37.5,127.1,37.6
```

| 등급 | OSM `highway` | 색 | 폭 (m, 화면 px 최소~최대) |
|---|---|---|---|
| 1 고속·도시고속 | motorway, trunk | `--map-road-major` (진한 청회색) | 24m, 1.5~34px (방향별 한 줄씩 그려 겹치면 한 도로로 보임), 항상 표시 |
| 2 간선 | primary, secondary, 고속도로 진출입로 | `--map-road` | 28m, 2~40px, 400m/px보다 축소하면 생략 |
| 3 보조간선 | tertiary | `--map-road` | 19m, 1.5~28px, 30m/px보다 축소하면 생략 |
| 4 생활도로 | residential, unclassified, living_street, service, road, busway | `--map-road` | 11m, 1~16px, 6m/px보다 축소하면 생략 |
| 5 보행로 | footway, path, cycleway, steps, pedestrian | `--map-road` | 4m, 1~6px, 2.5m/px보다 축소하면 생략 |

폭과 생략 기준은 `src/domain/baseMap.ts`의 `roadWidthPx`·`roadTierVisible` 하나로 두 지도 SDK와 타일 서비스가 같이 쓴다. MapLibre는 기준 근처 1/4 줌 동안 선이 가늘어지며 사라진다. 단계별로 담는 등급: `detail`(6m/px 미만) 1–5, `city` 1–3, `region` 1–2, `country` 1과 primary. 공원은 leisure=park·garden·golf_course, landuse=grass·recreation_ground·village_green이며 `city`는 3만㎡, `region`은 1㎢ 이상만, `country`는 생략. 터널은 지표에 그리지 않는다.

**볼록 구역 규칙** (`convex_roads.py`, `detail`·`city` 단계): 도로 사이의 땅(구역)이 볼록 다각형이 되도록, 규칙을 어기는 하위 등급 도로를 생략한다. 막다른 길(구역에 홈을 냄), 구역을 ㄱ자로 자르는 길, 크게 휜 길이 해당한다. 1·2등급(고속·간선)은 생략하지 않는다. 등급을 3 → 4 → 5 순서로 하나씩 더하며 그 단계에 더하는 등급만 생략할 수 있어서, 줌에 따라 좁은 등급이 빠진 화면에서도 구역이 볼록하다. 볼록 판정은 구역 면적 ÷ 볼록 껍질 면적 ≥ 0.88 (휜 정도 허용: `detail` 5m, `city` 30m 단순화 후). 오목한 구역에서는 지웠을 때 이웃 구역과 합친 모양이 가장 볼록해지는 도로 하나를 지우고, 합쳐도 나아지지 않으면 두므로 오목한 간선 구역 안의 길이 줄줄이 지워지지 않는다. 해안·강·호수나 판정 범위 가장자리에 닿은 구역은 지형·타일 경계 때문이므로 제외한다. 타일마다 주변(`detail` 300m, `city` 1.5km)을 함께 보고 판정한 뒤 타일 안만 저장한다. 다리처럼 물 위의 구간은 판정 없이 그대로 둔다. 테스트: `python scripts/korea-data/test_convex_roads.py`.

## 범위와 한계

수집 범위는 해당 대한민국 추출본에 등록된 **모든 highway way**이다. OSM에 등록되지 않은 실제 골목·사유도로 등은 확보할 수 없으며, 원본 추출본 경계 밖의 객체는 포함하지 않는다. 불완전한 좌표는 상태와 함께 수집본에 보존하고 지도 도형에서만 제외한다. 화면에는 확대 단계별 도로 분류를 적용하며 면적 기준으로 구역을 생략하지 않는다. 터널·면적형 highway는 지표면의 블록을 잘못 나누지 않도록 화면에서 제외한다.

원본 ID 대조에서 발견한 좌표 1개짜리 도로 객체(way `842288033`)도 수집 파일에 보존한다. 이런 객체에는 `geometry_status`를 기록하고, 도형을 만들 수 없어 지도에서만 제외한다. `audit.py`는 원본 PBF의 모든 도로 ID와 수집 파일을 독립적으로 대조하며 누락·추가·중복이 있으면 실패한다. 이번 원본의 도로 객체는 총 **1,816,596건**이다.

육지 경계는 [geoBoundaries KOR ADM0](https://www.geoboundaries.org/api/current/gbOpen/KOR/ADM0/)의 Natural Earth 기반 Public Domain 데이터에 OSM의 닫힌 섬 해안선을 추가한다. 본토 해안은 개략적인 경계이므로 동네 단위 해안선·매립지의 정밀도는 제한된다. 물 영역은 OSM multipolygon의 구멍을 보존한다. 지리적 완전성·측량 정확도를 보장하는 국가 공식 지도는 아니다.

## 라이선스

도로·해안선·물 영역 및 그 파생 데이터는 [OpenStreetMap ODbL 1.0](https://www.openstreetmap.org/copyright)을 따른다. 출처는 OpenStreetMap contributors 및 Geofabrik이다. `public/korea`의 데이터베이스는 ODbL 1.0으로 공개하며, 원본 다운로드 링크·변환 스크립트·데이터 출처를 유지한다. 이는 앱 소스 코드 전체의 라이선스를 변경하지 않는다.

지도에 출처를 표시하며, 경계 출처는 Natural Earth / geoBoundaries (Public Domain)이다.

## Current convex partition policy (`convex-complete-v3`)

This policy supersedes the historical area cutoffs described below. All land
outside dividing-road buffers and water is retained, including small regions.
The frontend no longer hides blocks below 36 screen pixels of area.

The builder nodes junctions and removes dangling roads, subtracts road buffers,
clips to the tile, quantizes coordinates to six decimal places, and repairs
invalid geometry. Constrained Delaunay triangulation partitions concave regions
and regions with holes. Adjacent pieces are merged, longest shared edge first,
only if their exact union equals their convex hull. New neighbors are checked
until no further convex pair can merge. Already convex regions remain intact.

Every generated block is convex and has no holes. Water holes remain empty,
surrounded by several convex blocks. There is no area filtering or coastline
simplification. Sub-quantization degenerate geometry cannot be represented.
Merging is greedy and pairwise maximal, rather than a guaranteed global minimum
polygon count. Tile file boundaries remain separate.

Run `python scripts/korea-data/test_blocks.py` to check coverage, overlap,
convexity, water preservation, maximal merging, and tiny region retention.
Run `python scripts/korea-data/validate.py` to check the policy and convexity of
every generated tile. Rebuild with `python scripts/korea-data/build.py --reuse-roads --resume`.
