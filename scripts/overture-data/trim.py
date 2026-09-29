import json
import sys

KEEP_PROPS = ("class", "subtype", "height", "num_floors")


def round_coords(coords, ndigits=6):
    if isinstance(coords[0], (list, tuple)):
        return [round_coords(c, ndigits) for c in coords]
    return [round(c, ndigits) for c in coords]


def trim_feature(feat):
    props = feat.get("properties", {}) or {}
    names = props.get("names") or {}
    primary_name = None
    if isinstance(names, dict):
        primary_name = names.get("primary")

    new_props = {}
    if primary_name:
        new_props["name"] = primary_name
    for key in KEEP_PROPS:
        value = props.get(key)
        if value not in (None, "", []):
            new_props[key] = value

    geometry = feat.get("geometry", {})
    geometry = {
        "type": geometry.get("type"),
        "coordinates": round_coords(geometry.get("coordinates")),
    }

    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": new_props,
    }


def main():
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as f:
        data = json.load(f)

    features = [trim_feature(feat) for feat in data["features"]]
    out = {"type": "FeatureCollection", "features": features}

    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)

    print(f"{src} -> {dst}: {len(features)} features")


if __name__ == "__main__":
    main()
