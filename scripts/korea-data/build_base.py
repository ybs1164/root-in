"""Build the styled base map: land and park polygons plus tiered road lines.

The convex-block tiles (build.py) bake every road in as a gap of one fixed
width, so a highway and an alley look the same. This set keeps roads as lines
tagged with a tier and lets the app pick width and color per tier, like a
regular street map. Water is simply where no land polygon is drawn.

python scripts/korea-data/build_base.py            # all levels
python scripts/korea-data/build_base.py --levels detail --bbox 126.9,37.5,127.1,37.6
Needs data/korea/south-korea.osm.pbf, roads.jsonl and boundary.geojson (build.py).
"""
import json
import math
import pickle
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import osmium
import shapely
from shapely.affinity import scale
from shapely.geometry import LineString, Polygon, box, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree
from convex_roads import filter_convex

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data/korea"
OUT = ROOT / "public/korea/base"
KX, KY = 88904.0, 110540.0

# Road tiers, widest first. Tier 1 is drawn in the darker highway color.
TIERS = {
    # Ramps stay light: drawn dark they smear interchanges into one blob.
    1: {"motorway", "trunk"},
    2: {"motorway_link", "trunk_link", "primary", "primary_link", "secondary", "secondary_link"},
    3: {"tertiary", "tertiary_link"},
    4: {"unclassified", "residential", "living_street", "service", "road", "busway"},
    5: {"pedestrian", "footway", "path", "cycleway", "steps"},
}
TIER_OF = {highway: tier for tier, classes in TIERS.items() for highway in classes}

# name, grid step (deg), simplify (m), coordinate decimals, max road tier, min park area (m2)
LEVELS = [
    ("detail", .05, 1, 5, 5, 0),
    ("city", .2, 8, 5, 3, 30_000),
    ("region", 1, 40, 4, 2, 1_000_000),
    ("country", 4, 150, 3, 2, None),
]
# Country scale keeps primary roads but drops secondary ones.
# Context around a tile for the convex-block check, and the bend tolerance.
CONVEX = {"detail": (300, 5), "city": (1500, 30)}
COUNTRY_CLASSES = TIERS[1] | {"motorway_link", "trunk_link", "primary", "primary_link"}
PARK_TAGS = {("leisure", "park"), ("leisure", "garden"), ("leisure", "golf_course"),
             ("landuse", "grass"), ("landuse", "recreation_ground"), ("landuse", "village_green")}


class Areas(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.islands, self.water, self.parks = [], [], []
        self.factory = osmium.geom.GeoJSONFactory()

    def way(self, way):
        if way.tags.get("natural") != "coastline" or not way.is_closed():
            return
        try:
            island = Polygon([(n.lon, n.lat) for n in way.nodes])
        except osmium.InvalidLocationError:
            return
        if island.is_valid:
            self.islands.append(scale(island, KX, KY, origin=(0, 0)))

    def area(self, area):
        tags = area.tags
        water = tags.get("natural") == "water" or tags.get("waterway") == "riverbank" or tags.get("landuse") == "reservoir"
        park = any(tags.get(k) == v for k, v in PARK_TAGS)
        if not water and not park:
            return
        try:
            geometry = shapely.make_valid(scale(shape(json.loads(self.factory.create_multipolygon(area))), KX, KY, origin=(0, 0)))
        except (RuntimeError, ValueError):
            return
        (self.water if water else self.parks).append(geometry)


def load_areas():
    cache = RAW / "base-areas.pkl"
    if cache.exists():
        return pickle.loads(cache.read_bytes())
    handler = Areas()
    handler.apply_file(str(RAW / "south-korea.osm.pbf"), locations=True, idx="sparse_mem_array")
    value = (handler.islands, handler.water, handler.parks)
    cache.write_bytes(pickle.dumps(value))
    return value


def load_roads(bbox):
    roads = []
    with (RAW / "roads.jsonl").open(encoding="utf-8") as archive:
        for line in archive:
            road = json.loads(line)
            tags = road["tags"]
            tier = TIER_OF.get(tags["highway"])
            if tier is None or "geometry_status" in road or len(road["path"]) < 2:
                continue
            # Tunnels and area highways would draw roads over the surface.
            if tags.get("tunnel") in {"yes", "building_passage"} or tags.get("area") == "yes":
                continue
            path = road["path"]
            if bbox and not any(bbox[0] <= x <= bbox[2] and bbox[1] <= y <= bbox[3] for x, y in path):
                continue
            roads.append((tier, tags["highway"], LineString([(x * KX, y * KY) for x, y in path])))
    return roads


def polygons(geometry):
    if geometry.geom_type == "Polygon":
        yield geometry
    elif hasattr(geometry, "geoms"):
        for part in geometry.geoms:
            yield from polygons(part)


def lines(geometry):
    if geometry.geom_type == "LineString":
        yield geometry
    elif hasattr(geometry, "geoms"):
        for part in geometry.geoms:
            yield from lines(part)


def encode_ring(coords, digits):
    out = []
    for x, y in coords:
        point = [round(x / KX, digits), round(y / KY, digits)]
        if not out or out[-1] != point:
            out.append(point)
    return out if len(out) >= 4 else None


def encode_polygons(geometry, tolerance, digits, min_area=0):
    result = []
    for polygon in polygons(geometry.simplify(tolerance, preserve_topology=True)):
        if polygon.area < max(min_area, tolerance * tolerance):
            continue
        outer = encode_ring(polygon.exterior.coords, digits)
        if outer is None:
            continue
        holes = [h for h in (encode_ring(r.coords, digits) for r in polygon.interiors) if h]
        result.append([outer, *holes])
    return result


def encode_line(line, digits):
    flat = []
    for x, y in line.coords:
        point = (round(x / KX, digits), round(y / KY, digits))
        if len(flat) < 2 or (flat[-2], flat[-1]) != point:
            flat.extend(point)
    return flat if len(flat) >= 4 else None


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, separators=(",", ":")), encoding="utf-8")
    temporary.replace(path)


