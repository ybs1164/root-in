"""Draft mapping-semas.csv: 상가정보 소분류 code -> PlaceKind, by keyword rules.

Run once per new code list; after that mapping-semas.csv is the hand-reviewed
source of truth, so this refuses to overwrite it without --force.

    python scripts/place-kinds/draft_semas_mapping.py [--force]

An empty kind means "no icon" (general pin) on purpose: a wrong icon is worse
than none (docs/plan-auto-icon.md).
"""
import csv
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / 'semas-codes-202606.csv'
OUT = HERE / 'mapping-semas.csv'

# (regex on 소분류명, kind). First match wins, so specific words go before broad ones.
RULES = [
    # Repair shops share words with retail (의류, 가방) but aren't places people pin.
    (r'수선업|수리업', ''),
    (r'아이스크림/빙수', 'icecream'),
    (r'아이스크림 할인점', 'icecream'),
    (r'^카페$', 'cafe'),
    (r'빵/도넛', 'bakery'),
    (r'떡/한과', 'dessert'),
    (r'피자', 'pizza'),
    (r'버거', 'burger'),
    (r'치킨', 'chicken'),
    (r'샌드위치', 'sandwich'),
    (r'분식', 'snack'),
    (r'초밥', 'japanese'),
    (r'일식', 'japanese'),
    (r'국수|냉면|면 요리', 'noodle'),
    (r'중국집|마라탕', 'chinese'),
    (r'횟집|해산물|복 요리', 'seafood'),
    (r'고기|곱창|족발', 'meat'),
    (r'국/탕|전/부침개|기타 한식', 'korean'),
    (r'백반', 'restaurant'),
    (r'경양식|파스타|패밀리레스토랑|서양식', 'western'),
    (r'베트남|동남아|외국식', 'world'),
    (r'뷔페', 'buffet'),
    (r'구내식당|간이 음식점', 'restaurant'),
    (r'생맥주', 'pub'),
    (r'무도 유흥', 'club'),
    (r'유흥 주점|요리 주점', 'bar'),
    (r'편의점', 'convenience'),
    (r'슈퍼마켓|기타 종합 소매', 'mart'),
    (r'정육점', 'butcher'),
    (r'수산물', 'fishmonger'),
    (r'채소/과일', 'greengrocer'),
    (r'반찬|건어물|곡물', 'grocery'),
    (r'주류 소매', 'liquor'),
    (r'생수|우유', 'drink'),
    (r'꽃집', 'florist'),
    (r'서점', 'bookstore'),
    (r'기념품|장난감', 'gift_shop'),
    (r'시계/귀금속 소매', 'jewelry'),
    (r'악기 소매|음반/비디오물 소매', 'music_store'),
    (r'자전거 소매', 'bike_shop'),
    (r'애완', 'pet_shop'),
    (r'약국', 'pharmacy'),
    (r'의류|신발|가방|잡화|한복|화장품|안경|가구|가전제품 소매|핸드폰 소매|컴퓨터/소프트웨어 소매|문구|운동용품|주방|침구|중고 상품|예술품', 'shop'),
    (r'주유소|가스 충전소', 'gas'),
    (r'호텔', 'hotel'),
    (r'모텔', 'motel'),
    (r'펜션', 'pension'),
    (r'캠핑', 'camping'),
    (r'헬스장|종합 스포츠|요가', 'gym'),
    (r'수영장', 'pool'),
    (r'볼링', 'bowling'),
    (r'당구', 'billiards'),
    (r'골프', 'golf'),
    (r'테니스|스쿼시|탁구', 'racket'),
    (r'노래방', 'karaoke'),
    (r'만화방', 'comic_cafe'),
    (r'스터디 카페', 'study_cafe'),
    (r'낚시터', 'fishing'),
    (r'수상/해양', 'water_sports'),
    (r'^미용실$|네일|피부 관리', 'salon'),
    (r'세탁소|빨래방', 'laundry'),
    (r'예식장', 'wedding'),
    (r'사진촬영', 'photo_studio'),
    (r'동물병원', 'vet'),
    (r'^여행사$', 'travel_agency'),
    (r'자동차 대여', 'car_rental'),
    (r'자동차 정비|세차', 'car_service'),
    (r'병원$', 'hospital'),
    (r'의원$', 'clinic'),
]

# Judgment calls a reviewer should see next to the row.
NOTES = {
    'G20507': '무인 아이스크림 가게 — 디저트 가게와 같은 아이콘',
    'I20101': '사실상 일반 한식당 모음(18만), 치킨집 등 오분류 섞임 — 상호명 키워드를 먼저 볼 것',
    'I20302': '돈가스·카레·덮밥 — 초밥 아이콘이 어색하면 restaurant로',
    'I21101': '유흥 주점 — bar 아이콘',
    'N11004': '한복 대여(고궁 근처)를 위해 shop',
    'P10603': '요가·필라테스 — 운동 아이콘',
    'S20801': '맞는 아이콘이 없어 비움',
}

def main() -> None:
    if OUT.exists() and '--force' not in sys.argv:
        sys.exit(f'{OUT.name} exists (hand-reviewed). Pass --force to overwrite.')
    with SRC.open(encoding='utf-8', newline='') as f:
        rows = list(csv.DictReader(f))
    with OUT.open('w', encoding='utf-8', newline='') as f:
        w = csv.writer(f, lineterminator='\n')
        w.writerow(['code', 'name', 'count', 'kind', 'note'])
        for r in rows:
            name = r['소분류']
            kind = next((k for pat, k in RULES if re.search(pat, name)), '')
            path = f"{r['대분류']} > {r['중분류'].strip()} > {name}"
            w.writerow([r['소분류코드'], path, r['건수'], kind, NOTES.get(r['소분류코드'], '')])
    print(f'wrote {OUT.name}: {len(rows)} codes')


if __name__ == '__main__':
    main()
