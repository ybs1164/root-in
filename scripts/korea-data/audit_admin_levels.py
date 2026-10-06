"""Read-only check of how completely each 읍면동 is divided at the three levels.

python scripts/korea-data/audit_admin_levels.py 11680,11440 [--out file.json]

Per level: piece count, median/max area, share of the area in pieces a road of
that level could still cut ("unfinished": cutting the piece again gives more
than one face), and the share held by tiny pieces. Used before and after the
D1-D3 rule changes in docs/plan-dong-sections.md.
"""
import argparse
import json
import statistics
from collections import defaultdict

from shapely.geometry import shape
from shapely.strtree import STRtree
import shapely

import build_admin as B


def faces_of(area, roads):
    lines, tree = roads
    from shapely.ops import polygonize, unary_union
    edges = unary_union([area.boundary, *(lines[i].intersection(area) for i in tree.query(area))])
    return [f for f in polygonize(edges) if area.contains(f.representative_point())]


def unfinished(piece, roads, minimum):
    """True when a road still cuts the piece into two faces that both reach the merge minimum."""
    big = [f for f in faces_of(piece, roads) if f.area >= minimum]
    return len(big) > 1


def stats(pieces):
    pieces = [(c, g, unfinished(g, *r)) for c, g, r in pieces]
    areas = [g.area * B.M2_PER_DEG2 for _, g, _ in pieces]
    total = sum(areas) or 1
    return {
        "pieces": len(pieces),
        "median_m2": round(statistics.median(areas)) if areas else 0,
        "max_m2": round(max(areas)) if areas else 0,
        "unfinished_share": round(sum(a for a, (_, _, u) in zip(areas, pieces) if u) / total, 4),
        "unfinished_pieces": sum(1 for _, _, u in pieces if u),
        "tiny_share": round(sum(a for a in areas if a < 800) / total, 4),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sgg")
    ap.add_argument("--out")
    args = ap.parse_args()
    want = set(args.sgg.split(","))
    features = json.loads(B.SOURCE.read_text(encoding="utf-8"))["features"]
    dongs = defaultdict(list)
    for f in features:
        p = f["properties"]
        if p["sgg"] in want:
            dongs[p["sgg"]].append((p["adm_cd2"], shapely.make_valid(shape(f["geometry"]))))
    roads = B.section_roads()
    main_lines = [l for m, l in roads if m]
    main = (main_lines, STRtree(main_lines))
    lines = B.block_roads()
    block_l = [l for k, l in lines if k == "block"]
    walk_l = [l for k, l in lines if k == "walk"]
    block = (block_l, STRtree(block_l))
    walk = (walk_l, STRtree(walk_l))
    report = {}
    for sgg, items in dongs.items():
        levels = {"section": [], "block": [], "walk": []}
        single = 0
        for code, dong in items:
            secs = B.dong_tree(code, dong, main, block, walk)
            for level in levels:
                levels[level].extend(secs[level])
            single += len(secs["section"]) == 1
        report[sgg] = {lv: stats(p) for lv, p in levels.items()}
        report[sgg]["dongs_with_one_section"] = single
        print(sgg, json.dumps(report[sgg], ensure_ascii=False), flush=True)
    if args.out:
        open(args.out, "w", encoding="utf-8").write(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
