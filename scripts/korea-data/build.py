"""Build static illustrated-map tiles from the complete Geofabrik Korea extract.

pip install osmium shapely requests
python scripts/korea-data/build.py
Raw data stays in data/korea; deployable, ODbL-derived tiles go in public/korea.
"""
import collections
import hashlib
import json
import math
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import osmium
import requests
import shapely
from shapely.geometry import LineString, Polygon, box, shape
from shapely.affinity import scale
from shapely.ops import polygonize_full, unary_union
from shapely.strtree import STRtree
from convex_partition import convex_parts

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data/korea"
OUT = ROOT / "public/korea"
SOURCE = "https://download.geofabrik.de/asia/south-korea-260929.osm.pbf"
SOURCE_MD5 = "7775afecd9ccbf3285ace3f1fa2ec7f4"
SOURCE_HIGHWAYS = 1816596
BOUNDARY = "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/KOR/ADM0/geoBoundaries-KOR-ADM0.geojson"
KX, KY = 88904.0, 110540.0
MAJOR = {"motorway", "trunk", "primary", "secondary", "motorway_link", "trunk_link", "primary_link", "secondary_link"}
MID = MAJOR | {"tertiary", "tertiary_link"}
STREETS = MID | {"unclassified", "residential", "living_street", "pedestrian", "service", "road", "cycleway", "footway", "path", "steps", "track"}
# Grid size in degrees, gap width in meters, simplification in meters, road classes.
LEVELS = [("detail", .05, 18, 2, STREETS), ("city", .2, 65, 8, MID), ("region", 1, 300, 40, MAJOR), ("country", 4, 1300, 150, {"motorway", "trunk", "primary", "motorway_link", "trunk_link", "primary_link"})]
# Administrative names describe viewing scale, not legal road ownership.
SCALE_LABELS = {"detail": "읍·면·동 / 생활권", "city": "시·군·구", "region": "시·도", "country": "전국"}
MAX_MPP = {"detail": 12, "city": 60, "region": 250, "country": None}
MIN_BLOCK_AREA = {name: 0 for name, *_ in LEVELS}
BLOCK_POLICY = "convex-complete-v3"


def block_policy_of(name):
    return BLOCK_POLICY


def download(url, path):
    if path.exists() and path.stat().st_size > 1000:
        return
    response = requests.get(url, stream=True, timeout=120)
    response.raise_for_status()
    with path.with_suffix(path.suffix + ".part").open("wb") as stream:
        for chunk in response.iter_content(1024 * 1024):
            stream.write(chunk)
    path.with_suffix(path.suffix + ".part").replace(path)


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    temporary.replace(path)


def tile_build_policy(name, step, width, tolerance, classes):
    return {"version": block_policy_of(name), "sourceMd5": SOURCE_MD5,
            "boundarySha256": hashlib.sha256((RAW / "boundary.geojson").read_bytes()).hexdigest(),
            "name": name, "step": step, "roadWidthM": width, "simplifyM": tolerance,
            "roadClasses": sorted(classes), "minBlockAreaM2": MIN_BLOCK_AREA[name]}


