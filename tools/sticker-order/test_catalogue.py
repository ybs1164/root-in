import json
from pathlib import Path
import tempfile
import unittest

from catalogue import apply_order, atomic_json, order_document, read_catalogue, validate_order

SOURCE = '''// unrelated code must survive
const STICKER_ASSETS: StickerAsset[] = [
  { id: 'a', label: '첫 스티커', src: `${import.meta.env.BASE_URL}stickers/a.png` },
  { id: 'retired', label: '숨긴 스티커', src: `${import.meta.env.BASE_URL}stickers/retired.png` },
  { id: 'b', label: '둘째 스티커', src: `${import.meta.env.BASE_URL}stickers/b.png?v=2` },
  { id: 'c', label: '셋째 스티커', src: `${import.meta.env.BASE_URL}stickers/c.png` },
];
const RETIRED_STICKER_IDS = new Set(['retired']);
export const STICKERS: StickerAsset[] = STICKER_ASSETS.filter((sticker) => !RETIRED_STICKER_IDS.has(sticker.id));
export const getSticker = (id: string) => STICKER_ASSETS.find((sticker) => sticker.id === id);
'''


class CatalogueTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.repo = Path(self.directory.name)
        self.source = self.repo / 'src/domain/decor.ts'
        self.source.parent.mkdir(parents=True)
        self.source.write_text(SOURCE)
        assets = self.repo / 'public/stickers'
        assets.mkdir(parents=True)
        for identifier in ['a', 'b', 'c']:
            (assets / (identifier + '.png')).write_bytes(b'fixture')
        self.catalogue = read_catalogue(self.repo)
        self.payload = {'catalogueHash': self.catalogue['catalogueHash'], 'ids': ['c', 'a', 'b'], 'completed': True}

    def test_reads_active_order_and_preserves_cache_query(self):
        self.assertEqual([i['id'] for i in self.catalogue['items']], ['a', 'b', 'c'])
        self.assertEqual(self.catalogue['items'][1]['src'], '/stickers/b.png?v=2')

    def test_rejects_missing_duplicate_and_unknown_ids(self):
        for ids in [['a', 'b'], ['a', 'a', 'c'], ['a', 'b', 'unknown'], ['a', 'b', 'c', 'retired']]:
            with self.subTest(ids=ids), self.assertRaises(ValueError):
                validate_order(dict(self.payload, ids=ids), self.catalogue)

    def test_rejects_changed_catalogue(self):
        self.source.write_text(SOURCE.replace("label: '첫 스티커'", "label: '이름 수정'"))
        with self.assertRaises(ValueError):
            validate_order(self.payload, read_catalogue(self.repo))

    def test_fails_if_runtime_order_rule_changes(self):
        self.source.write_text(SOURCE.replace('STICKER_ASSETS.filter((sticker) => !RETIRED_STICKER_IDS.has(sticker.id))', 'STICKER_ASSETS.slice().reverse()'))
        with self.assertRaises(ValueError):
            read_catalogue(self.repo)

    def test_apply_preserves_retired_rows_and_other_code(self):
        order_file = self.repo / 'order.json'
        atomic_json(order_file, self.payload)
        self.assertTrue(apply_order(self.repo, order_file))
        updated = self.source.read_text()
        self.assertEqual([i['id'] for i in read_catalogue(self.repo)['items']], ['c', 'a', 'b'])
        self.assertEqual(updated.splitlines()[3], SOURCE.splitlines()[3])
        self.assertEqual(updated.split('];', 1)[1], SOURCE.split('];', 1)[1])
        backups = list((self.repo / 'output/sticker-order/backups').glob('*.ts'))
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].read_text(), SOURCE)
        self.assertFalse(apply_order(self.repo, order_file))

    def test_only_completed_valid_order_can_change_app(self):
        order_file = self.repo / 'order.json'
        for payload in [dict(self.payload, completed=False), dict(self.payload, ids=['c', 'c', 'a'])]:
            atomic_json(order_file, payload)
            with self.assertRaises(ValueError):
                apply_order(self.repo, order_file)
            self.assertEqual(self.source.read_text(), SOURCE)

    def test_export_maps_labels_to_ids_after_moving(self):
        document = order_document(self.payload, self.catalogue)
        self.assertEqual([i['label'] for i in document['items']], ['셋째 스티커', '첫 스티커', '둘째 스티커'])
        self.assertEqual([i['position'] for i in document['items']], [1, 2, 3])
        path = self.repo / 'output/order.json'
        atomic_json(path, document)
        self.assertEqual(json.loads(path.read_text()), document)

    def test_removal_is_saved_separately_and_old_documents_remain_valid(self):
        doc = order_document(dict(self.payload, removedIds=['a']), self.catalogue)
        self.assertEqual(doc['ids'], ['c', 'a', 'b'])
        self.assertEqual(doc['removedIds'], ['a'])
        self.assertEqual([i['id'] for i in doc['items']], ['c', 'b'])
        self.assertEqual([i['id'] for i in doc['removedItems']], ['a'])
        self.assertEqual(order_document(self.payload, self.catalogue)['removedIds'], [])
        self.assertEqual(self.source.read_text(), SOURCE)

    def test_invalid_removal_lists_are_rejected(self):
        for removed in [None, 'a', ['a', 'a'], ['unknown'], [3], [{}]]:
            with self.subTest(removed=removed), self.assertRaises(ValueError):
                validate_order(dict(self.payload, removedIds=removed), self.catalogue)

    def test_apply_removals_keeps_assets_and_saved_artwork_lookup(self):
        for removed in [['a'], ['a', 'b', 'c']]:
            with self.subTest(removed=removed):
                self.source.write_text(SOURCE)
                path = self.repo / 'order.json'
                atomic_json(path, dict(self.payload, removedIds=removed))
                self.assertTrue(apply_order(self.repo, path))
                self.assertEqual([i['id'] for i in read_catalogue(self.repo)['items']],
                                 [i for i in self.payload['ids'] if i not in removed])
                updated = self.source.read_text()
                for identifier in removed:
                    self.assertIn("id: '" + identifier + "'", updated)
                    self.assertTrue((self.repo / 'public/stickers' / (identifier + '.png')).exists())
                self.assertIn('export const getSticker', updated)
                self.assertFalse(apply_order(self.repo, path))


if __name__ == '__main__':
    unittest.main()
