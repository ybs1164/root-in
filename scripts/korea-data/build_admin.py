"""Build administrative area files: 시도 → 시군구 → 읍면동 (행정동) → 구획 → 블록 → 보행로 조각.

The map no longer splits land along roads. It shows the 시군구 at the screen
center divided into its 읍면동, and everything else as whole areas, so the
app needs three nested levels it can load one parent at a time.

Source: vuski/admdongkor HangJeongDong geojson, based on Statistics Korea
SGIS boundaries (KOGL Type 1, attribution required; edits CC BY 4.0).

Below 읍면동 there is no open boundary data, so each 읍면동 is cut into
sections (구획) by main roads (tertiary and wider). Only roads that close
off a face count: dead ends and stubs don't cut. Pieces under a minimum size
(slivers) are merged into a neighbor.

Closer in, every section is cut into blocks by local and service roads, and a
block by footways and the lanes inside parking lots and apartment complexes.
Footways in OSM rarely close off a face (sidewalks are left out, the rest are
mostly dead ends), so only blocks that footways actually split get pieces;
the app keeps the block whole elsewhere.

python scripts/korea-data/build_admin.py [--sgg 11680,41830] [--resume]
--sgg rebuilds only those 시군구's section/block/walk files (the 시도/시군구/읍면동 files are cheap and always written, so a partial build still opens).
--resume skips 시군구 whose block files are already complete.
Needs data/korea/HangJeongDong_ver20260701.geojson and roads.jsonl (see README.md).
"""
import argparse
import json
import os
import pickle
import shutil
from collections import defaultdict
from pathlib import Path

import shapely
from shapely.geometry import LineString, shape
from shapely.ops import nearest_points, polygonize, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data/korea/HangJeongDong_ver20260701.geojson"
SOURCE_URL = "https://github.com/vuski/admdongkor/blob/master/ver20260701/HangJeongDong_ver20260701.geojson"
OUT = ROOT / "public/korea/admin"
ROADS = ROOT / "data/korea/roads.jsonl"
ROAD_CACHE = ROOT / "data/korea/section-roads.pkl"
BLOCK_ROAD_CACHE = ROOT / "data/korea/block-roads.pkl"
ALL_ROAD_CACHE = ROOT / "data/korea/all-roads.pkl"
LEAF_DIR = ROOT / "data/korea/leaves"
# A 읍면동 is divided in three passes by road class, each pass covering the
# whole area and nesting in the last (docs/plan-dong-sections.md):
#   sections: main roads only; blocks: + local, living and service roads;
#   walk pieces: + footways. No piece is skipped for being small or large;
# slivers are merged into a neighbor until each piece reaches the minimum
# (m², share of the parent, cap in m² so a huge parent doesn't swallow
# real blocks), and pieces no road crosses stay whole.
MAIN_HIGHWAYS = {"motorway", "trunk", "primary", "secondary", "tertiary"}
LOCAL_HIGHWAYS = {"unclassified", "residential"}
MAIN_MIN = (15_000, 0.01, 100_000)
M2_PER_DEG2 = 88_900 * 110_540
DEG_M = 100_000  # metres per degree, for the few-metre tolerances only
# Blocks: sections cut by every road a car uses (lanes inside parking lots
# and driveways only chop apartment complexes into slivers, so they wait for
# the walk level).
BLOCK_HIGHWAYS = LOCAL_HIGHWAYS | {"living_street", "service"}
MINOR_SERVICE = {"parking_aisle", "driveway", "drive-through"}
BLOCK_MIN = (8_000, 0.10, 50_000)
# Walk pieces: blocks cut by footways and the minor service lanes. Sidewalks
# and crossings run along roads and only make strips. Farm tracks are left
# out too: they cut fields into pieces that mean nothing on the map, and made
# rural walk files bigger than their blocks.
WALK_HIGHWAYS = {"footway", "path", "pedestrian", "steps", "cycleway"}
RURAL = ("읍", "면")
WALK_MIN = (2_500, 0.10, 8_000)
WALK_MIN_RURAL = (30_000, 0.15, 100_000)
WALK_SNAP_M = 0
WALK_FILE_MAX = 1_000_000  # bytes of one 읍면동's walk file; over it, the minimum doubles
# Degrees of tolerance and coordinate decimals per level. Corners are rounded
# on screen anyway, so detail finer than a few pixels at the level's usual
# zoom is wasted bytes. Small islands are dropped below MIN_AREA.
LEVELS = {
    "sido": {"simplify": 0.004, "decimals": 3, "min_area": 4e-5},
    "sgg": {"simplify": 0.0008, "decimals": 4, "min_area": 2e-6},
    "dong": {"simplify": 0.00012, "decimals": 5, "min_area": 2e-7},
    "section": {"simplify": 0.00007, "decimals": 5, "min_area": 2e-8},
    "block": {"simplify": 0.00003, "decimals": 5, "min_area": 2e-9},
    "walk": {"simplify": 0.000015, "decimals": 5, "min_area": 5e-10},
    "walk_rural": {"simplify": 0.00004, "decimals": 5, "min_area": 5e-9},
}


