"""python scripts/korea-data/test_admin_blocks.py"""
from shapely.geometry import LineString, box
from shapely.strtree import STRtree

from build_admin import M2_PER_DEG2, dong_parts

# A 600m square 읍면동 near Seoul, in degrees.
LON, LAT = 127.0, 37.5
DX, DY = 1 / 88_900, 1 / 110_540
DONG = box(LON, LAT, LON + 600 * DX, LAT + 600 * DY)
NONE = ([], STRtree([]))


def line(*points):
    return LineString([(LON + x * DX, LAT + y * DY) for x, y in points])


def roads(*lines):
    lines = list(lines)
    return (lines, STRtree(lines))


# Local streets every 200m: nine 4ha blocks.
GRID = [line((0, y), (600, y)) for y in (200, 400)] + [line((x, 0), (x, 600)) for x in (200, 400)]


def build(block=NONE, walk=NONE):
    return dong_parts("1100000000", "가동", DONG, NONE, block, walk)


def test_streets_cut_blocks_and_codes_nest():
    secs, blocks, walks, share = build(roads(*GRID))
    assert [s["code"] for s in secs] == ["1100000000-0"]
    assert len(blocks) == 9
    assert all(b["code"].startswith("1100000000-0-") for b in blocks)
    assert walks == []
    assert share > 0.999


def test_dead_end_does_not_cut():
    _, blocks, _, _ = build(roads(line((0, 300), (300, 300))))
    assert len(blocks) == 1


def test_only_split_blocks_get_walk_pieces():
    # One footway across the corner block.
    _, blocks, walks, _ = build(roads(*GRID), roads(line((0, 100), (200, 100))))
    assert len(blocks) == 9
    assert len(walks) == 2
    parent = {w["code"].rsplit("-", 1)[0] for w in walks}
    assert len(parent) == 1 and parent <= {b["code"] for b in blocks}


def test_slivers_merge_into_a_neighbor():
    # A lane 20m from the edge would leave a 1.2ha strip: under 8% of the section, so merged.
    _, blocks, _, _ = build(roads(line((20, 0), (20, 600))))
    assert len(blocks) == 1
    assert abs(DONG.area * M2_PER_DEG2 - 360_000) < 1


def test_small_island_is_kept():
    # A 50m island off the 읍면동 has no neighbor to merge into.
    island = box(LON + 700 * DX, LAT, LON + 750 * DX, LAT + 50 * DY)
    secs, blocks, _, share = dong_parts("1100000000", "가동", DONG.union(island), NONE, roads(*GRID), NONE)
    assert len(blocks) == 10
    assert share > 0.999


def test_main_roads_alone_make_the_sections():
    # One main road across: two sections, then local streets cut each into blocks.
    main = roads(line((300, 0), (300, 600)))
    secs, blocks, _, share = dong_parts("1100000000", "가동", DONG, main, roads(*GRID), NONE)
    assert len(secs) == 2
    assert {b["code"].rsplit("-", 1)[0] for b in blocks} == {s["code"] for s in secs}
    assert share > 0.999


def test_small_section_is_still_cut():
    # A 150m square (2.25ha) used to be skipped; a street through it now cuts it.
    small = box(LON, LAT, LON + 150 * DX, LAT + 150 * DY)
    _, blocks, _, _ = dong_parts("1100000000", "가동", small, NONE, roads(line((75, 0), (75, 150))), NONE)
    assert len(blocks) == 2


def test_small_block_gets_walk_pieces():
    # A footway across a 6,000 m² block: small blocks are cut too, no size skip.
    small = box(LON, LAT, LON + 100 * DX, LAT + 60 * DY)
    _, blocks, walks, _ = dong_parts("1100000000", "가동", small, NONE, NONE, roads(line((50, 0), (50, 60))))
    assert len(blocks) == 1 and len(walks) == 2