class Extract(osmium.SimpleHandler):
    def __init__(self, archive):
        super().__init__()
        self.archive = archive
        self.roads = []
        self.islands = []
        self.water = []
        self.factory = osmium.geom.GeoJSONFactory()
        self.counts = collections.Counter()
        self.skipped = 0
        self.omitted_highways = 0

    def way(self, way):
        highway = way.tags.get("highway") if self.archive is not None else None
        coast = way.tags.get("natural") == "coastline" and way.is_closed()
        if highway is None and not coast:
            return
        try:
            coords = [(n.lon, n.lat) for n in way.nodes]
        except osmium.InvalidLocationError:
            self.skipped += 1
            coords = [(n.lon, n.lat) for n in way.nodes if n.location.valid()]
        if coast and len(coords) >= 4:
            island = Polygon(coords)
            if island.is_valid:
                self.islands.append(scale(island, KX, KY, origin=(0, 0)))
        if highway is not None:
            # Preserve every highway class and tag in the archive, including
            # tunnels/construction excluded from the surface illustration.
            tags = dict(way.tags)
            record = {"id": way.id, "tags": tags, "path": coords}
            complete = len(coords) == len(way.nodes) and len(coords) >= 2
            if not complete:
                record["geometry_status"] = "insufficient_nodes" if len(coords) == len(way.nodes) else "missing_nodes"
                record["node_refs"] = [node.ref for node in way.nodes]
                self.omitted_highways += 1
            self.archive.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
            self.counts[highway] += 1
            if sum(self.counts.values()) % 100000 == 0:
                print(f"Reading highways: {sum(self.counts.values()):,}", flush=True)
            if complete and highway in STREETS and tags.get("tunnel") != "yes" and tags.get("area") != "yes":
                self.roads.append((highway, LineString([(x * KX, y * KY) for x, y in coords])))

    def area(self, area):
        if area.tags.get("natural") != "water" and area.tags.get("waterway") != "riverbank" and area.tags.get("landuse") != "reservoir":
            return
        try:
            geometry = shape(json.loads(self.factory.create_multipolygon(area)))
            self.water.append(scale(shapely.make_valid(geometry), KX, KY, origin=(0, 0)))
        except (RuntimeError, ValueError):
            self.skipped += 1


def polygons(geometry):
    if geometry.geom_type == "Polygon":
        yield geometry
    elif hasattr(geometry, "geoms"):
        for part in geometry.geoms:
            yield from polygons(part)


def ring(coords):
    return [[round(x / KX, 6), round(y / KY, 6)] for x, y in coords]


def dividing_roads(land, roads):
    """Only face boundaries split land; dangling trees and loop stems do not.

    Node crossings before polygonizing. Including the actual land boundary
    keeps coast-to-coast cuts, while ignoring branches ending inside a face.
    Call this on padded land, then clip the result to the output tile so grid
    edges do not create visible road gaps.
    """
    if not roads:
        return shapely.GeometryCollection()
    # A prepared containment index avoids running an overlay against every
    # lake/coast vertex for roads already wholly on land. The result is exactly
    # the same geometry as intersection(land), including roads crossing water.
    shapely.prepare(land)
    clipped = [line if shapely.contains_properly(land, line) else line.intersection(land) for line in roads]
    noded = unary_union([land.boundary, *clipped])
    _, cuts, dangles, invalid = polygonize_full(noded)
    return noded.difference(unary_union([land.boundary, cuts, dangles, invalid]))


def simplify_road_network(roads, tolerance):
    """Generalize bends while retaining every shared junction coordinate.

    Simplifying whole ways can remove the interior point where a side road
    joins. Split at all shared points, simplify runs, and join them back first.
    This bounds national-scale noding memory without disconnecting the graph.
    """
    junctions = collections.Counter(point for road in roads for point in road.coords)
    result = []
    for road in roads:
        coords = list(road.coords)
        path, run = [], [coords[0]]
        for i, point in enumerate(coords[1:], 1):
            run.append(point)
            if junctions[point] > 1 or i == len(coords) - 1:
                simplified = list(LineString(run).simplify(tolerance, preserve_topology=True).coords)
                path.extend(simplified if not path else simplified[1:])
                run = [point]
        result.append(LineString(path))
    return result


def build_blocks(land, roads, width, tolerance):
    separators = dividing_roads(land, roads)
    return land.difference(separators.buffer(width / 2, quad_segs=2))


def encode_blocks(geometry, min_area=0):
    # Quantize before partitioning, so serialized coordinates remain convex.
    result = []
    for polygon in polygons(geometry):
        rounded = shapely.make_valid(Polygon(ring(polygon.exterior.coords), [ring(h.coords) for h in polygon.interiors]))
        for part in polygons(rounded):
            for convex in convex_parts(part):
                result.append({"outer": [list(p) for p in convex.exterior.coords], "holes": []})
    return result


