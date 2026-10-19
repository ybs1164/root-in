"""Build public/korea/places/: 상가정보 shops as small per-시군구 lookup files (I5).

    python scripts/place-kinds/build_places.py --src <상가정보 zip or folder of CSVs> [--out public/korea/places]

The app (I6) fetches one 시군구 file when a pin's place has no kind yet and
matches it by distance + name. So a file holds only what matching needs —
a normalised name, a point and a kind — never the original name, address or
phone (docs/plan-auto-icon.md). Shops whose 업종 has no kind
(mapping-semas.csv, blank) are left out entirely.

File shape (`<시군구코드>.json`):
    {"v": 1, "k": ["cafe", "bakery", ...], "r": [[name, lon1e5, lat1e5, kindIndex], ...]}
`k` lists only the kinds used in that file, so the index never depends on the
app's PlaceKind order. `index.json` lists every file with its row count.
Same input, same output: rows are sorted and the JSON is written compactly.
"""
import argparse
import csv
import io
import json
import re
import sys
import unicodedata
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).parent
MAPPING = HERE / 'mapping-semas.csv'
FORMAT_VERSION = 1
NAME_MAX = 20
# Mainland + Jeju + Ulleung/Dokdo, as the app's own inKorea check.
LON_RANGE = (124.0, 132.0)
LAT_RANGE = (33.0, 39.0)

# ── Name normalisation ────────────────────────────────────────────────────
# I6 must normalise a place name the same way before comparing, so the cases
# in name-cases.json are shared by this script's tests and the app's.
_BRACKETS = re.compile(r'\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|<[^>]*>')
_COMPANY = re.compile(r'주식회사|유한회사|㈜')
# Only a separate last word: "스타벅스 성수점" → "스타벅스", while "홍콩반점" stays.
_BRANCH_WORD = re.compile(r'\S{1,12}(점|지점|호점)')
_DROP = re.compile(r'[^0-9a-z가-힣]')


def normalize_name(name: str, branch: str = '') -> str:
    """Lowercased letters/digits/한글 only, without company words, brackets or the branch."""
    s = unicodedata.normalize('NFKC', name).lower()
    s = _BRACKETS.sub(' ', s)  # before _COMPANY, so "(주)" goes as a bracket
    s = _COMPANY.sub(' ', s)
    words = s.split()
    if len(words) > 1 and _BRANCH_WORD.fullmatch(words[-1]):
        words = words[:-1]
    s = _DROP.sub('', ''.join(words))
    b = _DROP.sub('', unicodedata.normalize('NFKC', branch).lower())
    if b and s.endswith(b) and len(s) > len(b):
        s = s[: -len(b)]
    return s[:NAME_MAX]


# ── 업종 code → kind, with name keywords first ────────────────────────────
# Some rows carry the wrong 업종 (a chicken chain filed as 백반/한정식), so a
# strong word or chain name in the shop's own name wins — but only among food,
# where it can't turn, say, a 치킨무 factory into a restaurant. Drinking places
# keep their code: "카페" in a 유흥주점's name is a euphemism, not a café.
FOOD_KINDS = {
    'restaurant', 'korean', 'meat', 'seafood', 'chinese', 'japanese', 'western', 'world', 'noodle', 'snack',
    'buffet', 'pizza', 'burger', 'chicken', 'sandwich', 'bakery', 'donut', 'dessert', 'icecream', 'cafe', 'tea',
}
NAME_KEYWORDS = [
    (re.compile(r'치킨|통닭|비비큐|bbq|bhc|교촌|굽네|네네|처갓집|호식이'), 'chicken'),
    (re.compile(r'피자|도미노|파파존스|피자헛'), 'pizza'),
    (re.compile(r'버거|맥도날드|롯데리아|맘스터치'), 'burger'),
    (re.compile(r'베이커리|제과|파리바게|뚜레쥬르'), 'bakery'),
    (re.compile(r'도넛|던킨|크리스피'), 'donut'),
    (re.compile(r'마라탕|훠궈'), 'chinese'),
    (re.compile(r'스타벅스|이디야|투썸|메가엠지씨|메가커피|빽다방|컴포즈|커피|카페'), 'cafe'),
]


