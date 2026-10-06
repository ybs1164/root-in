# 계획: 다른 테스트 클라이언트에서도 지도 데이터를 불러오기 (원격 호스팅)

> 2026-10-06 작성. 작업 번호 H0, H1 … 한 번에 하나씩.

## 왜 지금은 안 되나

- 앱은 지도 데이터를 **같은 출처의 정적 파일**로 읽는다: `${BASE_URL}korea/admin/…`(`adminAreaService.ts`), `${BASE_URL}korea/base/…`(`koreaMapService.ts`). 이 파일들은 `public/korea/`에 있고 Git에는 없다(`.gitignore`) — **이 PC의 개발 서버(localhost:5188)에서만** 보인다.
- 다른 기기·테스터가 앱을 열면 `sido.json`이 404라 지도가 빈 배경이다 (콘솔 경고 한 줄).
- 크기: `korea/admin` 약 **1.3GB**(파일 약 1만 1천 개: 도로 단계 1.1GB, 블록 65MB, 보행로 97MB …), `korea/base`는 H2에서 잰다. 옛 평면 폴더(`korea/detail·city·region·country`, 약 3GB)는 코드가 안 읽는다.
- JSON이라 gzip이 잘 듣는다: 도로 파일 하나 172KB → 33KB(약 5배). 전부 올려도 **약 250~300MB**.
- 안드로이드 APK에 넣을 수도 없다 (Play AAB 한도 150MB, `CLAUDE.md` 안드로이드 절).

## 목표

1. 테스터가 **링크 하나**(웹) 또는 **APK 하나**(안드로이드)로 앱을 열면, 이 PC가 꺼져 있어도 지도가 뜬다.
2. 지도 데이터는 앱 번들과 **따로** 올리고 갱신한다 (데이터를 다시 만들 때마다 앱을 다시 배포하지 않는다).
3. 데이터 주소는 환경 변수 하나(`VITE_MAP_DATA_URL`)로 바꾼다. 비우면 지금처럼 같은 출처의 `korea/`를 쓴다 — 키 없이도 `npm run dev`가 돌아야 한다는 기존 규칙과 같은 방식.

## 정해 둔 기본값 (다르면 알려 주세요)

| 항목 | 기본값 | 이유 |
|---|---|---|
| 데이터 저장소 | **Cloudflare R2** 버킷 + 커스텀 도메인(없으면 `r2.dev` 주소로 시험) | 내려받기 요금 없음, 무료 10GB(우린 gzip 약 0.3GB), S3 호환이라 업로드 도구가 많음. GitHub Pages는 사이트 1GB 한도에 걸리고, Cloudflare Pages는 파일 2만 개·25MB 제한이라 admin+base 파일 수가 빠듯함 |
| 앱(웹) 호스팅 | **Cloudflare Pages** (Git 연결 또는 `wrangler pages deploy`) | 앱 번들은 수 MB, 무료, 미리보기 주소 자동 |
| 압축 | 올리기 전에 파일마다 gzip, `Content-Encoding: gzip` 헤더 | R2 공개 주소는 자동 압축을 보장하지 않음 |
| 캐시 | 데이터 폴더에 버전 이름(`korea-20261006/`), `Cache-Control: public, max-age=31536000, immutable` | 한 번 받은 파일은 다시 안 받음, 갱신은 새 버전 폴더 |
| 접근 | 공개 읽기, 주소는 테스터에게만 알림 | 테스트 단계. 라이선스는 H6에서 확인 |

## H0. 가장 빠른 길: 이 PC를 임시 서버로 (약 30분, 코드 변경 없음)

데이터 호스팅을 만들기 전에 테스터가 **오늘** 볼 수 있는 방법.
- 같은 와이파이: `npm run dev -- --host --port 5188`(방화벽에서 5188 허용) → 폰에서 `http://<PC 주소>:5188`. 카카오 키는 `localhost`만 등록돼 있어 MapLibre로 대체된다 — 지도 데이터 시험에는 충분.
- 다른 네트워크: `cloudflared tunnel --url http://localhost:5188` 같은 터널 → 임시 https 주소. PC가 켜져 있는 동안만, 1.3GB를 이 PC 회선으로 보냄(도로 단계 파일은 압축 없이 최대 3.7MB).
- 한계를 테스터에게 알린다: 느림, PC 꺼지면 끝.

## H1. 앱: 데이터 주소를 설정으로 (약 2시간)

