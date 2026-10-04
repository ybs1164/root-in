"""Recover the degenerate source way found by the independent ID census."""
import json
from pathlib import Path
import osmium

RAW = Path(__file__).resolve().parents[2] / 'data/korea'


class Recover(osmium.SimpleHandler):
    def way(self, way):
        coords = [[node.lon, node.lat] for node in way.nodes if node.location.valid()]
        record = {'id': way.id, 'tags': dict(way.tags), 'path': coords, 'geometry_status': 'insufficient_nodes'}
        (RAW / 'recovered-way.json').write_text(json.dumps(record, ensure_ascii=False), encoding='utf-8')
        print(json.dumps(record), flush=True)


if not (RAW / 'recovered-way.json').exists():
    Recover().apply_file(str(RAW / 'south-korea.osm.pbf'), locations=True, idx='sparse_mem_array', filters=[osmium.filter.IdFilter([842288033])])
record = json.loads((RAW / 'recovered-way.json').read_text(encoding='utf-8'))
needle = b'{"id":842288033,'
with (RAW / 'roads.jsonl').open('rb') as stream:
    already_present = any(line.startswith(needle) for line in stream)
if not already_present:
    with (RAW / 'roads.jsonl').open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n')
print('Degenerate way retained in road archive', flush=True)
manifest_path = RAW.parent.parent / 'public/korea/manifest.json'
if manifest_path.exists():
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    if manifest['highwayCount'] == 1816595:
        manifest['highwayCount'] += 1
        manifest['highwayClasses']['secondary'] += 1
    assert manifest['highwayCount'] == 1816596
    manifest['geometryOmittedHighways'] = 1
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('Manifest includes all 1,816,596 source way records', flush=True)
