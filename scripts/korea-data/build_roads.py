"""Road level of the area map: every road shows, as a seam or a slit.

python scripts/korea-data/build_roads.py [--sgg 11680,41830]

Needs the leaves build_admin.py saves (data/korea/leaves/<시군구>.pkl: exactly what
the map shows at the walk level — a walk piece, or a block no walk road cut) and
roads.jsonl. Each leaf loses a thin band (ROAD_HALF_WIDTH_M each side) along every
road inside it: a road that closes off a face separates it from its neighbor, and a
dead end, a driveway or a footway leaves a slit that stops where the road stops, so
no road disappears the way it did when only closed faces counted. Pieces too small
or too narrow to show are dropped (their road is then simply a wider gap).

Output public/korea/admin/road/<시군구>/<읍면동>.json; codes <leaf code>-<n>.
"""
import argparse
import json
import pickle
import time
from collections import defaultdict

import numpy as np
import shapely
from shapely.geometry import LineString
from shapely.strtree import STRtree

import build_admin as B

ROAD_HALF_WIDTH_M = 0.4
MIN_PIECE_M2 = 4
MIN_PIECE_WIDTH_M = 1.0
SKIP_HIGHWAY = {"proposed", "construction", "elevator", "platform", "bus_stop", "services", "rest_area"}
B.LEVELS["road"] = {"simplify": 0.000003, "decimals": 6, "min_area": 1e-10}


def all_roads():
    """(bbox array, paths) of every surface road, cached."""
    if B.ALL_ROAD_CACHE.exists():
        return pickle.loads(B.ALL_ROAD_CACHE.read_bytes())
    boxes, paths = [], []
    with B.ROADS.open(encoding="utf-8") as archive:
        for line in archive:
            road = json.loads(line)
            tags = road["tags"]
            path = road["path"]
            if (len(path) < 2 or tags.get("highway") is None or tags["highway"] in SKIP_HIGHWAY
                    or tags.get("tunnel") in {"yes", "building_passage"} or tags.get("area") == "yes"
                    or tags.get("indoor") in {"yes", "corridor"}):
                continue
            xs, ys = [p[0] for p in path], [p[1] for p in path]
            boxes.append((min(xs), min(ys), max(xs), max(ys)))
            paths.append(path)
    data = (np.array(boxes, dtype="float64"), paths)
    B.ALL_ROAD_CACHE.write_bytes(pickle.dumps(data))
    return data


def lines_in(data, bounds):
    boxes, paths = data
    w, s, e, n = bounds
    hit = np.nonzero((boxes[:, 0] <= e) & (boxes[:, 2] >= w) & (boxes[:, 1] <= n) & (boxes[:, 3] >= s))[0]
    lines = [LineString(paths[i]) for i in hit]
    return lines, STRtree(lines)


def road_pieces(leaf, roads):
    """The leaf minus a thin band along each road inside it (whole when none is)."""
    lines, tree = roads
    inside = shapely.intersection([lines[i] for i in tree.query(leaf)], leaf)
    parts = [g for geom in inside for g in getattr(geom, "geoms", [geom])
             if g.geom_type == "LineString" and g.length > 0]
    if not parts:
        return [leaf]
    bands = shapely.buffer(parts, ROAD_HALF_WIDTH_M / B.DEG_M, quad_segs=1, cap_style="flat")
    rest = leaf.difference(shapely.union_all(bands))
    min_area = MIN_PIECE_M2 / B.M2_PER_DEG2
    narrow = MIN_PIECE_WIDTH_M / 2 / B.DEG_M
    out = []
    for piece in getattr(rest, "geoms", [rest]):
        if piece.geom_type == "Polygon" and piece.area >= min_area and not piece.buffer(-narrow).is_empty:
            out.append(piece)
    return out or [leaf]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sgg", help="comma-separated 시군구 codes (default: every one with leaves)")
    args = ap.parse_args()
    names = {}
    for f in json.loads(B.SOURCE.read_text(encoding="utf-8"))["features"]:
        p = f["properties"]
        names[p["adm_cd2"]] = (p["sgg"], p["adm_nm"].split(" ")[-1])
    data = all_roads()
    print(f"{len(data[1])} roads", flush=True)
    todo = sorted(p.stem for p in B.LEAF_DIR.glob("*.pkl") if not args.sgg or p.stem in args.sgg.split(","))
    total = 0
    for n, sgg in enumerate(todo, 1):
        started = time.time()
        leaves = [(c, shapely.from_wkb(w)) for c, w in pickle.loads((B.LEAF_DIR / f"{sgg}.pkl").read_bytes())]
        west = min(g.bounds[0] for _, g in leaves)
        south = min(g.bounds[1] for _, g in leaves)
        east = max(g.bounds[2] for _, g in leaves)
        north = max(g.bounds[3] for _, g in leaves)
        roads = lines_in(data, (west, south, east, north))
        files = defaultdict(list)
        for code, leaf in leaves:
            dong = code.split("-")[0]
            name = names[dong][1]
            for i, piece in enumerate(road_pieces(leaf, roads)):
                files[f"{dong}.json"].append({"code": f"{code}-{i}", "name": name, "bbox": B.bbox(piece, 6),
                                              "rings": B.rings(piece, "road")})
        B.write_dir(B.OUT / "road" / sgg, files)
        count = sum(map(len, files.values()))
        total += count
        size = sum(p.stat().st_size for p in (B.OUT / "road" / sgg).glob("*.json")) / 1e6
        print(f"[{n}/{len(todo)}] {sgg}: leaves {len(leaves)} → road pieces {count}, {size:.1f}MB, {time.time() - started:.0f}s",
              flush=True)
    print(f"{total} road pieces")


if __name__ == "__main__":
    main()