def test_levels_are_whole_partitions():
    from build_admin import dong_tree
    tree = dong_tree("1100000000", DONG, roads(line((300, 0), (300, 600))), roads(*GRID), roads(line((0, 100), (200, 100))))
    for level in tree.values():
        assert abs(sum(g.area for _, g, _ in level) - DONG.area) / DONG.area < 1e-6
    # Codes nest: every block starts with its section's code, every piece with its block's.
    sections = {c for c, _, _ in tree["section"]}
    blocks = {c for c, _, _ in tree["block"]}
    assert all(c.rsplit("-", 1)[0] in sections for c in blocks)
    assert all(c.rsplit("-", 1)[0] in blocks for c, _, _ in tree["walk"])


def test_rural_myeon_uses_the_bigger_walk_minimum():
    # A footway cutting a 1.2ha strip: kept in a 동 (minimum 8,000 m² here), merged in a 면 (3ha).
    foot = roads(line((20, 0), (20, 600)))
    _, _, urban, _ = dong_parts("1100000000", "가동", DONG, NONE, NONE, foot)
    _, _, rural, _ = dong_parts("1100000000", "가면", DONG, NONE, NONE, foot)
    assert len(urban) == 2 and rural == []


def test_dead_end_does_not_cut():
    _, blocks, _, _ = build(roads(line((0, 300), (300, 300))))
    assert len(blocks) == 1


def test_only_split_blocks_get_walk_pieces():
    # One footway across the corner block.
    _, blocks, walks, _ = build(roads(*GRID), roads(line((0, 100), (200, 100))))
    assert len(blocks) == 9
    assert len(walks) == 2
    parent = {w["code"].rsplit("-", 1)[0] for w in walks}
    assert len(parent) == 1 and parent <= {b["code"] for b in blocks}


def test_slivers_merge_into_a_neighbor():
    # A lane 20m from the edge would leave a 1.2ha strip: under 8% of the section, so merged.
    _, blocks, _, _ = build(roads(line((20, 0), (20, 600))))
    assert len(blocks) == 1
    assert abs(DONG.area * M2_PER_DEG2 - 360_000) < 1


def test_small_island_is_kept():
    # A 50m island off the 읍면동 has no neighbor to merge into.
    island = box(LON + 700 * DX, LAT, LON + 750 * DX, LAT + 50 * DY)
    secs, blocks, _, share = dong_parts("1100000000", "가동", DONG.union(island), NONE, roads(*GRID), NONE)
    assert len(blocks) == 10
    assert share > 0.999


def test_main_roads_alone_make_the_sections():
    # One main road across: two sections, then local streets cut each into blocks.
    main = roads(line((300, 0), (300, 600)))
    secs, blocks, _, share = dong_parts("1100000000", "가동", DONG, main, roads(*GRID), NONE)
    assert len(secs) == 2
    assert {b["code"].rsplit("-", 1)[0] for b in blocks} == {s["code"] for s in secs}
    assert share > 0.999


def test_small_section_is_still_cut():
    # A 150m square (2.25ha) used to be skipped; a street through it now cuts it.
    small = box(LON, LAT, LON + 150 * DX, LAT + 150 * DY)
    _, blocks, _, _ = dong_parts("1100000000", "가동", small, NONE, roads(line((75, 0), (75, 150))), NONE)
    assert len(blocks) == 2


def test_small_block_gets_walk_pieces():
    # A footway across a 6,000 m² block: small blocks are cut too, no size skip.
    small = box(LON, LAT, LON + 100 * DX, LAT + 60 * DY)
    _, blocks, walks, _ = dong_parts("1100000000", "가동", small, NONE, NONE, roads(line((50, 0), (50, 60))))
    assert len(blocks) == 1 and len(walks) == 2


def test_levels_are_whole_partitions():
    from build_admin import dong_tree
    tree = dong_tree("1100000000", DONG, roads(line((300, 0), (300, 600))), roads(*GRID), roads(line((0, 100), (200, 100))))
    for level in tree.values():
        assert abs(sum(g.area for _, g, _ in level) - DONG.area) / DONG.area < 1e-6
    # Codes nest: every block starts with its section's code, every piece with its block's.
    sections = {c for c, _, _ in tree["section"]}
    blocks = {c for c, _, _ in tree["block"]}
    assert all(c.rsplit("-", 1)[0] in sections for c in blocks)
    assert all(c.rsplit("-", 1)[0] in blocks for c, _, _ in tree["walk"])


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