def section_roads():
    """Surface roads as (is_main, LineString); parsing roads.jsonl takes minutes, so cache."""
    if ROAD_CACHE.exists():
        paths = pickle.loads(ROAD_CACHE.read_bytes())
    else:
        paths = []
        with ROADS.open(encoding="utf-8") as archive:
            for line in archive:
                road = json.loads(line)
                tags = road["tags"]
                highway = tags.get("highway")
                if highway not in MAIN_HIGHWAYS | LOCAL_HIGHWAYS or len(road["path"]) < 2:
                    continue
                # A tunnel doesn't divide the ground above it.
                if tags.get("tunnel") in {"yes", "building_passage"} or tags.get("area") == "yes":
                    continue
                paths.append((highway in MAIN_HIGHWAYS, road["path"]))
        ROAD_CACHE.write_bytes(pickle.dumps(paths))
    return [(main, LineString(p)) for main, p in paths]


def block_roads():
    """Surface roads as (kind, LineString), kind "block" | "walk" (footways and minor service lanes)."""
    if BLOCK_ROAD_CACHE.exists():
        paths = pickle.loads(BLOCK_ROAD_CACHE.read_bytes())
    else:
        paths = []
        with ROADS.open(encoding="utf-8") as archive:
            for line in archive:
                road = json.loads(line)
                tags = road["tags"]
                highway = tags.get("highway")
                if len(road["path"]) < 2 or tags.get("tunnel") in {"yes", "building_passage"} or tags.get("area") == "yes":
                    continue
                if highway in BLOCK_HIGHWAYS and tags.get("service") not in MINOR_SERVICE:
                    paths.append(("block", road["path"]))
                elif highway == "service":
                    paths.append(("minor", road["path"]))
                elif (highway in WALK_HIGHWAYS and tags.get("footway") not in {"sidewalk", "crossing"}
                      and tags.get("indoor") not in {"yes", "corridor"}):
                    paths.append(("walk", road["path"]))
        BLOCK_ROAD_CACHE.write_bytes(pickle.dumps(paths))
    return [("block" if kind == "block" else "walk", LineString(p)) for kind, p in paths]


def cut(area, lines, tree, min_area, depth=0, recut=True):
    """Faces of the area cut by roads (dead ends don't cut), small ones merged."""
    edges = unary_union([area.boundary, *(lines[i].intersection(area) for i in tree.query(area))])
    faces = [f for f in polygonize(edges) if area.contains(f.representative_point())]
    if not faces:
        return [area]
    # Small faces with no neighbor to join (an island) stay on their own;
    # dropping them left island 읍면동 with missing land.
    alone = []
    merged = set()
    while len(faces) > 1:
        small = min(range(len(faces)), key=lambda i: faces[i].area)
        if faces[small].area >= min_area:
            break
        face = faces.pop(small)
        merged = {i - (i > small) for i in merged if i != small}
        # The neighbor sharing the longest border swallows it.
        shared = [face.boundary.intersection(f.boundary).length for f in faces]
        best = max(range(len(faces)), key=lambda i: shared[i])
        if shared[best] == 0:
            alone.append(face)
            continue
        faces[best] = shapely.make_valid(unary_union([faces[best], face]))
        merged.add(best)
    # A merged piece has new edges, so a road that used to dead-end into the
    # swallowed sliver can now close a face across it: cut those once more.
    out = []
    for i, f in enumerate(faces):
        again = cut(f, lines, tree, min_area, depth + 1) if recut and i in merged and depth < 2 and f.geom_type == "Polygon" else [f]
        out.extend(again)
    return [g for f in out + alone for g in getattr(f, "geoms", [f]) if g.geom_type == "Polygon"]