def main():
    selected = set(LEVELS[i][0] for i in range(len(LEVELS)))
    if "--levels" in sys.argv:
        selected = set(sys.argv[sys.argv.index("--levels") + 1].split(","))
        if not selected or not selected <= set(SCALE_LABELS):
            raise ValueError("Unknown level in --levels")
    previous = json.loads((OUT / "manifest.json").read_text(encoding="utf-8")) if (OUT / "manifest.json").exists() else None
    if len(selected) < len(LEVELS) and previous is None:
        raise ValueError("Partial rebuild requires an existing manifest")
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    download(SOURCE, RAW / "south-korea.osm.pbf")
    download(BOUNDARY, RAW / "boundary.geojson")
    with (RAW / "south-korea.osm.pbf").open("rb") as stream:
        if hashlib.file_digest(stream, "md5").hexdigest() != SOURCE_MD5:
            raise RuntimeError("Source checksum mismatch: incomplete or changed extract")
    if "--reuse-roads" in sys.argv:
        handler = Extract(None)
        handler.apply_file(str(RAW / "south-korea.osm.pbf"), locations=True, idx="sparse_mem_array")
        with (RAW / "roads.jsonl").open(encoding="utf-8") as archive:
            for line in archive:
                road = json.loads(line)
                tags = road["tags"]
                highway = tags["highway"]
                handler.counts[highway] += 1
                if len(road["path"]) < 2 or "geometry_status" in road:
                    handler.omitted_highways += 1
                    continue
                if highway in STREETS and tags.get("tunnel") != "yes" and tags.get("area") != "yes":
                    handler.roads.append((highway, LineString([(x * KX, y * KY) for x, y in road["path"]])))
        print("Reused complete roads.jsonl", flush=True)
    else:
        with (RAW / "roads.jsonl").open("w", encoding="utf-8") as archive:
            handler = Extract(archive)
            handler.apply_file(str(RAW / "south-korea.osm.pbf"), locations=True, idx="sparse_mem_array")
    print(f"Extracted {sum(handler.counts.values()):,} highways; {len(handler.islands):,} coastline islands", flush=True)
    if sum(handler.counts.values()) != SOURCE_HIGHWAYS:
        raise RuntimeError("Road archive count mismatch for the pinned source")
    boundary = json.loads((RAW / "boundary.geojson").read_text(encoding="utf-8"))
    land = unary_union([scale(shape(f["geometry"]), KX, KY, origin=(0, 0)) for f in boundary["features"]] + handler.islands)
    land = shapely.make_valid(land)
    land = land.difference(unary_union(handler.water))
    # Partition the land once. Re-intersecting every small tile with all of
    # Korea's river/lake holes would otherwise repeat millions of vertices.
    land_parts = []
    bounds = land.bounds
    for x in range(math.floor(bounds[0] / KX), math.ceil(bounds[2] / KX)):
        for y in range(math.floor(bounds[1] / KY), math.ceil(bounds[3] / KY)):
            part = land.intersection(box(x * KX, y * KY, (x + 1) * KX, (y + 1) * KY))
            if not part.is_empty:
                land_parts.append(part)
    land_tree = STRtree(land_parts)
    manifest = {"version": 1, "source": SOURCE, "snapshot": "2026-09-29T20:22:51Z", "license": "ODbL-1.0", "attribution": "© OpenStreetMap contributors · Geofabrik; boundary: Natural Earth / geoBoundaries (Public Domain)", "highwayCount": sum(handler.counts.values()), "highwayClasses": dict(handler.counts), "invalidWays": handler.skipped, "surfaceRoadCount": len(handler.roads), "coastlineIslands": len(handler.islands), "levels": []}
    with (RAW / "south-korea.osm.pbf").open("rb") as stream:
        manifest["sourceSha256"] = hashlib.file_digest(stream, "sha256").hexdigest()
    manifest["waterAreas"] = len(handler.water)
    manifest["geometryOmittedHighways"] = handler.omitted_highways
    for name, step, width, tolerance, classes in LEVELS:
        policy = {"scaleLabel": SCALE_LABELS[name], "maxMetersPerPixel": MAX_MPP[name], "roadClasses": sorted(classes)}
        if name not in selected:
            existing = next(level for level in previous["levels"] if level["name"] == name)
            manifest["levels"].append({**existing, **policy})
            continue
        # Keep junction coordinates until after noding; simplifying centerlines
        # first can disconnect side roads from their junctions.
        roads = [line for highway, line in handler.roads if highway in classes]
        if name in {"region", "country"}:
            roads = simplify_road_network(roads, tolerance)
        tree = STRtree(roads)
        bounds = land.bounds
        tiles = []
        count = 0
        build_policy = tile_build_policy(name, step, width, tolerance, classes)

        def build_tile(cell):
            x, y = cell
            key = f"{x}_{y}"
            path = OUT / name / f"{key}.json"
            if "--resume" in sys.argv and path.exists():
                try:
                    cached = json.loads(path.read_text(encoding="utf-8"))
                    if cached.get("buildPolicy") == build_policy and isinstance(cached.get("blocks"), list):
                        return key, len(cached["blocks"])
                except (ValueError, OSError):
                    pass
            tile = box(x * step * KX, y * step * KY, (x + 1) * step * KX, (y + 1) * step * KY)
            padded = tile.buffer(width * 2, quad_segs=1)
            land_indices = land_tree.query(padded, predicate="intersects")
            local = unary_union([land_parts[i].intersection(padded) for i in land_indices])
            if local.is_empty:
                return None
            indices = tree.query(padded, predicate="intersects")
            blocks = build_blocks(local, [roads[i] for i in indices], width, tolerance)
            # Retain every face, including tiny fragments at tile seams.
            encoded = []
            for block in polygons(blocks):
                # The padded edge may cut a large region into a sliver.
                continues = block.intersects(padded.boundary)
                for part in encode_blocks(block.intersection(tile)):
                    part["areaM2"] = max(round(block.area, 6), 0.000001)
                    if continues:
                        part["continuesBeyondTile"] = True
                    encoded.append(part)
            payload = {"region": ring(tile.exterior.coords), "blocks": encoded, "buildPolicy": build_policy}
            write(path, payload)
            return key, len(encoded)

        cells = [(x, y)
                 for x in range(math.floor(bounds[0] / KX / step), math.ceil(bounds[2] / KX / step))
                 for y in range(math.floor(bounds[1] / KY / step), math.ceil(bounds[3] / KY / step))]
        # GEOS operations release the GIL; independent grid tiles share only
        # immutable spatial indexes and write distinct, atomic files.
        with ThreadPoolExecutor(max_workers=2 if name in {"region", "country"} else 4) as pool:
            for result in pool.map(build_tile, cells):
                if result is None:
                    continue
                key, block_count = result
                tiles.append(key)
                count += block_count
                if len(tiles) % 100 == 0:
                    print(f"{name}: {len(tiles)} tiles", flush=True)
        manifest["levels"].append({"name": name, "step": step, "roadWidthM": width, "simplifyM": tolerance, "tiles": tiles, "blockCount": count, "minBlockAreaM2": MIN_BLOCK_AREA[name], "blockPolicy": block_policy_of(name), **policy})
        print(f"{name}: complete, {len(tiles)} tiles, {count:,} polygons", flush=True)
    # Independent level workers can populate tiles without replacing the
    # shared manifest. A full --resume pass publishes all four levels together.
    if "--no-manifest" not in sys.argv:
        write(OUT / "manifest.json", manifest)
    # Windows consoles may use CP949; keep logs ASCII while files stay UTF-8.
    print(json.dumps(manifest, ensure_ascii=True, indent=2)[:1500], flush=True)


if __name__ == "__main__":
    main()
