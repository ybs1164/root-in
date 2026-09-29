# root-in

데이트·여행·맛집 코스를 지도에 만들고 링크 하나로 공유하는 모바일 우선 웹 앱.

## 실행

```bash
npm install
cp .env.example .env.local   # VITE_KAKAO_JS_KEY 입력 (선택)
npm run dev
```

- 카카오 JavaScript 키가 있으면 카카오맵 + 카카오 장소 검색을 사용합니다.
  카카오 개발자 콘솔 → 플랫폼 → Web에 `http://localhost:5188`(또는 사용하는 개발 주소)을 등록하세요.
- 키가 없으면 MapLibre(OpenStreetMap) 지도 + Photon 검색으로 자동 대체됩니다.

## 기능

- 장소 검색 → 순서대로 추가 → 장소별 한 줄 메모, 순서 변경
- 테마(데이트/여행/맛집/기타), 이동수단(도보/대중교통/자동차)
- 구간별 추정 시간·거리, 구간별 카카오맵 길찾기 링크
- 코스 저장(브라우저 localStorage), 링크 공유 (`#share=…` — 서버로 전송되지 않음)
- 공유받은 링크: 번호 마커와 코스 보기, 내 코스에 저장, 수정해서 쓰기

개발 규칙과 구조는 [CLAUDE.md](CLAUDE.md), 계획은 [docs/plan-m0-m1.md](docs/plan-m0-m1.md).