def load_boundaries():
    """(urban, rural) boundary lines, each (lines, STRtree), or (None, None) without the cache.

    Urban 동 get every kind (landuse/leisure/amenity outlines are what split city
    blocks); 읍·면 only rivers, railways and fences, because field and forest
    outlines tripled their data for pieces nobody looks at. Outlines of areas
    under 2,500 m² (pools, pitches) are left out: they only make slivers."""
    path = ROOT / "data/korea/boundaries.pkl"
    if not path.exists():
        return None, None
    urban, rural = [], []
    for kind, pts in pickle.loads(path.read_bytes()):
        if len(pts) < 2:
            continue
        if kind == "area":
            if pts[0] == pts[-1] and len(pts) >= 4 and shapely.Polygon(pts).buffer(0).area * M2_PER_DEG2 < 2_500:
                continue
            urban.append(LineString(pts))
        else:
            urban.append(LineString(pts))
            rural.append(urban[-1])
    urban, rural = chunk_lines(urban), chunk_lines(rural)
    return (urban, STRtree(urban)), (rural, STRtree(rural))


def chunk_lines(lines, size=30):
    """Long boundary lines cut into runs of at most `size` vertices.

    A river or a landuse outline runs for kilometres; clipping the whole line
    for every block it touches was most of the build time."""
    out = []
    for line in lines:
        c = line.coords
        if len(c) <= size:
            out.append(line)
            continue
        for i in range(0, len(c) - 1, size - 1):
            part = c[i:i + size]
            if len(part) >= 2:
                out.append(LineString(part))
    return out


def snap_gaps(blk, walk_lines, others, tol_m):
    """Connectors from dead-end walk roads to the nearest other line within tol_m.

    OSM footways often stop a few metres short of the road or path they meant
    to join, so no face closes. The connectors are used for cutting only."""
    tol = tol_m / DEG_M
    boundary = blk.boundary
    clipped = []
    for line in walk_lines:
        g = line.intersection(blk)
        clipped.extend(x for x in getattr(g, "geoms", [g]) if x.geom_type == "LineString" and x.length > 0)
    obstacles = [boundary, *others]
    out = []
    for i, line in enumerate(clipped):
        coords = list(line.coords)
        rest = [boundary, *others, *(c for j, c in enumerate(clipped) if j != i)]
        target = unary_union(rest)
        for end in (shapely.Point(coords[0]), shapely.Point(coords[-1])):
            gap = end.distance(target)
            if 2e-6 < gap <= tol:
                a, b = nearest_points(end, target)
                out.append(LineString([a, b]))
    return clipped + out


def walk_pieces(blk, walk, extra, minimum, snap_m):
    """Block cut by walk roads (dead ends joined to a line within snap_m) and extra boundary lines."""
    cands = [walk[0][i] for i in walk[1].query(blk)]
    others = [extra[0][i].intersection(blk) for i in extra[1].query(blk)] if extra else []
    others = [g for o in others for g in getattr(o, "geoms", [o]) if g.geom_type == "LineString" and g.length > 0]
    if not cands and not others:
        return [blk], ([], STRtree([]))
    # Joining dead ends (snap_m) added next to nothing in the sample and tripled the time (plan-walk-pieces.md W1): off.
    lines = snap_gaps(blk, cands, others, snap_m) + others if snap_m else cands + others
    roads = (lines, STRtree(lines))
    # No re-cut of merged faces: with boundary lines it multiplied the time several times for nothing.
    return cut(blk, *roads, merge_min(blk, minimum), recut=False), roads


def merge_min(area, minimum):
    """Smallest piece (in degrees²) a cut of the area may leave on its own."""
    floor, share, cap = minimum
    return max(floor, min(area.area * M2_PER_DEG2 * share, cap)) / M2_PER_DEG2


def sections(dong, main):
    return cut(dong, *main, merge_min(dong, MAIN_MIN))


def split(area, roads, minimum):
    """Area cut by roads (whole when none crosses it)."""
    return cut(area, *roads, merge_min(area, minimum))