def load_mapping(path: Path = MAPPING) -> dict[str, str]:
    with path.open(encoding='utf-8', newline='') as f:
        return {row['code']: row['kind'] for row in csv.DictReader(f)}


def kind_for(code: str, norm_name: str, mapping: dict[str, str]) -> str | None:
    if code not in mapping:
        raise KeyError(f'업종 code {code} is not in mapping-semas.csv — add it (blank kind = no icon)')
    kind = mapping[code] or None
    if kind in FOOD_KINDS:
        for pattern, keyword_kind in NAME_KEYWORDS:
            if pattern.search(norm_name):
                return keyword_kind
    return kind


# ── Reading the source ────────────────────────────────────────────────────
def iter_rows(src: Path):
    """Rows of every CSV in the zip (CP949 file names, UTF-8 content) or folder."""
    if src.is_dir():
        for p in sorted(src.glob('*.csv')):
            with p.open(encoding='utf-8-sig', newline='') as f:
                yield from csv.DictReader(f)
        return
    with zipfile.ZipFile(src, metadata_encoding='cp949') as z:
        for info in sorted(z.infolist(), key=lambda i: i.filename):
            if not info.filename.lower().endswith('.csv'):
                continue
            with z.open(info) as raw:
                yield from csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8-sig', newline=''))


def build(rows, mapping: dict[str, str]):
    """→ ({시군구코드: sorted rows of (name, lon, lat, kind)}, stats)."""
    by_area: dict[str, set] = defaultdict(set)
    stats = Counter()
    for r in rows:
        stats['rows'] += 1
        try:
            lon, lat = float(r['경도']), float(r['위도'])
        except (KeyError, ValueError):
            stats['bad_coord'] += 1
            continue
        if not (LON_RANGE[0] <= lon <= LON_RANGE[1] and LAT_RANGE[0] <= lat <= LAT_RANGE[1]):
            stats['outside'] += 1
            continue
        name = normalize_name(r['상호명'], r.get('지점명', ''))
        if not name:
            stats['no_name'] += 1
            continue
        kind = kind_for(r['상권업종소분류코드'], name, mapping)
        if not kind:
            stats['no_kind'] += 1
            continue
        area = r['시군구코드']
        if not re.fullmatch(r'\d{5}', area or ''):
            stats['bad_area'] += 1
            continue
        by_area[area].add((name, round(lon * 1e5), round(lat * 1e5), kind))
    kept = sum(len(v) for v in by_area.values())
    stats['kept'] = kept
    stats['duplicates'] = stats['rows'] - sum(stats[k] for k in ('bad_coord', 'outside', 'no_name', 'no_kind', 'bad_area')) - kept
    return {area: sorted(rows, key=lambda t: (t[2], t[1], t[0], t[3])) for area, rows in by_area.items()}, stats


def encode_area(rows) -> dict:
    kinds = sorted({r[3] for r in rows})
    index = {k: i for i, k in enumerate(kinds)}
    return {'v': FORMAT_VERSION, 'k': kinds, 'r': [[n, x, y, index[k]] for n, x, y, k in rows]}


def write(areas: dict, out: Path, source: str) -> int:
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('*.json'):
        old.unlink()
    total = 0
    for area, rows in sorted(areas.items()):
        data = json.dumps(encode_area(rows), ensure_ascii=False, separators=(',', ':'))
        (out / f'{area}.json').write_text(data, encoding='utf-8', newline='\n')
        total += len(data.encode('utf-8'))
    index = {'v': FORMAT_VERSION, 'source': source, 'areas': {a: len(r) for a, r in sorted(areas.items())}}
    (out / 'index.json').write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':')), encoding='utf-8', newline='\n')
    return total


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--src', required=True, type=Path, help='상가정보 zip, or a folder of its CSVs')
    ap.add_argument('--out', type=Path, default=Path('public/korea/places'))
    args = ap.parse_args()
    if not args.src.exists():
        sys.exit(f'not found: {args.src}')
    areas, stats = build(iter_rows(args.src), load_mapping())
    size = write(areas, args.out, args.src.name)
    print(json.dumps({**stats, 'files': len(areas), 'mb': round(size / 1e6, 1)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
