"""Local sticker sorting tool; saving in the browser never changes the app."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from datetime import datetime, timezone
import re
import threading
from urllib.parse import urlsplit

from catalogue import apply_order, atomic_json, order_document, read_catalogue

REPO = Path(__file__).resolve().parents[2]
UI = Path(__file__).with_name('index.html')
SAVE_LOCK = threading.Lock()


def handler_for(repo, state_dir):
    class Handler(BaseHTTPRequestHandler):
        def send(self, data, status=200, content_type='application/json; charset=utf-8'):
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def json(self, document, status=200):
            self.send(json.dumps(document, ensure_ascii=False).encode(), status)

        def valid_host(self):
            port = self.server.server_port
            return self.headers.get('Host') in (f'127.0.0.1:{port}', f'localhost:{port}')

        def do_GET(self):
            if not self.valid_host():
                self.json({'error': '잘못된 주소입니다.'}, 403)
                return
            route = urlsplit(self.path).path
            try:
                if route in ('/', '/index.html'):
                    self.send(UI.read_bytes(), content_type='text/html; charset=utf-8')
                elif route == '/api/catalogue':
                    self.json(read_catalogue(repo))
                elif route == '/api/order':
                    path = state_dir / 'order.json'
                    self.json(json.loads(path.read_text()) if path.exists() else None)
                elif route.startswith('/stickers/'):
                    filename = route.removeprefix('/stickers/')
                    if not re.fullmatch(r'[A-Za-z0-9._-]+\.png', filename):
                        raise ValueError('잘못된 이미지 경로입니다.')
                    self.send((repo / 'public/stickers' / filename).read_bytes(), content_type='image/png')
                else:
                    self.json({'error': '페이지가 없습니다.'}, 404)
            except (ValueError, OSError) as error:
                self.json({'error': str(error)}, 400)

        def do_POST(self):
            origin = self.headers.get('Origin')
            if (not self.valid_host() or self.headers.get('Sec-Fetch-Site') == 'cross-site'
                    or origin not in (None, 'http://' + self.headers.get('Host', ''))):
                self.json({'error': '이 페이지에서만 저장할 수 있습니다.'}, 403)
                return
            if self.path != '/api/order':
                self.json({'error': '페이지가 없습니다.'}, 404)
                return
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 65536:
                    raise ValueError('저장할 목록의 크기가 올바르지 않습니다.')
                payload = json.loads(self.rfile.read(length))
                if not isinstance(payload, dict):
                    raise ValueError('올바른 정렬 목록이 필요합니다.')
                with SAVE_LOCK:
                    document = order_document(payload, read_catalogue(repo))
                    existing = state_dir / 'order.json'
                    if existing.exists():
                        old = json.loads(existing.read_text())
                        if old.get('catalogueHash') != document['catalogueHash']:
                            stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
                            atomic_json(state_dir / 'backups' / ('order-' + stamp + '.json'), old)
                    atomic_json(state_dir / 'order.json', document)
                self.json(document)
            except (ValueError, TypeError, OSError) as error:
                self.json({'error': str(error)}, 400)

    return Handler


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=5178)
    parser.add_argument('--apply', type=Path, help='Apply a completed order JSON; no server is started.')
    args = parser.parse_args()
    if args.apply:
        changed = apply_order(REPO, args.apply)
        print('저장된 순서를 앱에 적용했습니다.' if changed else '이미 같은 순서입니다.')
    else:
        print(f'스티커 정렬 도구: http://127.0.0.1:{args.port}/', flush=True)
        ThreadingHTTPServer(('127.0.0.1', args.port), handler_for(REPO, REPO / 'output/sticker-order')).serve_forever()