def dong_tree(code, dong, main, block, walk, extra=None, rural=False, scale=1):
    """Every level of one 읍면동 as {level: [(code, geom, (roads, merge minimum))]}.

    Each level is a complete partition of the 읍면동 (an unsplit piece stays as
    one); `walk` lists all pieces, stored or not. The roads and minimum are what
    cut that piece's parent, so an audit can re-cut the piece the same way."""
    out = {"section": [], "block": [], "walk": []}
    smin = merge_min(dong, MAIN_MIN)
    for si, section in enumerate(sections(dong, main)):
        sc = f"{code}-{si}"
        out["section"].append((sc, section, (main, smin)))
        for bi, blk in enumerate(split(section, block, BLOCK_MIN)):
            bc = f"{sc}-{bi}"
            bmin = merge_min(section, BLOCK_MIN)
            out["block"].append((bc, blk, (block, bmin)))
            wfloor = tuple(v * scale for v in (WALK_MIN_RURAL if rural else WALK_MIN))
            wmin = merge_min(blk, wfloor)
            pieces, wroads = walk_pieces(blk, walk, extra, wfloor, WALK_SNAP_M)
            for wi, w in enumerate(pieces):
                out["walk"].append((f"{bc}-{wi}", w, (wroads, wmin)))
    return out


def dong_parts(code, name, dong, main, block, walk, extra=None, leaves=None):
    """Sections, blocks and walk pieces of one 읍면동 as file entries, plus the share the blocks cover."""
    rural = name.endswith(RURAL)
    level = "walk_rural" if rural else "walk"
    for scale in (1, 2, 4):
        tree = dong_tree(code, dong, main, block, walk, extra, rural, scale)
        # A block no walk road cuts is already drawn at the block level.
        by_block = defaultdict(list)
        for c, g, _ in tree["walk"]:
            by_block[c.rsplit("-", 1)[0]].append((c, g))
        walks = [{"code": c, "name": name, "bbox": bbox(g, 5), "rings": rings(g, level)}
                 for pieces in by_block.values() if len(pieces) > 1 for c, g in pieces]
        if len(json.dumps(walks, separators=(",", ":"))) <= WALK_FILE_MAX:
            break
    secs = [{"code": c, "name": name, "bbox": bbox(g), "rings": rings(g, "section")} for c, g, _ in tree["section"]]
    blocks = [{"code": c, "name": name, "bbox": bbox(g, 5), "rings": rings(g, "block")} for c, g, _ in tree["block"]]
    covered = sum(g.area for _, g, _ in tree["block"])
    if leaves is not None:  # what the map shows at the walk level, exact: the road level cuts these
        leaves.extend((c, g) for c, g, _ in tree["walk"])
    return secs, blocks, walks, covered / dong.area if dong.area else 1.0


def rings(geom, level):
    """[[outer, ...holes], ...] with rounded coordinates, small parts dropped."""
    cfg = LEVELS[level]
    geom = shapely.make_valid(geom.simplify(cfg["simplify"], preserve_topology=True))
    polys = [g for g in getattr(geom, "geoms", [geom]) if g.geom_type == "Polygon"]
    if not polys and geom.geom_type == "GeometryCollection":
        polys = [p for g in geom.geoms for p in getattr(g, "geoms", [g]) if p.geom_type == "Polygon"]
    keep = [p for p in polys if p.area >= cfg["min_area"]] or sorted(polys, key=lambda p: -p.area)[:1]
    d = cfg["decimals"]
    out = []
    for p in keep:
        parts = [p.exterior, *(h for h in p.interiors if shapely.Polygon(h).area >= cfg["min_area"])]
        rs = [[[round(x, d), round(y, d)] for x, y in r.coords] for r in parts]
        if len(rs[0]) >= 4:
            out.append([r for r in rs if len(r) >= 4])
    return out


def bbox(geom, d=4):
    w, s, e, n = geom.bounds
    return [round(w, d), round(s, d), round(e, d), round(n, d)]


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, path)