- `src/lib/mapDataUrl.ts`(새): `export const MAP_DATA_URL = (import.meta.env.VITE_MAP_DATA_URL ?? \`${import.meta.env.BASE_URL}korea/\`)`를 끝 `/` 하나로 정규화. `adminAreaService.ts`의 `BASE`(`…korea/admin/`)와 `koreaMapService.ts`의 `BASE`(`…korea/base/`)가 이걸 쓴다.
- `.env.example`에 `VITE_MAP_DATA_URL=` 줄과 설명 추가 (비우면 같은 출처).
- 테스트: 환경 변수가 있을 때 요청 주소가 그 주소로 시작하는지(`vi.stubEnv` + `vi.stubGlobal('fetch')`), 없으면 기존 주소 그대로. 기존 `adminAreaService.test.ts`의 주소 단언은 그대로 통과해야 한다.
- 404 경고 문구(`warnedMissing`)에 설정된 주소를 넣어 테스터가 "데이터 주소가 틀렸다"를 바로 알아보게 한다.
- CORS: 다른 출처에서 `fetch`하므로 버킷이 `Access-Control-Allow-Origin`을 줘야 한다 (H3). 앱 쪽 코드는 `mode`를 바꿀 필요 없음.
- 브라우저 CSP가 있다면 `connect-src`에 데이터 주소 추가 (지금은 없음 — 확인만).

## H2. 데이터 묶기 (약 2시간 작업 + 기계 시간 약 10분)

`scripts/publish-map-data.mjs`(새, Node):
1. 대상: `public/korea/admin/**`, `public/korea/base/**`, `LICENSE.md`. 옛 평면 폴더·`manifest.json`(옛)은 제외. `korea/base` 크기·파일 수를 먼저 재서 이 문서에 적는다.
2. 버전 이름: `korea-<빌드 날짜>`(예: `korea-20261006`). `public/korea/admin`을 다시 만들 때마다 날짜가 바뀐다.
3. 파일마다 gzip 압축 → `data/publish/<버전>/<원래 경로>`(Git 제외, `data/`는 이미 제외됨). 같은 내용이면 건너뛰도록 파일별 sha256을 `files.json`에 적고, 이전 버전과 비교해 **바뀐 것만** 올린다.
4. `files.json`(경로·바이트·sha256·gzip 바이트)을 함께 올려 H5의 검증에 쓴다.
5. 압축 후 전체 크기를 출력한다 (예상 250~300MB).

## H3. 올리기와 설정 (처음 한 번 약 1시간, 업로드 약 20~40분)

- Cloudflare 계정에서 R2 버킷 `root-in-map-data` 만들기, 커스텀 도메인 연결(예: `map-data.<도메인>`) 또는 임시로 `r2.dev` 공개 주소 켜기. **필요한 것: Cloudflare 계정(없으면 만들어야 함 — 제가 대신 못 하는 부분)과, 도메인이 있으면 DNS 접근.**
- 올리기: `rclone`(S3 호환 설정) 또는 `aws s3 sync --content-encoding gzip --cache-control "public, max-age=31536000, immutable" --content-type application/json`. 파일 1만 1천 개 × 평균 25KB(압축 후)라 요청 수가 병목이니 병렬 16~32개로.
- 버킷 CORS: `AllowedOrigins` = 웹 앱 주소들 + `https://localhost`(안드로이드 WebView, `capacitor.config.ts`의 `androidScheme: 'https'`) + `http://localhost:5188`(개발), `GET`·`HEAD`, `MaxAgeSeconds` 86400.
- 확인(`curl`): ① `sido.json`이 200이고 `content-encoding: gzip`, `access-control-allow-origin`이 맞는지 ② 임의의 도로 파일 하나 ③ 없는 파일은 404(앱이 이걸로 위 단계로 내려가는 걸 기대함 — **404가 JSON 오류 페이지나 200으로 바뀌지 않는지** 꼭 확인, `adminAreaService`는 `response.ok`로 판단).

## H4. 앱 올리기와 시험 (약 2시간)

- 웹 앱: `VITE_MAP_DATA_URL=https://<데이터 주소>/korea-20261006/ npm run build` 뒤 **`dist`에서 `korea/`를 지운다**(`vite build`가 `public/`을 통째로 복사해서 데이터까지 들어감 — 안 지우면 3GB가 앱에 실림). `scripts/android-sync.mjs`가 이미 하는 정리를 공용 `scripts/prune-dist.mjs`로 빼서 웹·안드로이드가 같이 쓴다. Cloudflare Pages에 올리면 `https://<프로젝트>.pages.dev`.
- 카카오 콘솔 Web 플랫폼에 그 주소를 등록해야 카카오 지도가 뜬다 (안 하면 MapLibre로 대체 — 데이터 시험에는 상관없음, 테스터에게 어느 쪽인지 알림).
- 시험 매트릭스: PC 크롬(처음 열기, 새로고침으로 캐시 확인) · 안드로이드 크롬 · iOS 사파리 · LTE 회선. 각각 (a) 전국 → 서울 → 강남 역삼1동 확대 (b) 0.3m/px 도로 단계 (c) 시골(양평·부안) (d) 오프라인 전환 시 오류 없이 이미 받은 것만 보임.
- 기준: 첫 화면(전국) 2초 안, 읍면동 → 도로 단계 확대에서 파일 받기 합쳐 1~2초 안, 가장 큰 도로 파일(3.7MB → gzip 약 0.7MB) 포함. 이 숫자를 이 문서에 적는다.

