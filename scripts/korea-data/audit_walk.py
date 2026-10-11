"""Why blocks aren't split by walk roads (read-only): python scripts/korea-data/audit_walk.py [sgg,...] [--out f.json]

Per urban (동) / rural (읍·면) and block-area bucket: blocks, blocks a walk
road crosses, how far dead-end walk roads stop from another road, and how many
blocks different merge minimums would split (pieces + JSON bytes).
"""
import argparse
import json
from collections import defaultdict

import shapely
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

import build_admin as B

SAMPLE = "11680,11440,41113,41830,52800,47130"
CONFIGS = {"now": (2_500, 0.10, 8_000), "mid": (1_200, 0.05, 4_000), "low": (600, 0.05, 2_000)}
GAPS = (3, 6, 10, 20)
M = 1e5  # metres per degree, close enough for gap bins


def bucket(m2):
    return "<8k" if m2 < 8_000 else "8k-30k" if m2 < 30_000 else ">30k"


def endpoints(line):
    c = list(line.coords)
    return [Point(c[0]), Point(c[-1])]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sgg", nargs="?", default=SAMPLE)
    ap.add_argument("--out")
    args = ap.parse_args()
    want = set(args.sgg.split(","))
    feats = json.loads(B.SOURCE.read_text(encoding="utf-8"))["features"]
    dongs = [(f["properties"]["adm_cd2"], f["properties"]["adm_nm"].split(" ")[-1],
              shapely.make_valid(shape(f["geometry"]))) for f in feats if f["properties"]["sgg"] in want]
    roads = B.section_roads()
    ml = [l for m, l in roads if m]
    main_r = (ml, STRtree(ml))
    ln = B.block_roads()
    bl = [l for k, l in ln if k == "block"]
    wl = [l for k, l in ln if k == "walk"]
    del ln
    block, walk = (bl, STRtree(bl)), (wl, STRtree(wl))
    allr = bl + wl + ml
    all_tree = STRtree(allr)
    stat = defaultdict(lambda: defaultdict(float))
    for code, name, dong in dongs:
        kind = "rural" if name.endswith(B.RURAL) else "urban"
        tree = B.dong_tree(code, dong, main_r, block, walk)
        for bc, blk, _ in tree["block"]:
            m2 = blk.area * B.M2_PER_DEG2
            s = stat[(kind, bucket(m2))]
            s["blocks"] += 1
            s["area_m2"] += m2
            inside = [wl[i].intersection(blk) for i in walk[1].query(blk)]
            inside = [g for g in inside if g.length * M > 20]
            if not inside:
                continue
            s["crossed"] += 1
            ends = [e for g in inside for line in getattr(g, "geoms", [g]) if line.geom_type == "LineString"
                    for e in endpoints(line)]
            for e in ends:
                if e.distance(blk.boundary) * M < 1:
                    continue
                near = [r for r in (allr[i] for i in all_tree.query(e.buffer(25 / M))) if r.distance(e) * M > 0.5]
                d = min((r.distance(e) * M for r in near), default=99)
                s["ends"] += 1
                for g in GAPS:
                    if 0.5 < d <= g:
                        s[f"gap<={g}"] += 1
                        break
                else:
                    s["gap>20"] += 1
            for name_cfg, cfg in CONFIGS.items():
                pieces = B.split(blk, walk, cfg)
                if len(pieces) > 1:
                    s[f"split_{name_cfg}"] += 1
                    s[f"pieces_{name_cfg}"] += len(pieces)
                    s[f"kb_{name_cfg}"] += len(json.dumps([B.rings(p, "walk") for p in pieces], separators=(",", ":"))) / 1e3
    rows = {}
    for key in sorted(stat):
        rows["/".join(key)] = {k: round(v) for k, v in stat[key].items()}
        print("/".join(key), json.dumps(rows["/".join(key)]), flush=True)
    if args.out:
        open(args.out, "w", encoding="utf-8").write(json.dumps(rows, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
