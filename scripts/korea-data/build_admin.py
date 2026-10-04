"""Build administrative area files: 시도 → 시군구 → 읍면동 (행정동) → 구획.

The map no longer splits land along roads. It shows the 시군구 at the screen
center divided into its 읍면동, and everything else as whole areas, so the
app needs three nested levels it can load one parent at a time.

Source: vuski/admdongkor HangJeongDong geojson, based on Statistics Korea
SGIS boundaries (KOGL Type 1, attribution required; edits CC BY 4.0).

Below 읍면동 there is no open boundary data, so each 읍면동 is cut into
sections (구획) by roads: main roads (tertiary and wider) first, then local
roads inside sections that are still large. Only roads that close off a
face count: dead ends and stubs don't cut. Pieces under a minimum size
(slivers, single city blocks) are merged into a neighbor.

python scripts/korea-data/build_admin.py
Needs data/korea/HangJeongDong_ver20260701.geojson and roads.jsonl (see README.md).
"""
import json
import pickle
from collections import defaultdict
from pathlib import Path

import shapely
from shapely.geometry import LineString, shape
from shapely.ops import polygonize, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data/korea/HangJeongDong_ver20260701.geojson"
SOURCE_URL = "https://github.com/vuski/admdongkor/blob/master/ver20260701/HangJeongDong_ver20260701.geojson"
OUT = ROOT / "public/korea/admin"
ROADS = ROOT / "data/korea/roads.jsonl"
ROAD_CACHE = ROOT / "data/korea/section-roads.pkl"
# Roads that cut a 읍면동 into sections, in two passes. Main roads first;
# a section still larger than SPLIT_ABOVE_M2 is cut again by local roads.
# Slivers and city blocks are merged until each piece reaches the pass's
# minimum, so local roads give neighborhood-sized sections, not city blocks.
MAIN_HIGHWAYS = {"motorway", "trunk", "primary", "secondary", "tertiary"}
LOCAL_HIGHWAYS = {"unclassified", "residential"}
SPLIT_ABOVE_M2 = 150_000
# (minimum m², minimum share of the 읍면동) per pass.
MAIN_MIN = (20_000, 0.015)
LOCAL_MIN = (40_000, 0.025)
M2_PER_DEG2 = 88_900 * 110_540
# Degrees of tolerance and coordinate decimals per level. Corners are rounded
# on screen anyway, so detail finer than a few pixels at the level's usual
# zoom is wasted bytes. Small islands are dropped below MIN_AREA.
LEVELS = {
    "sido": {"simplify": 0.004, "decimals": 3, "min_area": 4e-5},
    "sgg": {"simplify": 0.0008, "decimals": 4, "min_area": 2e-6},
    "dong": {"simplify": 0.00012, "decimals": 5, "min_area": 2e-7},
    "section": {"simplify": 0.00005, "decimals": 5, "min_area": 2e-8},
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


def cut(area, lines, tree, min_area):
    """Faces of the area cut by roads (dead ends don't cut), small ones merged."""
    edges = unary_union([area.boundary, *(lines[i].intersection(area) for i in tree.query(area))])
    faces = [f for f in polygonize(edges) if area.contains(f.representative_point())]
    if not faces:
        return [area]
    while len(faces) > 1:
        small = min(range(len(faces)), key=lambda i: faces[i].area)
        if faces[small].area >= min_area:
            break
        face = faces.pop(small)
        # The neighbor sharing the longest border swallows it.
        shared = [face.boundary.intersection(f.boundary).length for f in faces]
        best = max(range(len(faces)), key=lambda i: shared[i])
        if shared[best] == 0:
            continue
        faces[best] = shapely.make_valid(unary_union([faces[best], face]))
    return [g for f in faces for g in getattr(f, "geoms", [f]) if g.geom_type == "Polygon"]


def sections(dong, main, local):
    min_of = lambda m: max(m[0] / M2_PER_DEG2, dong.area * m[1])
    out = []
    for face in cut(dong, *main, min_of(MAIN_MIN)):
        if face.area * M2_PER_DEG2 > SPLIT_ABOVE_M2:
            out.extend(cut(face, *local, min_of(LOCAL_MIN)))
        else:
            out.append(face)
    return out


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
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main():
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
    local_lines = [line for is_main, line in roads if not is_main]
    main = (main_lines, STRtree(main_lines))
    local = (local_lines, STRtree(local_lines))
    count = 0
    for code, items in dongs.items():
        out = []
        for c, name, g in items:
            for i, face in enumerate(sections(g, main, local)):
                out.append({"code": f"{c}-{i}", "name": name, "bbox": bbox(face), "rings": rings(face, "section")})
        count += len(out)
        write(OUT / "section" / f"{code}.json", out)
    print(f"{count} 구획")
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
