"""Sample run for the walk level (W1-W3 in docs/plan-walk-pieces.md):
python scripts/korea-data/tune_walk.py [sgg,...]  -> blocks split, pieces, JSON KB per (urban|rural), per setting."""
import json
import pickle
import sys
import time
from collections import defaultdict

import shapely
from shapely.geometry import LineString, shape
from shapely.strtree import STRtree

import build_admin as B

SAMPLE = "11680,11440,41113,41830,52800,47130"
URBAN = (2_500, 0.10, 8_000)
MID = (1_200, 0.05, 4_000)
RURAL = (10_000, 0.10, 30_000)


def boundary_lines(kinds):
    lines, tree = B.load_boundaries(kinds)
    return lines, tree


ALL = ("area", "water", "rail", "fence")
LINE = ("water", "rail", "fence")
BIG = (30_000, 0.15, 100_000)
HUGE = (60_000, 0.2, 200_000)
SETTINGS = [  # name, urban kinds, rural kinds, urban min, rural min
    ("rural line big", ALL, LINE, URBAN, BIG),
    ("rural line huge", ALL, LINE, URBAN, HUGE),
    ("rural all big", ALL, ALL, URBAN, BIG),
    ("urban mid", ALL, LINE, MID, BIG),
]


def main():
    want = set((sys.argv[1] if len(sys.argv) > 1 else SAMPLE).split(","))
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
    trees = {}
    blocks = []
    for code, name, dong in dongs:
        t = B.dong_tree(code, dong, main_r, block, ([], STRtree([])))
        blocks.extend((("rural" if name.endswith(B.RURAL) else "urban"), bc, g) for bc, g, _ in t["block"])
    print(len(blocks), "blocks", flush=True)
    for name, ukinds, rkinds, umin, rmin in SETTINGS:
        started = time.time()
        for k in (ukinds, rkinds):
            if k not in trees:
                trees[k] = boundary_lines(set(k))
        stat = defaultdict(lambda: defaultdict(float))
        for kind, bc, blk in blocks:
            s = stat[kind]
            s["blocks"] += 1
            extra = trees[rkinds if kind == "rural" else ukinds]
            pieces, _ = B.walk_pieces(blk, walk, extra, rmin if kind == "rural" else umin, 0)
            if len(pieces) > 1:
                s["split"] += 1
                s["pieces"] += len(pieces)
                s["kb"] += len(json.dumps([B.rings(p, "walk") for p in pieces], separators=(",", ":"))) / 1e3
        print(f"{name:20s} {time.time() - started:4.0f}s", {k: {a: round(b) for a, b in v.items()} for k, v in stat.items()}, flush=True)


if __name__ == "__main__":
    main()
