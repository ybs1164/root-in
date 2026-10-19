from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from catalogue import read_catalogue
from server import handler_for
from test_catalogue import SOURCE


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.repo = Path(self.directory.name)
        source = self.repo / 'src/domain/decor.ts'
        source.parent.mkdir(parents=True)
        source.write_text(SOURCE)
        assets = self.repo / 'public/stickers'
        assets.mkdir(parents=True)
        for name in ['a', 'b', 'c']:
            (assets / (name + '.png')).write_bytes(b'image fixture')
        self.state = self.repo / 'state'
        handler = handler_for(self.repo, self.state)
        handler.log_message = lambda *args: None
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.base = f'http://127.0.0.1:{self.server.server_port}'
        self.payload = {'catalogueHash': read_catalogue(self.repo)['catalogueHash'], 'ids': ['c', 'a', 'b'], 'completed': True}

    def post(self, payload, origin=None):
        request = Request(self.base + '/api/order', data=json.dumps(payload).encode(), method='POST', headers={
            'Content-Type': 'application/json', 'Origin': origin or self.base,
        })
        return urlopen(request)

    def test_save_and_reload_keeps_permutation_and_completion(self):
        with self.post(self.payload) as response:
            self.assertEqual(response.status, 200)
        with urlopen(self.base + '/api/order') as response:
            saved = json.load(response)
            self.assertIn('no-store', response.headers['Cache-Control'])
        self.assertEqual(saved['ids'], ['c', 'a', 'b'])
        self.assertTrue(saved['completed'])
        self.assertEqual([i['id'] for i in saved['items']], ['c', 'a', 'b'])
        self.assertEqual((self.repo / 'src/domain/decor.ts').read_text(), SOURCE)

    def test_invalid_write_cannot_replace_saved_order(self):
        with self.post(self.payload):
            pass
        before = (self.state / 'order.json').read_bytes()
        for payload in [dict(self.payload, ids=['c', 'c', 'a']), dict(self.payload, catalogueHash='stale')]:
            with self.assertRaises(HTTPError) as error:
                self.post(payload)
            self.assertEqual(error.exception.code, 400)
        self.assertEqual((self.state / 'order.json').read_bytes(), before)

    def test_blocks_other_origin_and_non_image_files(self):
        with self.assertRaises(HTTPError) as error:
            self.post(self.payload, 'https://unrelated.example')
        self.assertEqual(error.exception.code, 403)
        self.assertFalse((self.state / 'order.json').exists())
        for path in ['/src/domain/decor.ts', '/stickers/../decor.ts']:
            with self.assertRaises(HTTPError):
                urlopen(self.base + path)
        with urlopen(self.base + '/stickers/b.png?v=2') as response:
            self.assertEqual(response.read(), b'image fixture')

    def test_restarting_with_new_catalogue_keeps_old_order_backup(self):
        with self.post(self.payload):
            pass
        source = self.repo / 'src/domain/decor.ts'
        source.write_text(SOURCE.replace("label: '첫 스티커'", "label: '새 이름'"))
        updated = dict(self.payload, catalogueHash=read_catalogue(self.repo)['catalogueHash'])
        with self.post(updated):
            pass
        backups = list((self.state / 'backups').glob('order-*.json'))
        self.assertEqual(len(backups), 1)
        self.assertEqual(json.loads(backups[0].read_text())['catalogueHash'], self.payload['catalogueHash'])


if __name__ == '__main__':
    unittest.main()
