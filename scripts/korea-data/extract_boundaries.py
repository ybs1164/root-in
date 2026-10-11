"""Land-dividing lines from the OSM extract, cached for the walk level.

python scripts/korea-data/extract_boundaries.py [--limit N]

Writes data/korea/boundaries.pkl: a list of (kind, [(lon, lat), ...]) where kind is
"area" (outline of a landuse/leisure/amenity/natural area), "water" (rivers,
streams, shore of water areas), "rail" or "fence" (barriers). Buildings are left
out (tens of millions of them). Only ways are read; multipolygon relations are
skipped, their member ways still show up when tagged themselves.
"""
import argparse
import pickle
import time
from pathlib import Path

import osmium

ROOT = Path(__file__).resolve().parents[2]
PBF = ROOT / "data/korea/south-korea.osm.pbf"
OUT = ROOT / "data/korea/boundaries.pkl"

AREA_LANDUSE = {"residential", "commercial", "retail", "industrial", "farmland", "forest", "meadow", "orchard",
                "vineyard", "cemetery", "construction", "education", "religious", "military", "farmyard",
                "allotments", "recreation_ground", "railway", "brownfield", "landfill", "quarry", "greenfield"}
AREA_LEISURE = {"park", "garden", "playground", "pitch", "sports_centre", "stadium", "golf_course", "track",
                "nature_reserve", "swimming_pool", "common", "dog_park", "fitness_station"}
AREA_AMENITY = {"school", "university", "college", "kindergarten", "hospital", "parking", "marketplace",
                "place_of_worship", "grave_yard", "townhall", "community_centre", "library", "bus_station"}
AREA_NATURAL = {"wood", "scrub", "grassland", "wetland", "heath", "bare_rock", "sand", "beach", "water"}
WATERWAY = {"river", "stream", "canal", "drain", "ditch"}
RAIL = {"rail", "light_rail", "subway", "tram", "narrow_gauge", "monorail"}
FENCE = {"fence", "wall", "retaining_wall", "city_wall"}


def kind_of(tags):
    t = tags.get
    if t("waterway") in WATERWAY:
        return "water"
    if t("railway") in RAIL and t("tunnel") not in {"yes", "building_passage"} and t("layer") not in {"-1", "-2"}:
        return "rail"
    if t("barrier") in FENCE:
        return "fence"
    if t("natural") == "water" or t("natural") == "coastline":
        return "water"
    if (t("landuse") in AREA_LANDUSE or t("leisure") in AREA_LEISURE
            or t("amenity") in AREA_AMENITY or t("natural") in AREA_NATURAL):
        return "area"
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, help="stop after this many kept ways (smoke test)")
    ap.add_argument("--pbf", type=Path, default=PBF, help="extract to read (default: the pinned download)")
    args = ap.parse_args()
    started = time.time()
    fp = osmium.FileProcessor(str(args.pbf), osmium.osm.WAY | osmium.osm.NODE).with_locations().with_filter(
        osmium.filter.KeyFilter("waterway", "railway", "barrier", "natural", "landuse", "leisure", "amenity"))
    out, counts = [], {}
    for obj in fp:
        if not obj.is_way():
            continue
        kind = kind_of(obj.tags)
        if kind is None:
            continue
        try:
            pts = [(n.lon, n.lat) for n in obj.nodes]
        except Exception:
            continue  # a node outside the extract
        if len(pts) < 2:
            continue
        out.append((kind, pts))
        counts[kind] = counts.get(kind, 0) + 1
        if len(out) % 100_000 == 0:
            print(f"{len(out)} ways, {time.time() - started:.0f}s", flush=True)
        if args.limit and len(out) >= args.limit:
            break
    tmp = OUT.with_name(OUT.name + ".tmp")
    tmp.write_bytes(pickle.dumps(out))
    tmp.replace(OUT)
    print(f"done: {counts} in {time.time() - started:.0f}s -> {OUT}", flush=True)


if __name__ == "__main__":
    main()