## H5. 안드로이드 테스터 (약 2시간)

- `scripts/android-sync.mjs`: 빌드 때 `VITE_MAP_DATA_URL`이 설정돼 있으면 `korea/admin`·`korea/base`도 `dist`에서 지운다 → APK 수 MB. 설정이 없으면(로컬 개발) 지금처럼 번들한다고 경고만.
- WebView 출처가 `https://localhost`라 H3의 CORS에 이미 포함돼 있어야 한다. 안 되면 지도가 빈 채로 콘솔에 CORS 오류 — `chrome://inspect`로 확인(디버그 빌드에서만 켜짐).
- 배포: 디버그 APK를 파일로 전달(가장 단순) → 이후 Firebase App Distribution 또는 Play 내부 테스트(AAB 150MB 한도는 데이터를 뺐으니 통과).
- 앱 첫 실행에 네트워크가 없으면 빈 지도 — 오프라인은 목표 아님(`CLAUDE.md`). 대신 "지도 데이터를 불러오지 못했어요" 한 줄을 화면에 띄울지 H1에서 같이 정한다 (지금은 조용히 빈 배경).

## H6. 갱신·롤백·라이선스 (약 1시간 + 이후 상시)

- 데이터를 다시 만들었을 때(`build_admin.py`/`build_roads.py`): `publish-map-data.mjs` → 새 버전 폴더 업로드 → 앱을 새 `VITE_MAP_DATA_URL`로 다시 빌드·배포. **이전 버전 폴더는 지우지 않는다** — 옛 앱 빌드(이미 설치된 APK)가 계속 열리도록. 오래된 버전은 수동으로 정리.
- 롤백: 앱을 이전 `VITE_MAP_DATA_URL`로 다시 배포.
- 용량·비용: R2 저장 약 0.3GB/버전은 무료 한도 안. 버전이 쌓이면 10GB 한도 전에 정리.
- **라이선스**: 데이터는 통계청 SGIS 행정동 경계(공공누리 제1유형, 출처 표시)와 OpenStreetMap에서 만든 도형(ODbL — 출처 표시와, 파생 데이터베이스를 공개할 때 같은 조건 공유)이다. 공개 주소로 내보내면 이 조건이 걸리므로 (a) `LICENSE.md`가 같은 폴더에 함께 올라가고 (b) 앱 화면의 출처 표시(지금 `행정경계: 통계청 SGIS · admdongkor`)에 OpenStreetMap을 추가할지 정한다. 테스트 단계에서 주소를 비공개로만 쓰는 동안은 위험이 작지만, 스토어 배포 전에 반드시 정리.

## 시간 요약

| 작업 | 작업 시간 | 기계·대기 시간 |
|---|---|---|
| H0 임시 서버 | 30분 | — |
| H1 앱 설정 | 2시간 | — |
| H2 묶기 | 2시간 | 약 10분 |
| H3 올리기·설정 | 1시간 | 업로드 20~40분 |
| H4 웹 배포·시험 | 2시간 | — |
| H5 안드로이드 | 2시간 | APK 빌드 수 분 |
| H6 갱신·문서 | 1시간 | — |
| **합계** | 약 1.5일 | 약 1시간 |

Cloudflare 계정과 도메인 준비가 늦어지면 H0만으로 먼저 시험하고 H3부터 이어간다.

## 순서와 확인 기준

H0(바로 시험) → H1 → H2 → H3 → H4 → H5 → H6. 각 단계 끝에서 `npm run check` 통과. 끝났다고 말하려면: **이 PC의 개발 서버를 끈 상태에서** 다른 기기로 웹 링크와 APK를 열어 강남 역삼1동 도로 단계(0.3m/px)까지 그려지는 것을 확인.

## 열린 질문

1. 데이터 저장소는 Cloudflare R2로 가도 되는지 (이미 쓰는 클라우드·도메인이 있으면 그쪽에 맞춘다).
2. 공개 주소로 올려도 되는지 — 아니면 테스터 접근을 막아야 하는지 (막으려면 Cloudflare Access 또는 서명된 주소가 필요해 H3이 하루 늘어남).
3. 웹 테스터와 안드로이드 테스터 중 먼저 필요한 쪽은 어디인지 (없으면 웹 → 안드로이드 순).
