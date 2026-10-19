"""Read the live sticker tray and apply a user-approved permutation by stable ID."""
import ast
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from datetime import datetime, timezone

CATALOGUE = Path('src/domain/decor.ts')
STRING = r'''(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")'''
ROW = re.compile(
    r'^[ \t]*\{[ \t]*id:[ \t]*(' + STRING + r'),[ \t]*label:[ \t]*('
    + STRING + r'),[ \t]*src:[ \t]*`\$\{import\.meta\.env\.BASE_URL\}stickers/([^`]+)`[ \t]*\},?[ \t]*$',
    re.MULTILINE,
)
ARRAY = re.compile(r'const STICKER_ASSETS: StickerAsset\[\] = \[(.*?)\n\];', re.DOTALL)
RETIRED = re.compile(r'const RETIRED_STICKER_IDS = new Set\(\[(.*?)\]\);', re.DOTALL)


def parse_source(source):
    expression = 'export const STICKERS: StickerAsset[] = STICKER_ASSETS.filter((sticker) => !RETIRED_STICKER_IDS.has(sticker.id));'
    if re.sub(r'\s+', '', expression) not in re.sub(r'\s+', '', source):
        raise ValueError('앱의 스티커 정렬 방식이 바뀌었습니다. 현재 순서를 먼저 확인해주세요.')
    block, retired_block = ARRAY.search(source), RETIRED.search(source)
    if not block or not retired_block:
        raise ValueError('앱의 스티커 목록 형식을 확인할 수 없습니다.')
    retired = {ast.literal_eval(m.group(0)) for m in re.finditer(STRING, retired_block.group(1))}
    rows = list(ROW.finditer(block.group(1)))
    remaining = ROW.sub('', block.group(1))
    if any(line.strip() and not line.strip().startswith('//') for line in remaining.splitlines()):
        raise ValueError('읽지 못한 스티커 항목이 있습니다. 목록 형식을 확인해주세요.')
    items = []
    for row in rows:
        identifier, label = ast.literal_eval(row.group(1)), ast.literal_eval(row.group(2))
        asset = row.group(3)
        if not re.fullmatch(r'[A-Za-z0-9._-]+\.png(?:\?v=[A-Za-z0-9_-]+)?', asset):
            raise ValueError('지원하지 않는 이미지 경로입니다.')
        items.append({'id': identifier, 'label': label, 'src': '/stickers/' + asset})
    if not items or len({i['id'] for i in items}) != len(items):
        raise ValueError('스티커 ID가 비어 있거나 중복됐습니다.')
    active = [item for item in items if item['id'] not in retired]
    return block, rows, retired, active


def read_catalogue(repo):
    source = (repo / CATALOGUE).read_text()
    _, _, _, items = parse_source(source)
    for item in items:
        asset = item['src'].split('?', 1)[0].removeprefix('/')
        if not (repo / 'public' / asset).is_file():
            raise ValueError('이미지 파일이 없습니다: ' + item['id'])
    fingerprint = hashlib.sha256(json.dumps(items, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    return {'catalogueHash': fingerprint, 'items': items}


def validate_order(payload, catalogue):
    ids = payload.get('ids')
    current = [item['id'] for item in catalogue['items']]
    if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
        raise ValueError('스티커 ID 목록이 필요합니다.')
    if len(ids) != len(current) or len(set(ids)) != len(ids) or set(ids) != set(current):
        raise ValueError('스티커가 누락되거나 중복됐습니다. 현재 목록 전체를 포함해야 합니다.')
    if payload.get('catalogueHash') != catalogue['catalogueHash']:
        raise ValueError('앱의 스티커 목록이 바뀌었습니다. 앱 목록을 다시 불러와주세요.')
    removed = payload.get('removedIds', [])
    if (not isinstance(removed, list) or not all(isinstance(i, str) for i in removed)
            or len(set(removed)) != len(removed) or not set(removed).issubset(ids)):
        raise ValueError('삭제 목록에 중복되거나 알 수 없는 스티커가 있습니다.')
    return ids


def order_document(payload, catalogue):
    ids = validate_order(payload, catalogue)
    lookup = {item['id']: item for item in catalogue['items']}
    removed = set(payload.get('removedIds', []))
    return {
        'version': 2,
        'catalogueHash': catalogue['catalogueHash'],
        'ids': ids,
        'removedIds': [identifier for identifier in ids if identifier in removed],
        'completed': payload.get('completed') is True,
        'savedAt': datetime.now(timezone.utc).isoformat(),
        'items': [dict(position=n + 1, **lookup[identifier]) for n, identifier in enumerate(i for i in ids if i not in removed)],
        'removedItems': [lookup[i] for i in ids if i in removed],
    }


def atomic_json(path, document):
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix='.order-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'w') as stream:
            json.dump(document, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def apply_order(repo, order_file):
    payload = json.loads(order_file.read_text())
    if payload.get('completed') is not True:
        raise ValueError('정렬 완료 저장을 먼저 눌러주세요.')
    catalogue = read_catalogue(repo)
    current = [item['id'] for item in catalogue['items']]
    path = repo / CATALOGUE
    source = path.read_text()
    block, rows, retired, _ = parse_source(source)
    raw_ids, raw_removed = payload.get('ids'), payload.get('removedIds', [])
    if (isinstance(raw_ids, list) and all(isinstance(i, str) for i in raw_ids)
            and isinstance(raw_removed, list) and all(isinstance(i, str) for i in raw_removed)
            and len(set(raw_ids)) == len(raw_ids) and len(set(raw_removed)) == len(raw_removed)
            and set(raw_removed).issubset(raw_ids) and set(raw_removed).issubset(retired)
            and [i for i in raw_ids if i not in raw_removed] == current):
        return False
    ids = validate_order(payload, catalogue)
    removed = set(payload.get('removedIds', []))
    originals = {ast.literal_eval(row.group(1)): row.group(0) for row in rows}
    ordered = iter(i for i in ids if i not in removed)

    def replace(row):
        identifier = ast.literal_eval(row.group(1))
        return row.group(0) if identifier in retired or identifier in removed else originals[next(ordered)]

    changed = ROW.sub(replace, block.group(1))
    updated = source[:block.start(1)] + changed + source[block.end(1):]
    if removed:
        retired_block = RETIRED.search(updated)
        content = retired_block.group(1).rstrip()
        if content and not content.endswith(','):
            content += ','
        content += ''.join('\n  ' + json.dumps(i) + ',' for i in ids if i in removed) + '\n'
        updated = updated[:retired_block.start(1)] + content + updated[retired_block.end(1):]
    backup_dir = repo / 'output/sticker-order/backups'
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    (backup_dir / ('decor-' + stamp + '.ts')).write_text(source)
    descriptor, temporary = tempfile.mkstemp(prefix='.decor-order-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'w') as stream:
            stream.write(updated)
        os.chmod(temporary, path.stat().st_mode)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return True