def write_dir(path, files):
    """Replaces a folder of per-읍면동 files at once, so a stopped build leaves no half-written 시군구."""
    tmp = path.with_name(path.name + ".tmp")
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)
    for name, value in files.items():
        write(tmp / name, value)
    shutil.rmtree(path, ignore_errors=True)
    os.replace(tmp, path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sgg", help="comma-separated 시군구 codes: rebuild only their section/block/walk files")
    parser.add_argument("--resume", action="store_true", help="skip 시군구 whose block files are complete")
    args = parser.parse_args()
    only = set(args.sgg.split(",")) if args.sgg else None
    features = json.loads(SOURCE.read_text(encoding="utf-8"))["features"]
    dongs = defaultdict(list)
    sgg_names, sido_names, sgg_sido = {}, {}, {}
    for f in features:
        p = f["properties"]
        geom = shapely.make_valid(shape(f["geometry"]))
        dongs[p["sgg"]].append((p["adm_cd2"], p["adm_nm"].split(" ")[-1], geom))
        sgg_names[p["sgg"]] = p["sggnm"]
        sido_names[p["sido"]] = p["sidonm"]
        sgg_sido[p["sgg"]] = p["sido"]

    sgg_geom = {code: unary_union([g for _, _, g in items]) for code, items in dongs.items()}
    sido_geom = {
        sido: unary_union([g for code, g in sgg_geom.items() if sgg_sido[code] == sido])
        for sido in sido_names
    }

    roads = section_roads()
    main_lines = [line for is_main, line in roads if is_main]
    main = (main_lines, STRtree(main_lines))
    lines = block_roads()
    block = [line for kind, line in lines if kind == "block"]
    walk = [line for kind, line in lines if kind == "walk"]
    del lines
    block = (block, STRtree(block))
    walk = (walk, STRtree(walk))
    urban_extra, rural_extra = load_boundaries()
    if urban_extra is None:
        print("data/korea/boundaries.pkl missing: run extract_boundaries.py; walk pieces use roads only", flush=True)
    counts = [0, 0, 0]
    worst = (1.0, "")
    todo = [c for c in dongs if only is None or c in only]
    for n, code in enumerate(todo, 1):
        items = dongs[code]
        if args.resume and (OUT / "section" / f"{code}.json").exists() and all(
                (OUT / "block" / code / f"{c}.json").exists() for c, _, _ in items):
            continue
        secs, blocks, walks = [], {}, {}
        leaves = []
        for c, name, g in items:
            s, b, w, share = dong_parts(c, name, g, main, block, walk,
                                        rural_extra if name.endswith(RURAL) else urban_extra, leaves)
            secs.extend(s)
            blocks[f"{c}.json"] = b
            if w:
                walks[f"{c}.json"] = w
            counts[0] += len(s)
            counts[1] += len(b)
            counts[2] += len(w)
            worst = min(worst, (share, c))
        LEAF_DIR.mkdir(parents=True, exist_ok=True)
        (LEAF_DIR / f"{code}.pkl").write_bytes(pickle.dumps([(c, g.wkb) for c, g in leaves]))
        write(OUT / "section" / f"{code}.json", secs)
        write_dir(OUT / "walk" / code, walks)
        # Block files last: --resume treats a complete block folder as a finished 시군구.
        write_dir(OUT / "block" / code, blocks)
        print(f"[{n}/{len(todo)}] {code} {sgg_names[code]}: 구획 {len(secs)}, 블록 {sum(map(len, blocks.values()))}, "
              f"보행로 조각 {sum(map(len, walks.values()))}", flush=True)
    # Pieces touching their neighbors at only a point can't merge and are
    # dropped, so a 읍면동's blocks may cover slightly less than it.
    print(f"{counts[0]} 구획, {counts[1]} 블록, {counts[2]} 보행로 조각; 가장 덜 덮인 읍면동 {worst[1]} {worst[0]:.4%}", flush=True)
    for code, items in dongs.items():
        write(OUT / "dong" / f"{code}.json", [
            {"code": c, "name": name, "bbox": bbox(g), "rings": rings(g, "dong")} for c, name, g in items
        ])
    for sido in sido_names:
        write(OUT / "sgg" / f"{sido}.json", [
            {"code": code, "name": sgg_names[code], "bbox": bbox(g), "rings": rings(g, "sgg")}
            for code, g in sgg_geom.items() if sgg_sido[code] == sido
        ])
    write(OUT / "sido.json", {
        "version": 1,
        "source": SOURCE_URL,
        "attribution": "통계청 SGIS 행정동 경계(공공누리 제1유형) · vuski/admdongkor",
        "areas": [{"code": s, "name": sido_names[s], "bbox": bbox(g), "rings": rings(g, "sido")} for s, g in sido_geom.items()],
    })
    sizes = sum(p.stat().st_size for p in OUT.rglob("*.json"))
    print(f"{len(sido_names)} 시도, {len(sgg_geom)} 시군구, {len(features)} 읍면동, {sizes / 1e6:.1f}MB")


if __name__ == "__main__":
    main()