def main():
    levels = LEVELS
    if "--levels" in sys.argv:
        names = set(sys.argv[sys.argv.index("--levels") + 1].split(","))
        levels = [level for level in LEVELS if level[0] in names]
    bbox = None
    if "--bbox" in sys.argv:
        bbox = [float(v) for v in sys.argv[sys.argv.index("--bbox") + 1].split(",")]

    islands, water, parks = load_areas()
    print(f"{len(islands):,} islands, {len(water):,} water areas, {len(parks):,} parks", flush=True)
    boundary = json.loads((RAW / "boundary.geojson").read_text(encoding="utf-8"))
    land = unary_union([scale(shape(f["geometry"]), KX, KY, origin=(0, 0)) for f in boundary["features"]] + islands)
    land = shapely.make_valid(land)
    water_tree = STRtree(water)
    # Subtract water per 1-degree cell: one country-wide difference against
    # every lake and river is far slower than many small ones.
    land_parts = []
    bounds = land.bounds
    for x in range(math.floor(bounds[0] / KX), math.ceil(bounds[2] / KX)):
        for y in range(math.floor(bounds[1] / KY), math.ceil(bounds[3] / KY)):
            cell = box(x * KX, y * KY, (x + 1) * KX, (y + 1) * KY)
            part = land.intersection(cell)
            if part.is_empty:
                continue
            near = [water[i] for i in water_tree.query(cell, predicate="intersects")]
            if near:
                part = shapely.make_valid(part.difference(unary_union(near)))
            land_parts.append(part)
    land_tree = STRtree(land_parts)
    park_tree = STRtree(parks)
    roads = load_roads(bbox)
    print(f"{len(roads):,} surface roads", flush=True)

    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"version": 1, "levels": []}
    manifest["attribution"] = "© OpenStreetMap contributors · Geofabrik; boundary: Natural Earth / geoBoundaries (Public Domain)"
    manifest["tiers"] = {str(t): sorted(c) for t, c in TIERS.items()}
    for name, step, tolerance, digits, max_tier, min_park in levels:
        level_roads = [(t, line) for t, highway, line in roads
                       if t <= max_tier and (name != "country" or highway in COUNTRY_CLASSES)]
        if name in {"region", "country"}:
            level_roads = [(t, line.simplify(tolerance)) for t, line in level_roads]
        road_tree = STRtree([line for _, line in level_roads])
        west, south, east, north = land.bounds
        if bbox:
            west, south, east, north = max(west, bbox[0] * KX), max(south, bbox[1] * KY), min(east, bbox[2] * KX), min(north, bbox[3] * KY)
        cells = [(x, y)
                 for x in range(math.floor(west / KX / step), math.ceil(east / KX / step))
                 for y in range(math.floor(south / KY / step), math.ceil(north / KY / step))]

        def build_tile(cell):
            x, y = cell
            tile = box(x * step * KX, y * step * KY, (x + 1) * step * KX, (y + 1) * step * KY)
            local = unary_union([land_parts[i].intersection(tile) for i in land_tree.query(tile, predicate="intersects")])
            if local.is_empty:
                return None
            payload = {"land": encode_polygons(local, tolerance, digits), "parks": [], "roads": []}
            if min_park is not None:
                for i in park_tree.query(tile, predicate="intersects"):
                    if parks[i].area >= min_park:
                        payload["parks"].extend(encode_polygons(parks[i].intersection(tile), tolerance, digits))
            if name in CONVEX:
                # Judge blocks with some context, then keep only this tile.
                pad, bend = CONVEX[name]
                frame = tile.buffer(pad, join_style="mitre")
                region = unary_union([land_parts[i].intersection(frame) for i in land_tree.query(frame, predicate="intersects")])
                tile_roads = filter_convex([level_roads[i] for i in road_tree.query(frame, predicate="intersects")], region, tolerance=bend)
            else:
                tile_roads = [level_roads[i] for i in road_tree.query(tile, predicate="intersects")]
            for tier, line in tile_roads:
                if not line.intersects(tile):
                    continue
                clipped = line if tile.contains(line) else line.intersection(tile)
                for part in lines(clipped):
                    if name == "detail":
                        part = part.simplify(tolerance)
                    flat = encode_line(part, digits)
                    if flat:
                        payload["roads"].append([tier, flat])
            # Narrow roads first, so wider ones draw on top at junctions.
            payload["roads"].sort(key=lambda road: -road[0])
            write(OUT / name / f"{x}_{y}.json", payload)
            return f"{x}_{y}"

        tiles = []
        with ThreadPoolExecutor(max_workers=6) as pool:
            for done, key in enumerate(pool.map(build_tile, cells), 1):
                if key:
                    tiles.append(key)
                if done % 500 == 0:
                    print(f"{name}: {done}/{len(cells)} cells", flush=True)
        entry = next((level for level in manifest["levels"] if level["name"] == name), None)
        if entry and bbox:
            tiles = sorted(set(entry["tiles"]) | set(tiles))
        entry = {"name": name, "step": step, "maxTier": max_tier, "tiles": tiles}
        manifest["levels"] = [level for level in manifest["levels"] if level["name"] != name] + [entry]
        manifest["levels"].sort(key=lambda level: [n for n, *_ in LEVELS].index(level["name"]))
        print(f"{name}: {len(tiles)} tiles", flush=True)
    write(manifest_path, manifest)


if __name__ == "__main__":
    main()
