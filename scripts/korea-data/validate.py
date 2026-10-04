"""Validate every generated tile, coverage and raw-source accounting offline."""
import json
from pathlib import Path
from shapely.geometry import Polygon
from build import LEVELS, MAX_MPP, MIN_BLOCK_AREA, SCALE_LABELS, block_policy_of, tile_build_policy

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/korea"


def main():
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["highwayCount"] == sum(manifest["highwayClasses"].values())
    assert manifest["highwayCount"] == 1816596
    assert manifest["geometryOmittedHighways"] == 1
    assert len(manifest["levels"]) == 4
    total_tiles = total_blocks = 0
    for level, (name, step, width, tolerance, classes) in zip(manifest["levels"], LEVELS):
        assert level["name"] == name and level["step"] == step
        assert level["roadClasses"] == sorted(classes)
        assert level["scaleLabel"] == SCALE_LABELS[name]
        assert level["maxMetersPerPixel"] == MAX_MPP[name]
        assert level["blockPolicy"] == block_policy_of(name)
        assert level["minBlockAreaM2"] == MIN_BLOCK_AREA[name]
        count = 0
        build_policy = tile_build_policy(name, step, width, tolerance, classes)
        for key in level["tiles"]:
            path = OUT / level["name"] / f"{key}.json"
            tile = json.loads(path.read_text(encoding="utf-8"))
            assert tile["buildPolicy"] == build_policy, path
            assert Polygon(tile["region"]).is_valid, path
            for block in tile["blocks"]:
                assert block["areaM2"] > 0
                assert block.get("continuesBeyondTile") is True or block["areaM2"] >= MIN_BLOCK_AREA[name] - .01
                polygon = Polygon(block["outer"], block["holes"])
                assert polygon.is_valid and polygon.area > 0, path
                assert not polygon.interiors and polygon.equals(polygon.convex_hull), path
                assert polygon.bounds[0] >= 124 and polygon.bounds[2] <= 133, path
                assert polygon.bounds[1] >= 32 and polygon.bounds[3] <= 40, path
            count += len(tile["blocks"])
        print(f"Validated {level['name']}: {len(level['tiles'])} tiles / {count:,} polygons", flush=True)
        assert count == level["blockCount"]
        # Seoul, Busan, Jeju, Ulleungdo and Dokdo must all have indexed files.
        for lon, lat in [(126.978, 37.5665), (129.0756, 35.1796), (126.53, 33.5), (130.9, 37.5), (131.867, 37.242)]:
            import math
            assert f"{math.floor(lon / level['step'])}_{math.floor(lat / level['step'])}" in level["tiles"], (level["name"], lon, lat)
        total_tiles += len(level["tiles"])
        total_blocks += count
    print(f"Validated {total_tiles:,} tiles / {total_blocks:,} polygons; {manifest['highwayCount']:,} highway ways")


if __name__ == "__main__":
    main()
