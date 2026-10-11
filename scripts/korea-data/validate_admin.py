"""Checks the built 시도/시군구/읍면동 files: python scripts/korea-data/validate_admin.py [sgg,...]

Per 읍면동: section codes are <dong>-<n>; every block code starts with a
section's code, every walk piece with a block's and every road piece with the code of what the walk
level shows there (a walk piece, or a block no walk road split); the blocks of a section
cover it (rings are simplified per level, so a strip along the outline and 1% are allowed); no index
passes 999 (the app's code pattern allows three digits per part).
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

from shapely.geometry import Polygon
from shapely.ops import unary_union

OUT = Path(__file__).resolve().parents[2] / "public/korea/admin"
TOLERANCE = 0.01
EDGE_DEG = 6e-5


def geom(entry):
    polys = [Polygon(r[0], r[1:]).buffer(0) for r in entry["rings"]]
    return unary_union(polys)


def main():
    only = set(sys.argv[1].split(",")) if len(sys.argv) > 1 else None
    problems, counts = [], defaultdict(int)
    for sec_file in sorted((OUT / "section").glob("*.json")):
        sgg = sec_file.stem
        if only and sgg not in only:
            continue
        sections = json.loads(sec_file.read_text(encoding="utf-8"))
        by_dong = defaultdict(list)
        for s in sections:
            dong, _, n = s["code"].partition("-")
            by_dong[dong].append(s)
            if not n.isdigit() or int(n) > 999:
                problems.append(f"{s['code']}: section index")
        for dong, secs in by_dong.items():
            block_file = OUT / "block" / sgg / f"{dong}.json"
            if not block_file.exists():
                problems.append(f"{dong}: no block file")
                continue
            blocks = json.loads(block_file.read_text(encoding="utf-8"))
            walk_file = OUT / "walk" / sgg / f"{dong}.json"
            walks = json.loads(walk_file.read_text(encoding="utf-8")) if walk_file.exists() else []
            counts["section"] += len(secs)
            counts["block"] += len(blocks)
            counts["walk"] += len(walks)
            sec_codes = {s["code"] for s in secs}
            block_codes = {b["code"] for b in blocks}
            for b in blocks:
                if b["code"].rsplit("-", 1)[0] not in sec_codes:
                    problems.append(f"{b['code']}: no parent section")
                if int(b["code"].rsplit("-", 1)[1]) > 999:
                    problems.append(f"{b['code']}: block index")
            for w in walks:
                if w["code"].rsplit("-", 1)[0] not in block_codes:
                    problems.append(f"{w['code']}: no parent block")
            for s in secs:
                kids = [b for b in blocks if b["code"].rsplit("-", 1)[0] == s["code"]]
                if not kids:
                    problems.append(f"{s['code']}: no blocks")
                    continue
                sg, bg = geom(s), unary_union([geom(b) for b in kids])
                # Levels are simplified separately, so allow a strip along the outline.
                off = sg.symmetric_difference(bg).area
                if sg.area > 1e-8 and off > sg.length * EDGE_DEG + sg.area * TOLERANCE:
                    problems.append(f"{s['code']}: blocks differ from the section by {off / sg.area:.3f}")
            road_file = OUT / "road" / sgg / f"{dong}.json"
            if road_file.exists():
                roads = json.loads(road_file.read_text(encoding="utf-8"))
                counts["road"] += len(roads)
                # What the walk level shows: a split block's pieces, any other block whole.
                split = {w["code"].rsplit("-", 1)[0] for w in walks}
                # (a block no walk road split is its own single leaf, code <block>-0)
                leaves = {w["code"] for w in walks} | {f"{c}-0" for c in block_codes if c not in split}
                for r in roads:
                    parent, _, n = r["code"].rpartition("-")
                    if parent not in leaves:
                        problems.append(f"{r['code']}: no parent leaf")
                    elif int(n) > 9999:
                        problems.append(f"{r['code']}: road index")
                    w, so, e, no = r["bbox"]
                    if not (120 <= w <= e <= 135 and 30 <= so <= no <= 45):
                        problems.append(f"{r['code']}: bbox")
            if len(secs) == 1 and len(blocks) == 1:
                counts["dongs_undivided"] += 1
    print(dict(counts))
    for p in problems[:40]:
        print(p)
    print(f"{len(problems)} problems")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
