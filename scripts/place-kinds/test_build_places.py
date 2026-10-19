"""Tests for build_places.py. Run: python -m unittest discover -s scripts/place-kinds"""
import csv
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from build_places import FORMAT_VERSION, build, encode_area, iter_rows, kind_for, load_mapping, normalize_name, write

HERE = Path(__file__).parent
COLUMNS = ['상가업소번호', '상호명', '지점명', '상권업종소분류코드', '시군구코드', '경도', '위도']


def row(name, code='I21201', area='11200', lon='127.05', lat='37.54', branch=''):
    return {'상가업소번호': 'x', '상호명': name, '지점명': branch, '상권업종소분류코드': code, '시군구코드': area, '경도': lon, '위도': lat}


class NormalizeTest(unittest.TestCase):
    def test_shared_cases(self):
        # The same file drives the app's normaliser test (I6), so both agree.
        for case in json.loads((HERE / 'name-cases.json').read_text(encoding='utf-8')):
            self.assertEqual(normalize_name(case['name'], case['branch']), case['expect'], case['name'])


class KindTest(unittest.TestCase):
    def setUp(self):
        self.mapping = load_mapping()

    def test_every_code_in_the_code_list_is_mapped(self):
        with (HERE / 'semas-codes-202606.csv').open(encoding='utf-8', newline='') as f:
            codes = {r['소분류코드'] for r in csv.DictReader(f)}
        self.assertEqual(codes, set(self.mapping))

    def test_name_keyword_beats_a_wrong_food_code(self):
        self.assertEqual(kind_for('I20101', '비비큐서', self.mapping), 'chicken')  # filed as 백반/한정식
        self.assertEqual(kind_for('I20101', '김밥천국', self.mapping), 'restaurant')

    def test_keywords_stay_inside_food(self):
        self.assertIsNone(kind_for('L10203', '치킨부동산', self.mapping))  # 부동산: no kind
        self.assertEqual(kind_for('S20701', '카페헤어', self.mapping), 'salon')
        self.assertEqual(kind_for('I21101', '카페장미', self.mapping), 'bar')  # 유흥 주점

    def test_unknown_code_fails_loudly(self):
        with self.assertRaises(KeyError):
            kind_for('Z99999', '무엇', self.mapping)


class BuildTest(unittest.TestCase):
    def test_keeps_only_what_matching_needs(self):
        areas, stats = build(
            [
                row('스타벅스 성수점'),
                row('스타벅스 성수점'),  # exact duplicate
                row('부동산', code='L10203'),  # no kind
                row('바다 건너', lon='140.0'),  # outside Korea
                row('좌표 없음', lon=''),
                row('구 없음', area='seoul'),
                row('어니언', code='I21001', area='11215', lon='127.0582', lat='37.5447'),
            ],
            load_mapping(),
        )
        self.assertEqual(areas['11200'], [('스타벅스', 12705000, 3754000, 'cafe')])
        self.assertEqual(areas['11215'], [('어니언', 12705820, 3754470, 'bakery')])
        self.assertEqual(
            {k: stats[k] for k in ('rows', 'kept', 'duplicates', 'no_kind', 'outside', 'bad_coord', 'bad_area')},
            {'rows': 7, 'kept': 2, 'duplicates': 1, 'no_kind': 1, 'outside': 1, 'bad_coord': 1, 'bad_area': 1},
        )

    def test_file_shape_indexes_only_its_own_kinds(self):
        data = encode_area([('a', 1, 2, 'pizza'), ('b', 3, 4, 'cafe'), ('c', 5, 6, 'pizza')])
        self.assertEqual(data, {'v': FORMAT_VERSION, 'k': ['cafe', 'pizza'], 'r': [['a', 1, 2, 1], ['b', 3, 4, 0], ['c', 5, 6, 1]]})

    def test_reads_the_zip_with_cp949_names_and_writes_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / 'semas.zip'
            text = io.StringIO()
            w = csv.DictWriter(text, fieldnames=COLUMNS)
            w.writeheader()
            w.writerow(row('카페 하나'))
            info = zipfile.ZipInfo('소상공인_서울_202606.csv'.encode('cp949').decode('cp437'))
            with zipfile.ZipFile(src, 'w') as z:
                z.writestr(info, text.getvalue().encode('utf-8'))
                z.writestr('readme.txt', '설명')
            areas, _ = build(iter_rows(src), load_mapping())
            out = Path(tmp) / 'places'
            (out).mkdir()
            (out / 'stale.json').write_text('{}')
            write(areas, out, src.name)
            self.assertEqual(sorted(p.name for p in out.iterdir()), ['11200.json', 'index.json'])
            self.assertEqual(json.loads((out / 'index.json').read_text(encoding='utf-8'))['areas'], {'11200': 1})
            self.assertEqual(json.loads((out / '11200.json').read_text(encoding='utf-8'))['r'], [['카페하나', 12705000, 3754000, 0]])


if __name__ == '__main__':
    unittest.main()
