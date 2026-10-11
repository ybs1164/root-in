"""Every `highway` way of the pinned Geofabrik extract as data/korea/roads.jsonl.

python scripts/korea-data/extract_roads.py [--pbf path] [--out path]

One JSON line per way: {"id", "tags", "path": [[lon, lat], ...]} in file order,
plus "geometry_status" and "node_refs" when a node is missing from the extract.
This is the same file build.py writes while it builds the older tile levels
(and what its --reuse-roads reads), without that pipeline's land and water
work. build_admin.py, build_roads.py and build_base.py read it.
The pinned extract has 1,816,596 highways; another snapshot gives another
count, which is reported, not an error, when --pbf is used.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import osmium

ROOT = Path(__file__).resolve().parents[2]
PBF = ROOT / "data/korea/south-korea.osm.pbf"
OUT = ROOT / "data/korea/roads.jsonl"
PINNED_HIGHWAYS = 1_816_596


class Roads(osmium.SimpleHandler):
    def __init__(self, archive):
        super().__init__()
        self.archive = archive
        self.count = 0
        self.incomplete = 0
        self.started = time.time()

    def way(self, way):
        if "highway" not in way.tags:
            return
        try:
            coords = [(n.lon, n.lat) for n in way.nodes]
        except osmium.InvalidLocationError:
            coords = [(n.lon, n.lat) for n in way.nodes if n.location.valid()]
        record = {"id": way.id, "tags": dict(way.tags), "path": coords}
        if len(coords) != len(way.nodes) or len(coords) < 2:
            record["geometry_status"] = "insufficient_nodes" if len(coords) == len(way.nodes) else "missing_nodes"
            record["node_refs"] = [node.ref for node in way.nodes]
            self.incomplete += 1
        self.archive.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        self.count += 1
        if self.count % 200_000 == 0:
            print(f"  {self.count:,} highways, {time.time() - self.started:.0f}s", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pbf", type=Path, default=PBF)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    part = args.out.with_name(args.out.name + ".part")
    with part.open("w", encoding="utf-8") as archive:
        handler = Roads(archive)
        handler.apply_file(str(args.pbf), locations=True, idx="sparse_mem_array")
    part.replace(args.out)
    print(f"{handler.count:,} highways ({handler.incomplete} with missing nodes) -> {args.out}", flush=True)
    if handler.count != PINNED_HIGHWAYS:
        print(f"note: the pinned extract has {PINNED_HIGHWAYS:,}; this one has {handler.count:,}", file=sys.stderr)


if __name__ == "__main__":
    main()
