"""Extract named orientation landmarks from the local OSM snapshot.

python scripts/place-kinds/build_landmarks.py
Requires osmium and shapely. Output ships with the app independently of the
remotely hosted terrain package, so existing map-data hosts need no update.
"""
import argparse
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

import osmium
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[2]
STEP = 0.25


def classify(tags):
    amenity = tags.get("amenity")
    if amenity in {"university", "college"}:
        return "school", "대학교" if amenity == "university" else "대학", 0
    if tags.get("railway") == "station" or tags.get("public_transport") == "station":
        return "station", "역·터미널", 0
    if tags.get("aeroway") == "aerodrome":
        return "airport", "공항", 0
    if amenity == "hospital":
        return "hospital", "병원", 0
    if amenity in {"school", "kindergarten"}:
        return "school", "학교" if amenity == "school" else "유치원", 1
    if amenity == "police":
        return "police", "경찰서", 1
    if amenity == "fire_station":
        return "fire_station", "소방서", 1
    if amenity in {"townhall", "community_centre", "courthouse"} or tags.get("office") == "government":
        return "government", "공공시설", 1
    if tags.get("leisure") in {"park", "garden"}:
        return "park", "공원", 1
    if tags.get("tourism") in {"museum", "gallery", "attraction"}:
        kind = tags.get("tourism")
        return kind, {"museum": "박물관", "gallery": "미술관", "attraction": "명소"}[kind], 1
    if amenity in {"library", "post_office", "bank", "place_of_worship", "bus_station"}:
        kind, label = {"library": ("library", "도서관"), "post_office": ("post", "우체국"),
                       "bank": ("bank", "은행"), "place_of_worship": ("church", "종교시설"),
                       "bus_station": ("station", "버스터미널")}[amenity]
        if amenity == "place_of_worship" and tags.get("religion") == "buddhist":
            kind = "temple"
        return kind, label, 1 if amenity in {"library", "bus_station"} else 2
    if tags.get("building") not in {None, "no", "garage", "garages", "shed", "roof"}:
        return "building", "건물", 2
    return None


def fame(tags, area_m2=0.0):
    """0..100 from what OSM says about renown; the app ranks same-kind places with it."""
    score = 0
    if tags.get("wikidata") or tags.get("wikipedia") or tags.get("brand:wikidata"):
        score += 50
    if tags.get("heritage") or tags.get("historic"):
        score += 20
    if tags.get("tourism") in {"attraction", "museum", "gallery", "viewpoint"}:
        score += 10
    try:
        if float(tags.get("building:levels") or 0) >= 20 or float((tags.get("height") or "0").split()[0]) >= 80:
            score += 10
    except ValueError:
        pass
    if area_m2 > 1000:
        score += round(20 * min(1, math.log10(area_m2 / 1000) / 3))
    return min(100, score)


def extras(area_m2, renown):
    data = {}
    if area_m2 >= 1:
        data["areaM2"] = round(area_m2)
    if renown:
        data["f"] = renown
    return data


class Landmarks(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.factory = osmium.geom.GeoJSONFactory()

    def add(self, tags, identity, point, area_m2=0.0):
        name = (tags.get("name:ko") or tags.get("name") or "").strip()
        category = classify(tags)
        if not name or not category or len(name) > 80:
            return
        lon, lat = point
        if not (124 <= lon <= 132 and 33 <= lat <= 39):
            return
        kind, label, importance = category
        if kind == "building" and re.fullmatch(r"[0-9]+[A-Za-z]?(?:동|호)?", name):
            return
        row = [identity, name, round(lon * 1e5), round(lat * 1e5), kind, label, importance]
        extra = extras(area_m2, fame(tags, area_m2))
        self.rows.append(row + [extra] if extra else row)

    def node(self, node):
        if (node.tags.get("name:ko") or node.tags.get("name")) and node.location.valid():
            self.add(node.tags, f"n{node.id}", (node.lon, node.lat))

    def area(self, area):
        if not classify(area.tags) or not (area.tags.get("name:ko") or area.tags.get("name")):
            return
        try:
            geometry = shape(json.loads(self.factory.create_multipolygon(area)))
            point = geometry.representative_point()
            # Degrees² → m² at this latitude; plenty for a log-scaled renown term.
            area_m2 = geometry.area * 111_320 ** 2 * math.cos(math.radians(point.y))
            self.add(area.tags, f"{'w' if area.from_way() else 'r'}{area.orig_id()}", (point.x, point.y), area_m2)
        except (RuntimeError, ValueError):
            return


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "data/korea/south-korea.osm.pbf")
    parser.add_argument("--out", type=Path, default=ROOT / "public/map-landmarks")
    parser.add_argument("--from-tiles", type=Path, help="Retile a previous flat extract without rereading the PBF")
    args = parser.parse_args()
    handler = Landmarks()
    # Filter in C++ after location/area assembly: unnamed geometry never
    # crosses into Python (the snapshot contains millions of unnamed nodes).
    if args.from_tiles:
        handler.rows = [row for path in args.from_tiles.glob("[0-9]*.json")
                        for row in json.loads(path.read_text(encoding="utf-8"))["r"]
                        if not (row[4] == "building" and re.fullmatch(r"[0-9]+[A-Za-z]?(?:동|호)?", row[1]))]
    else:
        source = (osmium.FileProcessor(str(args.source)).with_locations("sparse_mem_array")
                  .with_areas().with_filter(osmium.filter.KeyFilter("name", "name:ko")))
        for entity in source:
            if entity.is_node():
                handler.node(entity)
            elif entity.is_area():
                handler.area(entity)
    tiles = defaultdict(list)
    seen = {}
    kept = []
    for row in sorted(handler.rows, key=lambda r: (r[6], r[0])):
        # OSM often has both a labelled node and a polygon for one facility:
        # keep the first, but with the polygon's area and the larger renown.
        key = (row[1], row[4], round(row[2] / 20), round(row[3] / 20))
        if key in seen:
            first = seen[key]
            extra = first[7] if len(first) > 7 else {}
            more = row[7] if len(row) > 7 else {}
            merged = extras(max(extra.get("areaM2", 0), more.get("areaM2", 0)), max(extra.get("f", 0), more.get("f", 0)))
            if merged:
                if len(first) > 7:
                    first[7] = merged
                else:
                    first.append(merged)
            continue
        seen[key] = row
        kept.append(row)
        for level, step in [("overview", STEP), ("detail", .1)]:
            if level == "overview" and row[6] > 1:
                continue
            tile = f"{level}/{math.floor(row[2] / 1e5 / step)}_{math.floor(row[3] / 1e5 / step)}"
            tiles[tile].append(row)
    args.out.mkdir(parents=True, exist_ok=True)
    for key, rows in sorted(tiles.items()):
        # Rows are shared between levels, so extras merged above are in both.
        (args.out / key).parent.mkdir(parents=True, exist_ok=True)
        (args.out / f"{key}.json").write_text(json.dumps({"v": 1, "r": rows}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    index = {"v": 2, "levels": [{"name": level, "step": step, "tiles": sorted(key.split("/")[1] for key in tiles if key.startswith(f"{level}/"))}
                                for level, step in [("overview", STEP), ("detail", .1)]],
             "source": "OpenStreetMap contributors / Geofabrik", "license": "ODbL-1.0"}
    (args.out / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"places": len(seen), "tiles": len(tiles), "categories": Counter(row[5] for row in kept)}, ensure_ascii=False))
    print("Soongsil:", [row for row in handler.rows if "숭실대학교" == row[1]])


if __name__ == "__main__":
    main()
