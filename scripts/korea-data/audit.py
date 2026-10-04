"""Audit collected way IDs without keeping the full coordinate database in RAM."""
from collections import Counter
from pathlib import Path
import osmium

path = Path(__file__).resolve().parents[2] / "data/korea/roads.jsonl"
ids = Counter()
with path.open(encoding="utf-8") as stream:
    for line in stream:
        ids[int(line.split(",", 1)[0][6:])] += 1
print({"records": sum(ids.values()), "uniqueWays": len(ids), "duplicateRecords": sum(n - 1 for n in ids.values()), "maxCopies": max(ids.values())})


class SourceIds(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.ids = set()

    def way(self, way):
        if "highway" in way.tags:
            self.ids.add(way.id)


source = SourceIds()
source.apply_file(str(path.with_name("south-korea.osm.pbf")))
missing = source.ids.difference(ids)
extra = ids.keys() - source.ids
print({"sourceWays": len(source.ids), "missingFromArchive": len(missing), "extraInArchive": len(extra)}, flush=True)
assert not missing and not extra, {"missingSample": sorted(missing)[:10], "extraSample": sorted(extra)[:10]}
assert all(n == 1 for n in ids.values())
